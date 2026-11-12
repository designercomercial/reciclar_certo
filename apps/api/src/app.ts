/**
 * API da página "Reciclar Certo".
 *
 *   GET  /api/publico/guia-materiais          guia + valores da tabela vigente (público, cacheável)
 *   POST /api/cidadao/reciclar/analisar       corpo image/jpeg → resultado da IA ligado ao guia
 *   GET  /api/cidadao/jogo                    jogo ligado? ainda dá XP hoje?
 *   POST /api/cidadao/jogo/partidas           registra a partida; XP só na primeira do dia
 *
 * Toda rota de /api/cidadao usa o usuário da SESSÃO. Toda resposta é validada
 * pelo contrato antes de sair.
 */
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { Analise, EstadoJogo, Guia, PartidaPedido, PartidaResposta, type CodigoErro, type Esquema } from "@ecoponto/contracts";
import { limparUrl, resumoErroDeContrato } from "@ecoponto/observability";
import { COOKIE_SESSAO, type AuthPort, type Sessao } from "./auth.ts";
import type { ServicoGuia } from "./guia/servico.ts";
import type { ServicoJogo } from "./jogo/servico.ts";
import { TAMANHO_MAXIMO_FOTO, type ServicoReciclar } from "./reciclar/servico.ts";

export type Reportar = (erro: unknown, contexto: Record<string, string>) => void;

export type OpcoesApp = {
  auth: AuthPort;
  guia: ServicoGuia;
  reciclar: ServicoReciclar;
  jogo: ServicoJogo;
  /** Rotas /dev para entrar como uma pessoa dos mocks. Nunca em produção. */
  devLogin?: { tokens: Readonly<Record<string, string>> } | undefined;
  reportar?: Reportar | undefined;
  /** true, ou um destino de log (testes leem o log estruturado da análise). */
  logger?: boolean | { stream: { write(linha: string): void } } | undefined;
};

declare module "fastify" {
  interface FastifyRequest {
    sessao: Sessao | null;
  }
}

const STATUS_ERRO: Readonly<Record<CodigoErro, number>> = {
  nao_autenticado: 401,
  parametro_invalido: 400,
  imagem_invalida: 415,
  imagem_grande: 413,
  limite_diario: 429,
  tempo_esgotado: 504,
  ia_indisponivel: 503,
  jogo_desligado: 404,
  partida_invalida: 422,
  nao_encontrado: 404,
  interno: 500,
};

function erro(reply: FastifyReply, codigo: CodigoErro, extra: { limite?: number } = {}) {
  return reply.code(STATUS_ERRO[codigo]).send({ erro: codigo, ...extra });
}

export async function buildApp(opts: OpcoesApp): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger
      ? {
          ...(typeof opts.logger === "object" ? { stream: opts.logger.stream } : {}),
          // Nada de cookie, token, corpo (foto) ou query string no log.
          serializers: {
            req: (req: FastifyRequest) => ({ method: req.method, url: limparUrl(req.url) }),
          },
        }
      : false,
  });
  const reportar: Reportar = opts.reportar ?? (() => {});

  await app.register(cookie);
  app.decorateRequest("sessao", null);

  // A foto chega como image/jpeg, direto em memória (nunca em disco).
  app.addContentTypeParser("image/jpeg", { parseAs: "buffer", bodyLimit: TAMANHO_MAXIMO_FOTO }, (_req, corpo, pronto) => pronto(null, corpo));

  app.setErrorHandler((e, req, reply) => {
    const codigo = (e as { code?: string }).code;
    if (codigo === "FST_ERR_CTP_BODY_TOO_LARGE") return erro(reply, "imagem_grande");
    if (codigo === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return erro(reply, "imagem_invalida");
    if (codigo === "FST_ERR_CTP_EMPTY_JSON_BODY" || codigo === "FST_ERR_CTP_INVALID_JSON_BODY" || (e as { statusCode?: number }).statusCode === 400) {
      return erro(reply, "parametro_invalido");
    }
    const rota = req.routeOptions.url ?? "desconhecida";
    // Só a rota e o código: nunca o corpo (a foto) nem o usuário.
    reportar(e, { rota });
    req.log.error({ rota, codigo }, "erro na rota");
    return erro(reply, "interno");
  });

  /** Valida a saída contra o contrato antes de enviar. */
  function enviar<T>(reply: FastifyReply, schema: Esquema<T>, dados: unknown, rota: string, status = 200) {
    const v = schema.safeParse(dados);
    if (!v.success) {
      reportar(new Error("Resposta fora do contrato"), { rota, detalhe: resumoErroDeContrato(v.error.issues) });
      return erro(reply, "interno");
    }
    return reply.code(status).send(v.data);
  }

  // ---- Público: guia de materiais ----
  app.get("/api/publico/guia-materiais", async (_req, reply) => {
    const g = await opts.guia.guia();
    if (!g) return erro(reply, "interno");
    // Igual para todos: pode ficar em cache curto (e servir velho se a API cair).
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=600, stale-if-error=86400");
    return enviar(reply, Guia, g, "guia-materiais");
  });

  // ---- Cidadão ----
  await app.register(
    async (r) => {
      r.addHook("onRequest", async (req, reply) => {
        req.sessao = await opts.auth.autenticar(req);
        if (!req.sessao) return erro(reply, "nao_autenticado");
        reply.header("Cache-Control", "private, no-store");
        reply.header("Vary", "Cookie, Authorization");
      });

      r.post("/reciclar/analisar", async (req, reply) => {
        const inicio = performance.now();
        const log = (dados: Record<string, unknown>) =>
          req.log.info({ evento: "analise", ...dados, duracaoMs: Math.round((performance.now() - inicio) * 10) / 10 }, "analise");

        const corpo = req.body;
        if (!(corpo instanceof Uint8Array) || corpo.length === 0) {
          log({ resultado: "erro", motivo: "imagem_invalida" });
          return erro(reply, "imagem_invalida");
        }
        // Se o aparelho desistir (5 s), a chamada da IA também é cancelada.
        const desistiu = new AbortController();
        // (O "close" do pedido dispara ao terminar de ler o corpo; o da resposta,
        // antes de enviar, só quando a conexão caiu.)
        reply.raw.once("close", () => {
          if (!reply.raw.writableEnded) desistiu.abort();
        });

        let res: Awaited<ReturnType<ServicoReciclar["analisar"]>>;
        try {
          res = await opts.reciclar.analisar(req.sessao!.usuarioId, corpo, desistiu.signal);
        } catch (e) {
          log({ resultado: "erro", motivo: "interno" });
          throw e;
        } finally {
          // Solta a referência ao corpo (já zerado pelo serviço).
          (req as { body: unknown }).body = null;
        }
        if (!res.ok) {
          log({ resultado: "erro", motivo: res.erro });
          return erro(reply, res.erro, res.limite === undefined ? {} : { limite: res.limite });
        }
        const a = res.analise;
        // Log estruturado (critério de observabilidade): sem imagem, sem usuário.
        log({
          resultado: a.resultado,
          material: a.resultado === "aceito" ? a.material : a.resultado === "nao_aceito" ? "nao_aceito" : null,
          item: a.resultado === "incerto" ? null : a.item.id,
          confianca: a.confianca,
        });
        return enviar(reply, Analise, a, "reciclar/analisar");
      });

      r.get("/jogo", async (req, reply) => {
        const e = await opts.jogo.estado(req.sessao!.usuarioId);
        return enviar(reply, EstadoJogo, e, "jogo");
      });

      r.post("/jogo/partidas", async (req, reply) => {
        if (!opts.jogo.ativo) return erro(reply, "jogo_desligado");
        const p = PartidaPedido.safeParse(req.body);
        if (!p.success) return erro(reply, "partida_invalida");
        const res = await opts.jogo.registrarPartida(req.sessao!.usuarioId, p.data);
        if (!res.ok) return erro(reply, res.erro);
        req.log.info(
          { evento: "partida", acertos: res.resposta.acertos, xp: res.resposta.xpConcedido, extra: res.resposta.extra, repetida: res.resposta.repetida },
          "partida",
        );
        return enviar(reply, PartidaResposta, res.resposta, "jogo/partidas", res.resposta.repetida ? 200 : 201);
      });
    },
    { prefix: "/api/cidadao" },
  );

  // ---- Entrada de desenvolvimento (só com mocks) ----
  if (opts.devLogin) {
    const tokens = opts.devLogin.tokens;
    app.get("/dev", async (_req, reply) => {
      const links = Object.keys(tokens)
        .map((t) => `<li><a href="/dev/entrar?como=${encodeURIComponent(t)}">${t.replace(/^dev-/, "")}</a></li>`)
        .join("");
      return reply
        .type("text/html; charset=utf-8")
        .send(
          `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrar (desenvolvimento)</title><body style="font:16px system-ui;padding:16px"><h1>Entrar como (só desenvolvimento)</h1><ul style="line-height:2.5">${links}</ul><p><a href="/dev/sair">Sair</a></p></body></html>`,
        );
    });
    app.get<{ Querystring: { como?: string; para?: string } }>("/dev/entrar", async (req, reply) => {
      const t = req.query.como ?? "";
      if (!Object.hasOwn(tokens, t)) return reply.code(400).send("Pessoa desconhecida");
      const para = req.query.para?.startsWith("/reciclar") ? req.query.para : "/reciclar/";
      return reply.setCookie(COOKIE_SESSAO, t, { path: "/", httpOnly: true, sameSite: "lax" }).redirect(para);
    });
    app.get("/dev/sair", async (_req, reply) => reply.clearCookie(COOKIE_SESSAO, { path: "/" }).redirect("/dev"));
  }

  return app;
}

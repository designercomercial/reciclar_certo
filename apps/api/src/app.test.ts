/**
 * API com PGlite (o mesmo SQL do PostgreSQL), IA mock e XP mock.
 * Concorrência num PostgreSQL real: ver concorrencia.pg.test.ts.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Analise, EstadoJogo, Guia, PartidaResposta } from "@ecoponto/contracts";
import { ITENS_JOGO } from "@ecoponto/regras";
import { criarDbPglite, type Db } from "./db/db.ts";
import { classificadorMock, type ClassificadorImagem } from "./ia/classificador.ts";
import { removerMetadadosJpeg } from "./ia/jpeg.ts";
import { buildAppMock, type AppMock } from "./index.ts";
import { comExif, foto } from "./test/fotos.ts";
import type { XpMock } from "./xp/xp.ts";

let db: Db;
afterAll(async () => db?.fechar());

const AGORA = new Date("2026-11-12T10:00:00-04:00");

async function api(o: Parameters<typeof buildAppMock>[0] = {}): Promise<AppMock> {
  db ??= await criarDbPglite();
  return buildAppMock({ agora: () => AGORA, db, devLogin: false, ...o });
}

const como = (pessoa = "cidadao-ana") => ({ authorization: `Bearer dev-${pessoa}` });

function analisar(app: AppMock, imagem: Buffer, pessoa = "cidadao-ana") {
  return app.inject({ method: "POST", url: "/api/cidadao/reciclar/analisar", headers: { ...como(pessoa), "content-type": "image/jpeg" }, payload: imagem });
}

function partida(app: AppMock, id: string, acertos = 10, pessoa = "cidadao-ana") {
  const respostas = ITENS_JOGO.slice(0, 10).map((i, n) => ({ itemId: i.id, lixeira: n < acertos ? i.lixeira : ("nao_reciclavel" as const) }));
  return app.inject({ method: "POST", url: "/api/cidadao/jogo/partidas", headers: como(pessoa), payload: { id, respostas } });
}

const idPartida = (n: number) => `partida-teste-${String(n).padStart(4, "0")}`;

// ---------------------------------------------------------------------------

describe("guia de materiais", () => {
  it("é público e traz as 6 categorias", async () => {
    const app = await api();
    const r = await app.inject({ method: "GET", url: "/api/publico/guia-materiais" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toMatch(/public/);
    const g = Guia.parse(r.json());
    expect(g.categorias.map((c) => c.nome)).toEqual(["Plástico", "Papel", "Metal", "Vidro", "Óleo de cozinha", "Não aceitos"]);
  });

  it("os valores batem com a tabela de valores vigente no banco (critério 5)", async () => {
    const app = await api();
    const g = Guia.parse((await app.inject({ method: "GET", url: "/api/publico/guia-materiais" })).json());
    const { rows } = await app.db.query<{ material: string; pontos: number; unidade: string }>(
      "SELECT material, pontos, unidade FROM tabela_valores WHERE versao = 'v3'",
    );
    expect(g.tabela).toEqual({ versao: "v3", vigenteDesde: "2026-10-01" });
    for (const linha of rows) {
      const c = g.categorias.find((x) => x.material === linha.material);
      expect(c?.valor, linha.material).toEqual({ pontos: linha.pontos, unidade: linha.unidade });
    }
    expect(g.categorias.find((c) => c.id === "nao_aceitos")?.valor).toBeNull();
  });

  it("usa a versão vigente no dia (antes de 01/10, a v2)", async () => {
    const app = await api({ agora: () => new Date("2026-09-30T23:30:00-04:00") });
    const g = Guia.parse((await app.inject({ method: "GET", url: "/api/publico/guia-materiais" })).json());
    expect(g.tabela.versao).toBe("v2");
    expect(g.categorias.find((c) => c.id === "metal")?.valor).toEqual({ pontos: 40, unidade: "kg" });
  });
});

describe("Posso levar? (T21)", () => {
  it("casca de banana → não aceito, com onde descartar (critério 1)", async () => {
    const r = await analisar(await api(), foto("casca-banana"));
    expect(r.statusCode).toBe(200);
    const a = Analise.parse(r.json());
    expect(a).toMatchObject({
      resultado: "nao_aceito",
      item: { id: "casca-banana" },
      ondeDescartar: "Resto de comida vai no lixo comum ou na compostagem.",
    });
  });

  it("lata → aceito, metal, com estimativa da tabela vigente (critério 1)", async () => {
    const a = Analise.parse((await analisar(await api(), foto("lata"))).json());
    expect(a).toMatchObject({
      resultado: "aceito",
      item: { id: "lata-aluminio", nome: "Lata de alumínio" },
      material: "metal",
      materialNome: "Metal",
      estimativa: { pontos: 45, unidade: "kg" },
      preparo: expect.arrayContaining(["Lave e amasse."]),
    });
  });

  it("foto borrada → incerto, com as 2 sugestões mais prováveis", async () => {
    const a = Analise.parse((await analisar(await api(), foto("foto-borrada"))).json());
    expect(a.resultado).toBe("incerto");
    if (a.resultado === "incerto") expect(a.sugestoes.map((s) => s.id)).toEqual(["caixa-leite", "jornal-revista"]);
  });

  it("foto desconhecida → incerto, sem sugestão", async () => {
    const outra = Buffer.concat([foto("lata").subarray(0, -2), Buffer.from([0x00, 0xff, 0xd9])]);
    const a = Analise.parse((await analisar(await api(), outra)).json());
    expect(a).toEqual({ resultado: "incerto", confianca: 0.22, sugestoes: [] });
  });

  it("IA demorou → 504 tempo_esgotado", async () => {
    const app = await api({ tempoLimiteIaMs: 150 });
    const r = await analisar(app, foto("foto-lenta"));
    expect(r.statusCode).toBe(504);
    expect(r.json()).toEqual({ erro: "tempo_esgotado" });
  });

  it("IA fora do ar → 503 ia_indisponivel", async () => {
    const r = await analisar(await api(), foto("foto-erro"));
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erro: "ia_indisponivel" });
  });

  it("sem sessão → 401; não JPEG → 415; foto grande → 413", async () => {
    const app = await api();
    expect((await app.inject({ method: "POST", url: "/api/cidadao/reciclar/analisar", headers: { "content-type": "image/jpeg" }, payload: foto("lata") })).statusCode).toBe(401);
    expect((await analisar(app, Buffer.from("isto não é uma foto"))).statusCode).toBe(415);
    const png = await app.inject({ method: "POST", url: "/api/cidadao/reciclar/analisar", headers: { ...como(), "content-type": "image/png" }, payload: Buffer.from([0x89, 0x50]) });
    expect(png.statusCode).toBe(415);
    const grande = Buffer.concat([foto("lata"), Buffer.alloc(2 * 1024 * 1024)]);
    expect((await analisar(app, grande)).statusCode).toBe(413);
  });

  it("limite de fotos por dia → 429 sem chamar a IA", async () => {
    let chamadas = 0;
    const mock = classificadorMock();
    const ia: ClassificadorImagem = { nome: "conta", classificar: (b, o) => (chamadas++, mock.classificar(b, o)) };
    const app = await api({ limiteFotosDia: 2, ia });
    expect((await analisar(app, foto("lata"))).statusCode).toBe(200);
    expect((await analisar(app, foto("lata"))).statusCode).toBe(200);
    const r = await analisar(app, foto("lata"));
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ erro: "limite_diario", limite: 2 });
    expect(chamadas).toBe(2);
    // Quem já usou as 30 de hoje (dados de exemplo).
    expect((await analisar(await api(), foto("lata"), "cidadao-limite")).statusCode).toBe(429);
  });

  it("o limite é por dia em Boa Vista: vira à meia-noite local, não à UTC", async () => {
    let agora = new Date("2026-11-12T20:30:00-04:00"); // 00:30 UTC do dia 13
    const app = await api({ limiteFotosDia: 1, agora: () => agora });
    expect((await analisar(app, foto("lata"))).statusCode).toBe(200);
    agora = new Date("2026-11-12T23:50:00-04:00");
    expect((await analisar(app, foto("lata"))).statusCode).toBe(429);
    agora = new Date("2026-11-13T00:10:00-04:00");
    expect((await analisar(app, foto("lata"))).statusCode).toBe(200);
  });
});

describe("HTTP de verdade (não só inject)", () => {
  it("a análise responde por uma conexão real: o fim da leitura do corpo não cancela a IA", async () => {
    const app = await api({ ia: classificadorMock({ atrasoMs: 150 }) });
    const url = await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const r = await fetch(`${url}/api/cidadao/reciclar/analisar`, { method: "POST", headers: { ...como(), "content-type": "image/jpeg" }, body: foto("lata") });
      expect(r.status).toBe(200);
      expect(Analise.parse(await r.json()).resultado).toBe("aceito");
    } finally {
      await app.close();
    }
  });
});

describe("privacidade da foto (critério 3)", () => {
  /** IA que guarda a referência do que recebeu, para conferir depois. */
  function espia() {
    const recebidas: Uint8Array[] = [];
    const mock = classificadorMock();
    const ia: ClassificadorImagem = {
      nome: "espia",
      classificar: (b, o) => {
        recebidas.push(b);
        return mock.classificar(b, o);
      },
    };
    return { ia, recebidas };
  }

  it("depois da resposta, a foto não existe mais: memória zerada, nada no banco, nada no log", async () => {
    const linhas: string[] = [];
    const { ia, recebidas } = espia();
    const app = await api({ ia, logger: { stream: { write: (l) => void linhas.push(l) } } });
    let corpoRecebido: Buffer | null = null;
    app.addHook("preHandler", async (req) => {
      if (Buffer.isBuffer(req.body)) corpoRecebido = req.body;
    });
    const original = foto("lata");
    const r = await analisar(app, original);
    expect(r.statusCode).toBe(200);

    // 1. Memória: o corpo recebido e a cópia enviada à IA foram zerados.
    expect(corpoRecebido).not.toBeNull();
    expect(corpoRecebido!.every((b) => b === 0)).toBe(true);
    expect(recebidas).toHaveLength(1);
    expect(recebidas[0]!.every((b) => b === 0)).toBe(true);

    // 2. Banco: nenhuma coluna binária e nenhum pedaço da foto em nenhuma tabela.
    const binarias = await app.db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('bytea', 'oid')");
    expect(binarias.rows).toEqual([]);
    const tabelas = await app.db.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const amostraHex = original.subarray(200, 232).toString("hex");
    const amostraB64 = original.subarray(200, 248).toString("base64");
    for (const { table_name } of tabelas.rows) {
      const { rows } = await app.db.query(`SELECT * FROM ${table_name}`);
      const texto = JSON.stringify(rows);
      expect(texto, table_name).not.toContain(amostraHex);
      expect(texto, table_name).not.toContain(amostraB64);
    }
    // Só a contagem de uso fica gravada.
    expect((await app.db.query("SELECT total FROM reciclar_uso WHERE usuario_id = 'usr_ana'")).rows).toEqual([{ total: 1 }]);

    // 3. Log: nada da foto, nem do usuário.
    const log = linhas.join("\n");
    expect(log).not.toContain(amostraB64);
    expect(log).not.toContain(amostraHex);
    expect(log).not.toMatch(/usr_ana|dev-cidadao/);
  });

  it("também zera a foto quando a IA falha ou demora", async () => {
    const { ia, recebidas } = espia();
    const app = await api({ ia, tempoLimiteIaMs: 100 });
    expect((await analisar(app, foto("foto-lenta"))).statusCode).toBe(504);
    expect((await analisar(app, foto("foto-erro"))).statusCode).toBe(503);
    expect(recebidas.every((b) => b.every((x) => x === 0))).toBe(true);
  });

  it("a IA não recebe metadados da foto (EXIF com localização)", async () => {
    const { ia, recebidas } = espia();
    const app = await api({ ia });
    const comGps = comExif(foto("lata"));
    const esperado = Buffer.from(removerMetadadosJpeg(comGps)); // cópia antes de zerar
    const r = await analisar(app, comGps);
    // Mesmo resultado da foto sem EXIF: a IA recebeu a mesma imagem limpa.
    expect(Analise.parse(r.json()).resultado).toBe("aceito");
    expect(esperado.includes(Buffer.from("GPS"))).toBe(false);
    expect(esperado.equals(foto("lata"))).toBe(true);
    expect(recebidas).toHaveLength(1);
  });
});

describe("log estruturado da análise", () => {
  it("tem resultado, material, confiança e tempo de resposta", async () => {
    const linhas: string[] = [];
    const app = await api({ logger: { stream: { write: (l) => void linhas.push(l) } } });
    await analisar(app, foto("lata"));
    await analisar(app, foto("casca-banana"));
    const eventos = linhas.map((l) => JSON.parse(l) as Record<string, unknown>).filter((e) => e.evento === "analise");
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ resultado: "aceito", material: "metal", item: "lata-aluminio", confianca: 0.94 });
    expect(eventos[1]).toMatchObject({ resultado: "nao_aceito", material: "nao_aceito", item: "casca-banana", confianca: 0.96 });
    for (const e of eventos) expect(typeof e.duracaoMs).toBe("number");
  });
});

describe("Jogo da Separação (T45)", () => {
  let app: AppMock;
  beforeEach(async () => {
    app = await api();
  });

  it("estado: ligado e com XP disponível", async () => {
    const e = EstadoJogo.parse((await app.inject({ method: "GET", url: "/api/cidadao/jogo", headers: como() })).json());
    expect(e).toEqual({ ativo: true, xpDisponivelHoje: true, xpMaximo: 20, itensPorPartida: 10 });
    const bruno = EstadoJogo.parse((await app.inject({ method: "GET", url: "/api/cidadao/jogo", headers: como("cidadao-bruno") })).json());
    expect(bruno).toMatchObject({ ativo: true, xpDisponivelHoje: false });
  });

  it("a primeira partida do dia dá XP; a segunda não (critério 7)", async () => {
    const r1 = await partida(app, idPartida(1), 8);
    expect(r1.statusCode).toBe(201);
    expect(PartidaResposta.parse(r1.json())).toEqual({ acertos: 8, total: 10, xpConcedido: 18, extra: false, repetida: false });

    const r2 = await partida(app, idPartida(2), 10);
    expect(r2.statusCode).toBe(201);
    expect(PartidaResposta.parse(r2.json())).toEqual({ acertos: 10, total: 10, xpConcedido: 0, extra: true, repetida: false });

    // Só um evento no motor de XP.
    expect((app.xp as XpMock).eventos).toEqual([
      { usuarioId: "usr_ana", origem: "jogo_separacao", xp: 18, chave: `jogo:${idPartida(1)}`, em: AGORA.toISOString() },
    ]);
  });

  it("o dia é o de Boa Vista: 20:00 e 23:59 locais (dias UTC diferentes) são o mesmo dia; 00:05 é outro", async () => {
    let agora = new Date("2026-11-12T20:00:00-04:00"); // 00:00 UTC do dia 13
    const a = await api({ agora: () => agora });
    expect(PartidaResposta.parse((await partida(a, idPartida(10))).json()).xpConcedido).toBe(20);
    agora = new Date("2026-11-12T23:59:00-04:00"); // 03:59 UTC do dia 13
    expect(PartidaResposta.parse((await partida(a, idPartida(11))).json())).toMatchObject({ xpConcedido: 0, extra: true });
    agora = new Date("2026-11-13T00:05:00-04:00");
    expect(PartidaResposta.parse((await partida(a, idPartida(12))).json())).toMatchObject({ xpConcedido: 20, extra: false });
  });

  it("quem já jogou hoje (dados de exemplo) não ganha XP", async () => {
    const r = PartidaResposta.parse((await partida(app, idPartida(20), 10, "cidadao-bruno")).json());
    expect(r).toMatchObject({ xpConcedido: 0, extra: true });
  });

  it("reenviar a mesma partida devolve o mesmo resultado, sem XP novo", async () => {
    const r1 = PartidaResposta.parse((await partida(app, idPartida(30), 6)).json());
    const r2 = await partida(app, idPartida(30), 6);
    expect(r2.statusCode).toBe(200);
    expect(PartidaResposta.parse(r2.json())).toEqual({ ...r1, repetida: true });
    expect((app.xp as XpMock).eventos).toHaveLength(1);
    // O id de outra pessoa não vaza nem é reaproveitado.
    expect((await partida(app, idPartida(30), 6, "cidadao-bruno")).statusCode).toBe(422);
  });

  it("o servidor corrige pelo gabarito e recusa partida malformada", async () => {
    const r = PartidaResposta.parse((await partida(app, idPartida(40), 3)).json());
    expect(r.acertos).toBe(3);
    const curta = await app.inject({ method: "POST", url: "/api/cidadao/jogo/partidas", headers: como(), payload: { id: idPartida(41), respostas: [{ itemId: "jornal", lixeira: "papel" }] } });
    expect(curta.statusCode).toBe(422);
    const lixo = await app.inject({ method: "POST", url: "/api/cidadao/jogo/partidas", headers: como(), payload: { id: "x", respostas: "tudo certo" } });
    expect(lixo.statusCode).toBe(422);
  });

  it("jogo desligado: estado inativo e 404 na partida", async () => {
    const off = await api({ jogoAtivo: false });
    expect((await off.inject({ method: "GET", url: "/api/cidadao/jogo", headers: como() })).json()).toEqual({ ativo: false });
    expect((await partida(off, idPartida(50))).statusCode).toBe(404);
  });

  it("falha no motor de XP não perde a partida; o reenvio manda o evento de novo", async () => {
    let falhar = true;
    const eventos: string[] = [];
    const reportados: unknown[] = [];
    const a = await api({
      xp: { registrarEventoXp: async (e) => (falhar ? Promise.reject(new Error("T42 fora")) : void eventos.push(e.chave)) },
      reportar: (e) => void reportados.push(e),
    });
    const r1 = PartidaResposta.parse((await partida(a, idPartida(60))).json());
    expect(r1.xpConcedido).toBe(20);
    expect(reportados).toHaveLength(1);
    falhar = false;
    const r2 = PartidaResposta.parse((await partida(a, idPartida(60))).json());
    expect(r2).toMatchObject({ xpConcedido: 20, repetida: true });
    expect(eventos).toEqual([`jogo:${idPartida(60)}`]);
  });
});

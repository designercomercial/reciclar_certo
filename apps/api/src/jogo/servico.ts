/**
 * Jogo da Separação (T45): partidas e XP diário.
 *
 * XP só na PRIMEIRA partida do dia, no fuso de Boa Vista. Quem garante é o
 * banco: `jogo_xp_diario` tem chave primária (usuario_id, dia). Na transação:
 *
 *   1. INSERT da partida (id do aparelho). Já existia → é reenvio: devolve o
 *      mesmo resultado, sem nada novo.
 *   2. INSERT INTO jogo_xp_diario … ON CONFLICT DO NOTHING RETURNING.
 *      Voltou linha → primeira do dia → grava o XP na partida.
 *      Não voltou   → já ganhou hoje → XP 0, "partida extra".
 *
 * Duas partidas simultâneas do mesmo cidadão: a segunda espera no índice da
 * chave primária e cai no ON CONFLICT. Testado num PostgreSQL real.
 *
 * Depois do COMMIT, o evento vai para o motor de XP (T42) com a chave
 * "jogo:{id}". Se falhar, o reenvio da partida manda de novo.
 */
import type { EstadoJogo, PartidaPedido, PartidaResposta } from "@ecoponto/contracts";
import { diaEmBoaVista } from "@ecoponto/format";
import { calcularXp, corrigirPartida, ITENS_POR_PARTIDA, REGRA_XP_PADRAO, type RegraXp } from "@ecoponto/regras";
import type { Db } from "../db/db.ts";
import type { XpPort } from "../xp/xp.ts";

export type OpcoesJogo = {
  db: Db;
  xp: XpPort;
  agora: () => Date;
  /** ECO_JOGO_SEPARACAO=1. Desligado: a aba não aparece e as rotas dão 404. */
  ativo: boolean;
  regraXp?: RegraXp;
  reportar?: (erro: unknown, contexto: Record<string, string>) => void;
};

export type ResultadoPartida = { ok: true; resposta: PartidaResposta } | { ok: false; erro: "jogo_desligado" | "partida_invalida" };

export type ServicoJogo = {
  readonly ativo: boolean;
  estado(usuarioId: string): Promise<EstadoJogo>;
  registrarPartida(usuarioId: string, pedido: PartidaPedido): Promise<ResultadoPartida>;
};

type LinhaPartida = { usuario_id: string; acertos: number; total: number; xp: number };

export function criarServicoJogo(o: OpcoesJogo): ServicoJogo {
  const regra = o.regraXp ?? REGRA_XP_PADRAO;

  return {
    ativo: o.ativo,

    async estado(usuarioId) {
      if (!o.ativo) return { ativo: false };
      const { rows } = await o.db.query("SELECT 1 FROM jogo_xp_diario WHERE usuario_id = $1 AND dia = $2::date", [
        usuarioId,
        diaEmBoaVista(o.agora()),
      ]);
      return { ativo: true, xpDisponivelHoje: rows.length === 0, xpMaximo: regra.maximo, itensPorPartida: ITENS_POR_PARTIDA };
    },

    async registrarPartida(usuarioId, pedido) {
      if (!o.ativo) return { ok: false, erro: "jogo_desligado" };
      const correcao = corrigirPartida(pedido.respostas);
      if (!correcao.ok) return { ok: false, erro: "partida_invalida" };

      const agora = o.agora();
      const dia = diaEmBoaVista(agora);
      const xpSeGanhar = calcularXp(correcao.acertos, regra);

      const r = await o.db.transacao(async (tx) => {
        const nova = await tx.query(
          `INSERT INTO jogo_partidas (id, usuario_id, dia, acertos, total, xp, criada_em)
           VALUES ($1, $2, $3::date, $4, $5, 0, $6)
           ON CONFLICT (id) DO NOTHING RETURNING id`,
          [pedido.id, usuarioId, dia, correcao.acertos, correcao.total, agora.toISOString()],
        );
        if (nova.rows.length === 0) {
          // Reenvio (resposta perdida no 4G): mesmo resultado, nada novo.
          const { rows } = await tx.query<LinhaPartida>("SELECT usuario_id, acertos, total, xp FROM jogo_partidas WHERE id = $1", [pedido.id]);
          const p = rows[0];
          if (!p || p.usuario_id !== usuarioId) return { tipo: "invalida" as const };
          return { tipo: "repetida" as const, acertos: p.acertos, total: p.total, xp: p.xp };
        }
        const ganhou = await tx.query(
          `INSERT INTO jogo_xp_diario (usuario_id, dia, partida_id) VALUES ($1, $2::date, $3)
           ON CONFLICT (usuario_id, dia) DO NOTHING RETURNING partida_id`,
          [usuarioId, dia, pedido.id],
        );
        const xp = ganhou.rows.length === 1 ? xpSeGanhar : 0;
        if (xp > 0) await tx.query("UPDATE jogo_partidas SET xp = $2 WHERE id = $1", [pedido.id, xp]);
        return { tipo: "nova" as const, acertos: correcao.acertos, total: correcao.total, xp };
      });

      if (r.tipo === "invalida") return { ok: false, erro: "partida_invalida" };

      if (r.xp > 0) {
        try {
          await o.xp.registrarEventoXp({ usuarioId, origem: "jogo_separacao", xp: r.xp, chave: `jogo:${pedido.id}`, em: agora.toISOString() });
        } catch (e) {
          // A partida e o XP já estão gravados; o reenvio manda o evento de novo.
          o.reportar?.(e, { rota: "jogo/partidas", etapa: "registrarEventoXp" });
        }
      }

      return {
        ok: true,
        resposta: { acertos: r.acertos, total: r.total, xpConcedido: r.xp, extra: r.xp === 0, repetida: r.tipo === "repetida" },
      };
    },
  };
}

/**
 * Concorrência num PostgreSQL REAL (várias conexões ao mesmo tempo).
 * Sobe o embedded-postgres no setup global (ou usa ECO_PG_TESTE).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ITENS_JOGO } from "@ecoponto/regras";
import { type Db } from "./db/db.ts";
import { semear } from "./db/seed.ts";
import { criarServicoGuia } from "./guia/servico.ts";
import { cacheEmMemoria } from "./cache.ts";
import { classificadorMock } from "./ia/classificador.ts";
import { criarServicoJogo } from "./jogo/servico.ts";
import { criarServicoReciclar } from "./reciclar/servico.ts";
import { bancoNovo } from "./test/pg.ts";
import { foto } from "./test/fotos.ts";
import { xpMock } from "./xp/xp.ts";

let db: Db;
let agora = new Date("2026-11-12T10:00:00-04:00");
const relogio = () => agora;

beforeAll(async () => {
  db = await bancoNovo(30);
  await semear(db, agora);
});
afterAll(async () => db?.fechar());

const respostas = ITENS_JOGO.slice(0, 10).map((i) => ({ itemId: i.id, lixeira: i.lixeira }));

describe("XP diário com partidas simultâneas (critério 7)", () => {
  it("20 rodadas: de 8 partidas enviadas juntas, só uma ganha XP", async () => {
    for (let rodada = 0; rodada < 20; rodada++) {
      agora = new Date(Date.UTC(2026, 11, 1 + rodada, 15)); // um dia novo por rodada
      const xp = xpMock();
      const jogo = criarServicoJogo({ db, xp, agora: relogio, ativo: true });
      const rs = await Promise.all(
        Array.from({ length: 8 }, (_, n) => jogo.registrarPartida("usr_concorrente", { id: `r${rodada}-partida-${n}-xxxxxxxx`, respostas })),
      );
      const comXp = rs.filter((r) => r.ok && r.resposta.xpConcedido > 0);
      expect(comXp, `rodada ${rodada}`).toHaveLength(1);
      expect(rs.every((r) => r.ok)).toBe(true);
      expect(xp.eventos).toHaveLength(1);
    }
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM jogo_xp_diario WHERE usuario_id = 'usr_concorrente'");
    expect(rows[0]?.n).toBe(20);
  });

  it("o mesmo id enviado 6 vezes ao mesmo tempo grava uma partida só", async () => {
    agora = new Date("2027-01-10T12:00:00-04:00");
    const jogo = criarServicoJogo({ db, xp: xpMock(), agora: relogio, ativo: true });
    const rs = await Promise.all(Array.from({ length: 6 }, () => jogo.registrarPartida("usr_repete", { id: "mesma-partida-0000000001", respostas })));
    expect(rs.filter((r) => r.ok && !r.resposta.repetida)).toHaveLength(1);
    expect(rs.every((r) => r.ok && r.resposta.xpConcedido === 20)).toBe(true);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM jogo_partidas WHERE usuario_id = 'usr_repete'");
    expect(rows[0]?.n).toBe(1);
  });
});

describe("limite de fotos com pedidos simultâneos", () => {
  it("12 fotos juntas com limite 5: exatamente 5 chegam à IA", async () => {
    agora = new Date("2027-02-01T09:00:00-04:00");
    let chamadas = 0;
    const mock = classificadorMock();
    const guia = criarServicoGuia({ db, cache: cacheEmMemoria(relogio), agora: relogio });
    const reciclar = criarServicoReciclar({
      db,
      guia,
      agora: relogio,
      limiteFotosDia: 5,
      ia: { nome: "conta", classificar: (b, o) => (chamadas++, mock.classificar(b, o)) },
    });
    const rs = await Promise.all(Array.from({ length: 12 }, () => reciclar.analisar("usr_muitas", foto("lata"))));
    expect(rs.filter((r) => r.ok)).toHaveLength(5);
    expect(rs.filter((r) => !r.ok && r.erro === "limite_diario")).toHaveLength(7);
    expect(chamadas).toBe(5);
  });
});

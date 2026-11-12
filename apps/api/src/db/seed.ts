/**
 * Migração e dados de exemplo.
 *
 * Tabela de valores: v2 e v3, os mesmos valores das entregas de Meus Pontos
 * (v3: plástico 22, papel 11, metal 45, vidro 6 pontos/kg; óleo 25 pontos/litro).
 *
 * Pessoas (tokens de desenvolvimento):
 *  - cidadao-ana     ainda não jogou hoje; tem fotos disponíveis
 *  - cidadao-bruno   já jogou hoje (a próxima partida é "extra")
 *  - cidadao-limite  já usou as 30 fotos de hoje
 */
import { diaEmBoaVista } from "@ecoponto/format";
import type { Db, Executor } from "./db.ts";
import { SCHEMA } from "./schema.ts";

export const TOKENS_DEV: Readonly<Record<string, string>> = {
  "dev-cidadao-ana": "usr_ana",
  "dev-cidadao-bruno": "usr_bruno",
  "dev-cidadao-limite": "usr_limite",
};

export const PESSOAS_DEV: ReadonlyArray<{ pessoa: string; descricao: string }> = [
  { pessoa: "cidadao-ana", descricao: "Ainda não jogou hoje" },
  { pessoa: "cidadao-bruno", descricao: "Já ganhou XP hoje (partida extra)" },
  { pessoa: "cidadao-limite", descricao: "Já usou as 30 fotos de hoje" },
];

type LinhaTabela = readonly [versao: string, vigenteDesde: string, material: string, pontos: number, unidade: "kg" | "litro"];

export const TABELA_SEED: readonly LinhaTabela[] = [
  ["v2", "2026-03-01", "plastico", 20, "kg"],
  ["v2", "2026-03-01", "papel", 10, "kg"],
  ["v2", "2026-03-01", "metal", 40, "kg"],
  ["v2", "2026-03-01", "vidro", 5, "kg"],
  ["v2", "2026-03-01", "oleo", 20, "litro"],
  ["v3", "2026-10-01", "plastico", 22, "kg"],
  ["v3", "2026-10-01", "papel", 11, "kg"],
  ["v3", "2026-10-01", "metal", 45, "kg"],
  ["v3", "2026-10-01", "vidro", 6, "kg"],
  ["v3", "2026-10-01", "oleo", 25, "litro"],
];

export async function migrar(db: Db): Promise<void> {
  await db.executarScript(SCHEMA);
}

async function inserirDados(tx: Executor, agora: Date, limiteFotos: number): Promise<void> {
  for (const [versao, desde, material, pontos, unidade] of TABELA_SEED) {
    await tx.query("INSERT INTO tabela_valores VALUES ($1, $2, $3, $4, $5)", [versao, desde, material, pontos, unidade]);
  }
  const hoje = diaEmBoaVista(agora);
  // Bruno jogou hoje às 08:00 e ganhou XP.
  await tx.query("INSERT INTO jogo_partidas VALUES ($1, $2, $3, 8, 10, 18, $4)", ["seed-bruno-partida-1", "usr_bruno", hoje, agora.toISOString()]);
  await tx.query("INSERT INTO jogo_xp_diario VALUES ($1, $2, $3)", ["usr_bruno", hoje, "seed-bruno-partida-1"]);
  await tx.query("INSERT INTO reciclar_uso VALUES ($1, $2, $3)", ["usr_limite", hoje, limiteFotos]);
}

export async function semear(db: Db, agora: Date, limiteFotos = 30): Promise<void> {
  await migrar(db);
  await db.transacao((tx) => inserirDados(tx, agora, limiteFotos));
}

/** Zera tudo e semeia de novo (testes reaproveitam o mesmo banco). */
export async function ressemear(db: Db, agora: Date, limiteFotos = 30): Promise<void> {
  await migrar(db);
  await db.transacao(async (tx) => {
    await tx.query("TRUNCATE jogo_xp_diario, jogo_partidas, reciclar_uso, tabela_valores");
    await inserirDados(tx, agora, limiteFotos);
  });
}

export { buildApp, type OpcoesApp, type Reportar } from "./app.ts";
export { authDeDesenvolvimento, COOKIE_SESSAO, type AuthPort } from "./auth.ts";
export { cacheEmMemoria, cacheRedis, type CacheTexto } from "./cache.ts";
export { criarDbPg, criarDbPglite, type Db } from "./db/db.ts";
export { migrar, PESSOAS_DEV, ressemear, semear, TABELA_SEED, TOKENS_DEV } from "./db/seed.ts";
export { criarServicoGuia, tabelaVigente, type ServicoGuia } from "./guia/servico.ts";
export { classificadorHttp, classificadorMock, IaIndisponivel, type ClassificadorImagem } from "./ia/classificador.ts";
export { criarServicoJogo, type ServicoJogo } from "./jogo/servico.ts";
export { criarServicoReciclar, LIMITE_FOTOS_DIA_PADRAO, type ServicoReciclar } from "./reciclar/servico.ts";
export { xpMock, type EventoXp, type XpMock, type XpPort } from "./xp/xp.ts";
export type { FastifyInstance } from "fastify";

import { authDeDesenvolvimento, type AuthPort } from "./auth.ts";
import { buildApp, type OpcoesApp } from "./app.ts";
import { cacheEmMemoria } from "./cache.ts";
import { criarDbPglite, type Db } from "./db/db.ts";
import { ressemear, semear, TOKENS_DEV } from "./db/seed.ts";
import { criarServicoGuia } from "./guia/servico.ts";
import { classificadorMock, type ClassificadorImagem } from "./ia/classificador.ts";
import { criarServicoJogo } from "./jogo/servico.ts";
import { criarServicoReciclar } from "./reciclar/servico.ts";
import { xpMock, type XpMock, type XpPort } from "./xp/xp.ts";

/** Data de referência dos mocks em testes (quinta, 10:00 em Boa Vista). */
export const AGORA_MOCK = "2026-11-12T10:00:00-04:00";

export type AppMock = Awaited<ReturnType<typeof buildApp>> & { db: Db; xp: XpMock | XpPort };

/**
 * App com PGlite em memória, dados de exemplo, IA mock e XP mock.
 * Usado nos testes da API e das telas, no `pnpm dev` e na demonstração.
 */
export async function buildAppMock(
  o: {
    agora?: () => Date;
    jogoAtivo?: boolean;
    auth?: AuthPort;
    devLogin?: boolean;
    ia?: ClassificadorImagem;
    xp?: XpPort;
    limiteFotosDia?: number;
    limiarConfianca?: number;
    tempoLimiteIaMs?: number;
    /** Banco já criado (os testes reaproveitam um por arquivo; não é fechado aqui). */
    db?: Db;
  } & Pick<OpcoesApp, "logger" | "reportar"> = {},
): Promise<AppMock> {
  const agora = o.agora ?? (() => new Date(AGORA_MOCK));
  const proprio = !o.db;
  const db = o.db ?? (await criarDbPglite());
  const limite = o.limiteFotosDia ?? 30;
  await (proprio ? semear(db, agora(), limite) : ressemear(db, agora(), limite));
  const xp = o.xp ?? xpMock();
  const guia = criarServicoGuia({ db, cache: cacheEmMemoria(agora), agora });
  const app = await buildApp({
    auth: o.auth ?? authDeDesenvolvimento(TOKENS_DEV),
    guia,
    reciclar: criarServicoReciclar({
      db,
      guia,
      ia: o.ia ?? classificadorMock(),
      agora,
      limiteFotosDia: limite,
      ...(o.limiarConfianca === undefined ? {} : { limiarConfianca: o.limiarConfianca }),
      ...(o.tempoLimiteIaMs === undefined ? {} : { tempoLimiteIaMs: o.tempoLimiteIaMs }),
    }),
    jogo: criarServicoJogo({ db, xp, agora, ativo: o.jogoAtivo ?? true, ...(o.reportar ? { reportar: o.reportar } : {}) }),
    devLogin: o.devLogin === false ? undefined : { tokens: TOKENS_DEV },
    logger: o.logger,
    reportar: o.reportar,
  });
  if (proprio) app.addHook("onClose", () => db.fechar());
  return Object.assign(app, { db, xp });
}

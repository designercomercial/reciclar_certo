/**
 * Função da Vercel (API em /api/*).
 *
 * - Com DATABASE_URL (ex.: Neon): PostgreSQL de verdade. Cria as tabelas e,
 *   se estiverem vazias, semeia os dados de exemplo.
 * - Sem DATABASE_URL: DEMONSTRAÇÃO com PGlite em memória (os dados voltam ao
 *   inicial a cada partida a frio da função).
 *
 * Autenticação: PENDENTE (sessão do app SASI). Na demonstração, todo visitante
 * entra como a pessoa de exemplo "cidadao-ana" (ECO_PESSOA muda).
 * Jogo ligado na demonstração (ECO_JOGO_SEPARACAO=0 desliga).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.ts";
import type { AuthPort } from "./auth.ts";
import { cacheEmMemoria, cacheRedis } from "./cache.ts";
import { lerConfig } from "./config.ts";
import { criarDbPg, criarDbPglite } from "./db/db.ts";
import { migrar, semear, TOKENS_DEV } from "./db/seed.ts";
import { criarServicoGuia } from "./guia/servico.ts";
import { criarServicoJogo } from "./jogo/servico.ts";
import { criarServicoReciclar } from "./reciclar/servico.ts";
import { xpMock } from "./xp/xp.ts";

const pessoa = process.env.ECO_PESSOA ?? "cidadao-ana";
const usuario = TOKENS_DEV[`dev-${pessoa}`];
if (!usuario) throw new Error(`Pessoa de exemplo ${pessoa} não existe.`);
const auth: AuthPort = { autenticar: async () => ({ usuarioId: usuario }) };

const pronto = (async () => {
  const agora = () => new Date();
  const config = lerConfig(process.env, { jogo: true });
  const url = process.env.DATABASE_URL;
  const db = url ? await criarDbPg(url, 3) : await criarDbPglite();
  if (url) {
    await migrar(db);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM tabela_valores");
    if (rows[0]?.n === 0) await semear(db, agora(), config.limiteFotosDia);
  } else {
    await semear(db, agora(), config.limiteFotosDia);
  }
  const cache = process.env.REDIS_URL ? await cacheRedis(process.env.REDIS_URL) : cacheEmMemoria(agora);
  const guia = criarServicoGuia({ db, cache, agora });
  const app = await buildApp({
    auth,
    guia,
    reciclar: criarServicoReciclar({ db, guia, ia: config.ia, agora, limiteFotosDia: config.limiteFotosDia, limiarConfianca: config.limiarConfianca }),
    jogo: criarServicoJogo({ db, xp: xpMock(), agora, ativo: config.jogoAtivo, regraXp: config.regraXp }),
    logger: true,
  });
  await app.ready();
  return app;
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await pronto;
  app.server.emit("request", req, res);
}

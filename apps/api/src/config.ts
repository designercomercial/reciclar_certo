/**
 * Configuração por variável de ambiente (servidor e função da Vercel).
 *
 *   ECO_JOGO_SEPARACAO=1           liga o Jogo da Separação (Fase 3). Desligado: a aba some.
 *   ECO_LIMITE_FOTOS_DIA=30        [DEFINIR] fotos por cidadão por dia no "Posso levar?"
 *   ECO_LIMIAR_CONFIANCA=0.7       [DEFINIR] abaixo disto, "Não temos certeza."
 *   ECO_JOGO_XP_BASE=10            [DEFINIR] XP da primeira partida do dia...
 *   ECO_JOGO_XP_POR_ACERTO=1       ...mais isto por acerto...
 *   ECO_JOGO_XP_MAXIMO=20          ...até este máximo.
 *   ECO_IA_URL / ECO_IA_CHAVE      IA real (adaptador HTTP). Sem eles: IA mock.
 *   ECO_IA_MOCK_ATRASO_MS=700      atraso simulado da IA mock.
 */
import { LIMIAR_CONFIANCA_PADRAO, REGRA_XP_PADRAO, type RegraXp } from "@ecoponto/regras";
import { classificadorHttp, classificadorMock, type ClassificadorImagem } from "./ia/classificador.ts";
import { LIMITE_FOTOS_DIA_PADRAO } from "./reciclar/servico.ts";

const num = (v: string | undefined, padrao: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : padrao;
};

export type Config = {
  jogoAtivo: boolean;
  limiteFotosDia: number;
  limiarConfianca: number;
  regraXp: RegraXp;
  ia: ClassificadorImagem;
};

export function lerConfig(env: NodeJS.ProcessEnv, extra: { jogo?: boolean } = {}): Config {
  const ia =
    env.ECO_IA_URL && env.ECO_IA_CHAVE
      ? classificadorHttp(env.ECO_IA_URL, env.ECO_IA_CHAVE)
      : classificadorMock({ atrasoMs: num(env.ECO_IA_MOCK_ATRASO_MS, 700) });
  return {
    jogoAtivo: env.ECO_JOGO_SEPARACAO === "1" || (env.ECO_JOGO_SEPARACAO !== "0" && extra.jogo === true),
    limiteFotosDia: num(env.ECO_LIMITE_FOTOS_DIA, LIMITE_FOTOS_DIA_PADRAO),
    limiarConfianca: num(env.ECO_LIMIAR_CONFIANCA, LIMIAR_CONFIANCA_PADRAO),
    regraXp: {
      base: num(env.ECO_JOGO_XP_BASE, REGRA_XP_PADRAO.base),
      porAcerto: num(env.ECO_JOGO_XP_POR_ACERTO, REGRA_XP_PADRAO.porAcerto),
      maximo: num(env.ECO_JOGO_XP_MAXIMO, REGRA_XP_PADRAO.maximo),
    },
    ia,
  };
}

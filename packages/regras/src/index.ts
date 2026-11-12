export { buscarNoGuia, itemPorId, normalizar, palavras, type ItemEncontrado } from "./busca.ts";
export { LIMIAR_CONFIANCA_PADRAO, mapearResultado, resolverRotulo, type Rotulo } from "./analise.ts";
export {
  calcularXp,
  corrigirPartida,
  itemDoJogo,
  ITENS_JOGO,
  ITENS_POR_PARTIDA,
  REGRA_XP_PADRAO,
  sortearItens,
  type Correcao,
  type ItemJogo,
  type RegraXp,
} from "./jogo.ts";
export { CONTEUDO_ATUALIZADO_EM, CONTEUDO_GUIA, type ConteudoCategoria } from "./conteudo.ts";
export { montarGuia, type ValoresTabela } from "./guia.ts";

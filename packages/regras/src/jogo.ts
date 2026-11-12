/**
 * Jogo da Separação (T45): itens, gabarito, correção e XP.
 *
 * O gabarito é público (o jogo é educativo e a tela mostra a resposta certa a
 * cada jogada). O servidor corrige de novo e decide o XP: o aparelho nunca
 * diz quantos pontos de XP ganhou.
 */
import type { Lixeira, Resposta } from "@ecoponto/contracts";

export type ItemJogo = { id: string; nome: string; lixeira: Lixeira };

export const ITENS_JOGO: readonly ItemJogo[] = [
  // Papel (azul)
  { id: "jornal", nome: "Jornal", lixeira: "papel" },
  { id: "caixa-papelao", nome: "Caixa de papelão", lixeira: "papel" },
  { id: "revista", nome: "Revista", lixeira: "papel" },
  { id: "folha-caderno", nome: "Folha de caderno", lixeira: "papel" },
  { id: "envelope", nome: "Envelope", lixeira: "papel" },
  { id: "caixa-cereal", nome: "Caixa de cereal", lixeira: "papel" },
  // Plástico (vermelho)
  { id: "garrafa-pet", nome: "Garrafa PET", lixeira: "plastico" },
  { id: "pote-margarina", nome: "Pote de margarina", lixeira: "plastico" },
  { id: "sacola-plastica", nome: "Sacola plástica", lixeira: "plastico" },
  { id: "frasco-xampu", nome: "Frasco de xampu", lixeira: "plastico" },
  { id: "embalagem-detergente", nome: "Embalagem de detergente", lixeira: "plastico" },
  // Vidro (verde)
  { id: "pote-vidro", nome: "Pote de vidro", lixeira: "vidro" },
  { id: "garrafa-vidro", nome: "Garrafa de vidro", lixeira: "vidro" },
  { id: "pote-palmito", nome: "Pote de palmito", lixeira: "vidro" },
  { id: "frasco-perfume", nome: "Frasco de perfume vazio", lixeira: "vidro" },
  // Metal (amarelo)
  { id: "lata-refrigerante", nome: "Lata de refrigerante", lixeira: "metal" },
  { id: "lata-sardinha", nome: "Lata de sardinha", lixeira: "metal" },
  { id: "lata-leite-po", nome: "Lata de leite em pó", lixeira: "metal" },
  { id: "tampinha-metal", nome: "Tampinha de metal", lixeira: "metal" },
  { id: "papel-aluminio", nome: "Papel alumínio limpo", lixeira: "metal" },
  // Orgânico (marrom)
  { id: "casca-banana", nome: "Casca de banana", lixeira: "organico" },
  { id: "casca-fruta", nome: "Casca de fruta", lixeira: "organico" },
  { id: "casca-ovo", nome: "Casca de ovo", lixeira: "organico" },
  { id: "borra-cafe", nome: "Borra de café", lixeira: "organico" },
  { id: "resto-comida", nome: "Resto de comida", lixeira: "organico" },
  // Não reciclável (cinza)
  { id: "papel-higienico", nome: "Papel higiênico usado", lixeira: "nao_reciclavel" },
  { id: "fralda", nome: "Fralda descartável", lixeira: "nao_reciclavel" },
  { id: "guardanapo-sujo", nome: "Guardanapo sujo", lixeira: "nao_reciclavel" },
  { id: "esponja-cozinha", nome: "Esponja de cozinha", lixeira: "nao_reciclavel" },
  { id: "bituca", nome: "Bituca de cigarro", lixeira: "nao_reciclavel" },
];

const POR_ID = new Map(ITENS_JOGO.map((i) => [i.id, i]));

export function itemDoJogo(id: string): ItemJogo | undefined {
  return POR_ID.get(id);
}

/** [DEFINIR] Itens por partida. A especificação fala em 10. */
export const ITENS_POR_PARTIDA = 10;

/**
 * Sorteia n itens diferentes, com pelo menos um de cada lixeira quando n ≥ 6
 * (para a partida passar por todas as cores).
 */
export function sortearItens(n = ITENS_POR_PARTIDA, aleatorio: () => number = Math.random): ItemJogo[] {
  const embaralhar = <T>(xs: T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const todos = embaralhar([...ITENS_JOGO]);
  const escolhidos: ItemJogo[] = [];
  if (n >= 6) {
    const lixeiras = new Set<Lixeira>();
    for (const i of todos) {
      if (!lixeiras.has(i.lixeira)) {
        lixeiras.add(i.lixeira);
        escolhidos.push(i);
      }
    }
  }
  for (const i of todos) {
    if (escolhidos.length >= n) break;
    if (!escolhidos.includes(i)) escolhidos.push(i);
  }
  return embaralhar(escolhidos.slice(0, n));
}

export type Correcao = { ok: true; acertos: number; total: number } | { ok: false };

/** Confere as respostas pelo gabarito. Partida malformada → { ok: false }. */
export function corrigirPartida(respostas: readonly Resposta[], itensPorPartida = ITENS_POR_PARTIDA): Correcao {
  if (respostas.length !== itensPorPartida) return { ok: false };
  const ids = new Set<string>();
  let acertos = 0;
  for (const r of respostas) {
    const item = POR_ID.get(r.itemId);
    if (!item || ids.has(r.itemId)) return { ok: false };
    ids.add(r.itemId);
    if (item.lixeira === r.lixeira) acertos++;
  }
  return { ok: true, acertos, total: respostas.length };
}

/** [DEFINIR] XP da primeira partida do dia. Padrão: 10 por jogar + 1 por acerto, até 20. */
export type RegraXp = { base: number; porAcerto: number; maximo: number };
export const REGRA_XP_PADRAO: RegraXp = { base: 10, porAcerto: 1, maximo: 20 };

export function calcularXp(acertos: number, regra: RegraXp = REGRA_XP_PADRAO): number {
  return Math.max(0, Math.min(regra.maximo, regra.base + acertos * regra.porAcerto));
}

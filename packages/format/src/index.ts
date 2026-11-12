/**
 * Formatação pt-BR e rótulos para a tela.
 *
 * Nada aqui calcula pontos, XP ou resultado: só transforma o que o servidor
 * mandou em texto. Datas sempre no fuso de Boa Vista.
 */
import type { CategoriaGuia, Lixeira, Material, Unidade, ValorVigente } from "@ecoponto/contracts";

export const FUSO = "America/Boa_Vista";

/** Sinal de menos tipográfico (U+2212), não hífen. */
export const MENOS = "−";

/**
 * 1250 → "1.250". Agrupa à mão porque o ICU em pt-BR não separa números de
 * 4 dígitos ("1250").
 */
export function formatInteiro(n: number): string {
  if (!Number.isFinite(n)) return "";
  const agrupado = String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? MENOS : "") + agrupado;
}

/** 1250 → "1.250 pontos"; 1 → "1 ponto". */
export function formatPontos(pontos: number): string {
  return `${formatInteiro(pontos)} ${Math.abs(pontos) === 1 ? "ponto" : "pontos"}`;
}

const UNIDADE: Readonly<Record<Unidade, string>> = { kg: "kg", litro: "litro" };

/** {45, kg} → "45 pontos por kg". */
export function formatValor(v: ValorVigente): string {
  return `${formatPontos(v.pontos)} por ${UNIDADE[v.unidade]}`;
}

/** 0.92 → "92%". */
export function formatPercentual(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// ---------------------------------------------------------------------------
// Datas (fuso de Boa Vista)
// ---------------------------------------------------------------------------

type Partes = { ano: string; mes: string; dia: string; hora: string; minuto: string };

const partesFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function partes(data: string | Date): Partes {
  const p: Record<string, string> = {};
  for (const { type, value } of partesFmt.formatToParts(new Date(data))) p[type] = value;
  return { ano: p.year ?? "", mes: p.month ?? "", dia: p.day ?? "", hora: p.hour ?? "", minuto: p.minute ?? "" };
}

/** Dia em Boa Vista, "AAAA-MM-DD". Base do XP diário. */
export function diaEmBoaVista(data: Date): string {
  const p = partes(data);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** → "15/12/2026". */
export function formatData(iso: string): string {
  const p = partes(iso);
  return `${p.dia}/${p.mes}/${p.ano}`;
}

/** "2026-10-01" (data sem hora) → "01/10/2026", sem passar por fuso. */
export function formatDataSimples(aaaaMmDd: string): string {
  const [a, m, d] = aaaaMmDd.split("-");
  return `${d}/${m}/${a}`;
}

/** → "11/11 às 14:32". */
export function formatDiaHora(iso: string): string {
  const p = partes(iso);
  return `${p.dia}/${p.mes} às ${p.hora}:${p.minuto}`;
}

// ---------------------------------------------------------------------------
// Rótulos e ícones
// ---------------------------------------------------------------------------

/** Nomes de ícones Lucide usados nos rótulos (a web mapeia nome → SVG). */
export type NomeIcone =
  | "milk"
  | "newspaper"
  | "cylinder"
  | "wine"
  | "droplets"
  | "ban"
  | "apple"
  | "trash-2";

export const MATERIAL_NOME: Readonly<Record<Material, string>> = {
  plastico: "Plástico",
  papel: "Papel",
  metal: "Metal",
  vidro: "Vidro",
  oleo: "Óleo de cozinha",
};

export const CATEGORIA_GUIA: Readonly<Record<CategoriaGuia, { rotulo: string; icone: NomeIcone }>> = {
  plastico: { rotulo: "Plástico", icone: "milk" },
  papel: { rotulo: "Papel", icone: "newspaper" },
  metal: { rotulo: "Metal", icone: "cylinder" },
  vidro: { rotulo: "Vidro", icone: "wine" },
  oleo: { rotulo: "Óleo de cozinha", icone: "droplets" },
  nao_aceitos: { rotulo: "Não aceitos", icone: "ban" },
};

/**
 * Lixeiras da coleta seletiva (padrão nacional, Resolução Conama 275/2001).
 * Sempre com nome e ícone: a cor nunca é a única informação.
 */
export const LIXEIRA: Readonly<Record<Lixeira, { nome: string; cor: string; icone: NomeIcone }>> = {
  papel: { nome: "Papel", cor: "azul", icone: "newspaper" },
  plastico: { nome: "Plástico", cor: "vermelha", icone: "milk" },
  vidro: { nome: "Vidro", cor: "verde", icone: "wine" },
  metal: { nome: "Metal", cor: "amarela", icone: "cylinder" },
  organico: { nome: "Orgânico", cor: "marrom", icone: "apple" },
  nao_reciclavel: { nome: "Não reciclável", cor: "cinza", icone: "trash-2" },
};

/** "Pote de vidro vai na lixeira verde." */
export function explicacaoLixeira(nomeItem: string, lixeira: Lixeira): string {
  return `${nomeItem} vai na lixeira ${LIXEIRA[lixeira].cor}.`;
}

/**
 * Busca do guia de materiais. Pura: roda no aparelho (funciona offline) e no
 * servidor (para ligar o rótulo da IA a um item do guia).
 *
 * - Ignora acentos, maiúsculas e pontuação ("Óleo" = "oleo").
 * - Entende sinônimos cadastrados ("pet" → garrafa PET, "longa vida" → caixa de leite).
 * - Tolera plural simples ("latas" → "lata") e palavras de ligação ("de", "da").
 */
import type { CategoriaDoGuia, Guia, ItemAceito, ItemNaoAceito } from "@ecoponto/contracts";

const LIGACAO = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "a", "o", "em", "no", "na"]);

/** "Óleo de Cozinha!" → "oleo de cozinha". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Plural simples do português: latas → lata, papeis → papel, potes → pote. */
function singular(p: string): string {
  if (p.length <= 3) return p;
  if (p.endsWith("eis")) return `${p.slice(0, -3)}el`;
  if (p.endsWith("oes") || p.endsWith("aes")) return `${p.slice(0, -3)}ao`;
  if (p.endsWith("res") || p.endsWith("zes")) return p.slice(0, -2);
  if (p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export function palavras(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p && !LIGACAO.has(p))
    .map(singular);
}

export type ItemEncontrado =
  | { tipo: "aceito"; categoria: CategoriaDoGuia; item: ItemAceito; pontuacao: number }
  | { tipo: "nao_aceito"; categoria: CategoriaDoGuia; item: ItemNaoAceito; pontuacao: number };

type Entrada = {
  tipo: "aceito" | "nao_aceito";
  categoria: CategoriaDoGuia;
  item: ItemAceito | ItemNaoAceito;
  /** Nome e sinônimos, já normalizados e em palavras. */
  formas: string[][];
  categoriaPalavras: string[];
};

const indices = new WeakMap<Guia, Entrada[]>();

function indice(guia: Guia): Entrada[] {
  let idx = indices.get(guia);
  if (idx) return idx;
  idx = [];
  for (const categoria of guia.categorias) {
    const categoriaPalavras = palavras(categoria.nome);
    const add = (tipo: Entrada["tipo"], item: ItemAceito | ItemNaoAceito) =>
      idx!.push({ tipo, categoria, item, formas: [item.nome, ...item.sinonimos].map(palavras), categoriaPalavras });
    categoria.aceitos.forEach((i) => add("aceito", i));
    categoria.naoAceitos.forEach((i) => add("nao_aceito", i));
  }
  indices.set(guia, idx);
  return idx;
}

/** Quão bem as palavras da busca batem com uma forma do item (0 = nada). */
function pontuar(busca: string[], forma: string[]): number {
  if (busca.length === 0 || forma.length === 0) return 0;
  const juntaB = busca.join(" ");
  const juntaF = forma.join(" ");
  if (juntaB === juntaF) return 100;
  // Toda palavra da busca é início de alguma palavra do item.
  const todas = busca.every((b) => forma.some((f) => f.startsWith(b)));
  if (todas) {
    const cobertura = busca.length / forma.length; // "garrafa pet" cobre mais que "garrafa"
    return juntaF.startsWith(juntaB) ? 80 + 10 * cobertura : 60 + 10 * cobertura;
  }
  // Parte das palavras bate (ex.: "garrafa de vinho" ~ "garrafa de vidro").
  const batem = busca.filter((b) => b.length >= 3 && forma.some((f) => f.startsWith(b))).length;
  return batem > 0 ? 20 * (batem / busca.length) : 0;
}

/**
 * Itens do guia que batem com o termo, do mais relevante ao menos.
 * Termo vazio: lista vazia (a tela mostra as categorias).
 */
export function buscarNoGuia(guia: Guia, termo: string, minimo = 30): ItemEncontrado[] {
  const busca = palavras(termo);
  if (busca.length === 0) return [];
  const out: ItemEncontrado[] = [];
  for (const e of indice(guia)) {
    let p = Math.max(...e.formas.map((f) => pontuar(busca, f)));
    // "metal", "plástico": todos os itens da categoria, abaixo dos nomes exatos.
    if (p < 50 && busca.every((b) => e.categoriaPalavras.some((c) => c.startsWith(b)))) p = 50;
    if (p >= minimo) out.push({ tipo: e.tipo, categoria: e.categoria, item: e.item, pontuacao: p } as ItemEncontrado);
  }
  return out.sort((a, b) => b.pontuacao - a.pontuacao || a.item.nome.localeCompare(b.item.nome, "pt-BR"));
}

/** Item do guia por id. */
export function itemPorId(guia: Guia, id: string): ItemEncontrado | null {
  const e = indice(guia).find((x) => x.item.id === id);
  return e ? ({ tipo: e.tipo, categoria: e.categoria, item: e.item, pontuacao: 100 } as ItemEncontrado) : null;
}

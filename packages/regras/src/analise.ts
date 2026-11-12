/**
 * Mapeamento do que a IA respondeu para o resultado da tela (T21).
 *
 * A IA devolve rótulos com confiança ("lata de aluminio", 0,94). Aqui cada
 * rótulo é ligado a um item do guia, e o guia decide:
 *   - item aceito, com confiança ≥ limiar        → "aceito" (preparo e estimativa da tabela vigente)
 *   - item não aceito, com confiança ≥ limiar    → "nao_aceito" (motivo e onde descartar)
 *   - confiança < limiar, ou rótulo fora do guia → "incerto" (2 sugestões mais prováveis)
 *
 * A IA nunca decide sozinha se o ecoponto recebe: quem decide é o guia.
 */
import type { Analise, Guia, Sugestao } from "@ecoponto/contracts";
import { MATERIAL_NOME } from "@ecoponto/format";
import { buscarNoGuia, itemPorId, type ItemEncontrado } from "./busca.ts";

/** [DEFINIR] Abaixo disto, "Não temos certeza." Padrão adotado: 70%. */
export const LIMIAR_CONFIANCA_PADRAO = 0.7;

export type Rotulo = { rotulo: string; confianca: number };

/** Rótulo da IA → item do guia (pelo id, ou pela busca, se for texto livre). */
export function resolverRotulo(guia: Guia, rotulo: string): ItemEncontrado | null {
  const porId = itemPorId(guia, rotulo);
  if (porId) return porId;
  const [melhor] = buscarNoGuia(guia, rotulo, 60);
  return melhor ?? null;
}

const arred = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;

export function mapearResultado(rotulos: readonly Rotulo[], guia: Guia, limiar = LIMIAR_CONFIANCA_PADRAO): Analise {
  const ordenados = [...rotulos]
    .filter((r) => Number.isFinite(r.confianca))
    .sort((a, b) => b.confianca - a.confianca);

  const resolvidos: Array<{ r: Rotulo; e: ItemEncontrado | null }> = ordenados.map((r) => ({ r, e: resolverRotulo(guia, r.rotulo) }));
  const topo = resolvidos[0];

  const sugestoes = (): Sugestao[] => {
    const vistos = new Set<string>();
    const out: Sugestao[] = [];
    for (const { e } of resolvidos) {
      if (!e || vistos.has(e.item.id)) continue;
      vistos.add(e.item.id);
      out.push({ id: e.item.id, nome: e.item.nome, categoria: e.tipo === "aceito" ? e.categoria.id : "nao_aceitos" });
      if (out.length === 2) break;
    }
    return out;
  };

  if (!topo || !topo.e || topo.r.confianca < limiar) {
    return { resultado: "incerto", confianca: arred(topo?.r.confianca ?? 0), sugestoes: sugestoes() };
  }

  const { e, r } = topo;
  const confianca = arred(r.confianca);
  if (e.tipo === "nao_aceito") {
    return {
      resultado: "nao_aceito",
      confianca,
      item: { id: e.item.id, nome: e.item.nome },
      motivo: e.item.motivo,
      ondeDescartar: e.item.ondeDescartar,
    };
  }

  const { categoria, item } = e;
  if (!categoria.material || !categoria.valor) {
    // Item "aceito" numa categoria sem valor na tabela: não dá para estimar.
    return { resultado: "incerto", confianca, sugestoes: sugestoes() };
  }
  return {
    resultado: "aceito",
    confianca,
    item: { id: item.id, nome: item.nome },
    material: categoria.material,
    materialNome: MATERIAL_NOME[categoria.material],
    preparo: item.dica ? [item.dica, ...categoria.preparo] : [...categoria.preparo],
    estimativa: categoria.valor,
    tabela: guia.tabela,
  };
}

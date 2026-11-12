/**
 * Junta o conteúdo do guia com a tabela de valores vigente (T29).
 * Os pontos vêm SEMPRE da tabela: o conteúdo não tem número nenhum.
 */
import type { Guia, Material, ValorVigente, VersaoTabela } from "@ecoponto/contracts";
import type { ConteudoCategoria } from "./conteudo.ts";

export type ValoresTabela = { versao: VersaoTabela; valores: Readonly<Partial<Record<Material, ValorVigente>>> };

export function montarGuia(conteudo: readonly ConteudoCategoria[], tabela: ValoresTabela, atualizadoEm: string): Guia {
  return {
    tabela: tabela.versao,
    atualizadoEm,
    categorias: conteudo
      // Material sem valor na tabela vigente não aparece como aceito.
      .filter((c) => c.material === null || tabela.valores[c.material])
      .map((c) => ({ ...c, valor: c.material ? (tabela.valores[c.material] ?? null) : null })),
  };
}

/**
 * Guia de materiais: conteúdo (packages/regras/conteudo.ts) + tabela de
 * valores vigente no dia, em Boa Vista. Cache de 60 s (Redis ou memória).
 */
import { Guia, type Material, type ValorVigente } from "@ecoponto/contracts";
import { diaEmBoaVista } from "@ecoponto/format";
import { CONTEUDO_ATUALIZADO_EM, CONTEUDO_GUIA, montarGuia, type ValoresTabela } from "@ecoponto/regras";
import type { CacheTexto } from "../cache.ts";
import type { Executor } from "../db/db.ts";

export const TTL_GUIA_MS = 60_000;

type LinhaValor = { versao: string; vigente_desde: string; material: Material; pontos: number; unidade: "kg" | "litro" };

/** Versão da tabela vigente no dia (a mais recente com vigente_desde ≤ dia). */
export async function tabelaVigente(db: Executor, dia: string): Promise<ValoresTabela | null> {
  const { rows } = await db.query<LinhaValor>(
    `SELECT versao, to_char(vigente_desde, 'YYYY-MM-DD') AS vigente_desde, material, pontos, unidade
       FROM tabela_valores
      WHERE versao = (SELECT versao FROM tabela_valores WHERE vigente_desde <= $1::date
                       ORDER BY vigente_desde DESC LIMIT 1)`,
    [dia],
  );
  const primeira = rows[0];
  if (!primeira) return null;
  const valores: Partial<Record<Material, ValorVigente>> = {};
  for (const r of rows) valores[r.material] = { pontos: r.pontos, unidade: r.unidade };
  return { versao: { versao: primeira.versao, vigenteDesde: primeira.vigente_desde }, valores };
}

export type ServicoGuia = { guia(): Promise<Guia | null> };

export function criarServicoGuia(o: { db: Executor; cache: CacheTexto; agora: () => Date }): ServicoGuia {
  return {
    async guia() {
      const dia = diaEmBoaVista(o.agora());
      const chave = `guia:${dia}`;
      const emCache = await o.cache.ler(chave);
      if (emCache) {
        const v = Guia.safeParse(JSON.parse(emCache));
        if (v.success) return v.data;
      }
      const tabela = await tabelaVigente(o.db, dia);
      if (!tabela) return null;
      const g = montarGuia(CONTEUDO_GUIA, tabela, CONTEUDO_ATUALIZADO_EM);
      await o.cache.gravar(chave, JSON.stringify(g), TTL_GUIA_MS);
      return g;
    },
  };
}

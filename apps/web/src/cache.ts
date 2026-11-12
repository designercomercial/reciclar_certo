/**
 * Dados guardados no aparelho para funcionar sem internet.
 *
 * Só dados públicos: o guia (com a data em que foi baixado, para o aviso
 * "Guia de [data]") e se o jogo está ligado. Nenhuma foto, nenhum dado pessoal.
 * Tudo é revalidado pelo contrato ao ler; entrada inválida é descartada.
 */
import type { Esquema } from "@ecoponto/contracts";

const PREFIXO = "eco-reciclar:v1:";

export type Entrada<T> = { dados: T; salvoEm: string };

export type Cache = {
  ler<T>(chave: string, schema: Esquema<T>): Entrada<T> | null;
  salvar<T>(chave: string, dados: T): void;
};

export function criarCache(storage: Storage | null, agora: () => Date): Cache {
  const seguro = <T>(fn: () => T, padrao: T): T => {
    if (!storage) return padrao;
    try {
      return fn();
    } catch {
      return padrao;
    }
  };
  return {
    ler(chave, schema) {
      return seguro(() => {
        const bruto = storage!.getItem(PREFIXO + chave);
        if (!bruto) return null;
        const obj = JSON.parse(bruto) as { dados?: unknown; salvoEm?: unknown };
        const r = schema.safeParse(obj.dados);
        if (!r.success || typeof obj.salvoEm !== "string") {
          storage!.removeItem(PREFIXO + chave);
          return null;
        }
        return { dados: r.data, salvoEm: obj.salvoEm };
      }, null);
    },
    salvar(chave, dados) {
      seguro(() => storage!.setItem(PREFIXO + chave, JSON.stringify({ dados, salvoEm: agora().toISOString() })), undefined);
    },
  };
}

/**
 * Cache curto de textos (guia montado). Redis com REDIS_URL; senão, memória.
 * Só guarda dados públicos (o guia). Nada de usuário, nada de imagem.
 */

export interface CacheTexto {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string, ttlMs: number): Promise<void>;
}

export function cacheEmMemoria(agora: () => Date): CacheTexto {
  const m = new Map<string, { valor: string; ate: number }>();
  return {
    async ler(chave) {
      const e = m.get(chave);
      if (!e || e.ate <= agora().getTime()) return null;
      return e.valor;
    },
    async gravar(chave, valor, ttlMs) {
      m.set(chave, { valor, ate: agora().getTime() + ttlMs });
    },
  };
}

export async function cacheRedis(url: string): Promise<CacheTexto> {
  const { Redis } = await import("ioredis");
  const r = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
  r.on("error", () => {});
  const PREFIXO = "eco:reciclar:";
  return {
    async ler(chave) {
      try {
        return await r.get(PREFIXO + chave);
      } catch {
        return null; // Redis fora: lê do banco.
      }
    },
    async gravar(chave, valor, ttlMs) {
      try {
        await r.set(PREFIXO + chave, valor, "PX", ttlMs);
      } catch {
        /* sem cache, segue */
      }
    },
  };
}

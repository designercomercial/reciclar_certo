/**
 * Camada da IA de imagem, no servidor.
 *
 * A IA do app do atendente (T07/T14) ainda não existe no repositório. Esta
 * porta é o ponto único de troca: quando a IA real estiver disponível,
 * escreva um adaptador que implemente `ClassificadorImagem` e ligue em
 * `server.ts` (ver README). A chave da IA fica só no servidor.
 *
 * Regras para qualquer adaptador:
 *  - recebe SÓ os bytes da imagem (sem metadados, ver jpeg.ts): nenhum dado
 *    pessoal, id de usuário ou localização vai para a IA;
 *  - não grava a imagem em lugar nenhum;
 *  - respeita o `signal` (tempo esgotado → cancela a chamada).
 */
import { createHash } from "node:crypto";
import type { Rotulo } from "@ecoponto/regras";
import { EXEMPLOS_MOCK } from "./exemplos.gerado.ts";

export interface ClassificadorImagem {
  readonly nome: string;
  /** Rótulos com confiança (0 a 1). Rótulo = id do guia ou texto livre ("lata de alumínio"). */
  classificar(imagem: Uint8Array, opts: { signal: AbortSignal }): Promise<Rotulo[]>;
}

export class IaIndisponivel extends Error {
  constructor(motivo: string) {
    super(`IA indisponível: ${motivo}`);
  }
}

function esperar(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((ok, falha) => {
    if (signal.aborted) return falha(signal.reason);
    const t = setTimeout(ok, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        falha(signal.reason);
      },
      { once: true },
    );
  });
}

export type OpcoesMock = {
  /** Atraso simulado de cada análise (ms). Padrão: 0. */
  atrasoMs?: number;
};

/**
 * IA mock. Reconhece as fotos de exemplo (apps/web/public/exemplos) pelo hash
 * do conteúdo e responde como a IA real responderia. Qualquer outra foto
 * volta com confiança baixa ("Não temos certeza.").
 */
export function classificadorMock(o: OpcoesMock = {}): ClassificadorImagem {
  return {
    nome: "mock",
    async classificar(imagem, { signal }) {
      const hash = createHash("sha256").update(imagem).digest("hex");
      const ex = EXEMPLOS_MOCK[hash];
      await esperar(ex?.atrasoMs ?? o.atrasoMs ?? 0, signal);
      if (ex?.falha) throw new IaIndisponivel("falha simulada");
      return ex ? ex.rotulos.map((r) => ({ ...r })) : [{ rotulo: "objeto", confianca: 0.22 }];
    },
  };
}

/**
 * [DEFINIR com o T07/T14] Adaptador HTTP genérico para a IA real.
 * Envia a imagem como image/jpeg e espera `{ rotulos: [{ rotulo, confianca }] }`.
 * Ajuste ao contrato real quando a IA do atendente existir.
 */
export function classificadorHttp(url: string, chave: string, fetcher: typeof fetch = fetch): ClassificadorImagem {
  return {
    nome: "http",
    async classificar(imagem, { signal }) {
      let res: Response;
      try {
        res = await fetcher(url, {
          method: "POST",
          headers: { "content-type": "image/jpeg", authorization: `Bearer ${chave}` },
          // Mesma memória (sem cópia), para o zerar depois da resposta valer também aqui.
          body: new Uint8Array(imagem.buffer as ArrayBuffer, imagem.byteOffset, imagem.byteLength),
          signal,
        });
      } catch (e) {
        if (signal.aborted) throw e;
        throw new IaIndisponivel("rede");
      }
      if (!res.ok) throw new IaIndisponivel(`HTTP ${res.status}`);
      const corpo = (await res.json()) as { rotulos?: unknown };
      if (!Array.isArray(corpo.rotulos)) throw new IaIndisponivel("resposta inválida");
      return corpo.rotulos.flatMap((r: unknown) => {
        const x = r as { rotulo?: unknown; confianca?: unknown };
        return typeof x.rotulo === "string" && typeof x.confianca === "number" ? [{ rotulo: x.rotulo, confianca: x.confianca }] : [];
      });
    },
  };
}

/** Hash usado pelo mock (o gerador de fotos de exemplo usa o mesmo). */
export function hashImagem(imagem: Uint8Array): string {
  return createHash("sha256").update(imagem).digest("hex");
}

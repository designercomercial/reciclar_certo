/**
 * "Posso levar?" (T21): da foto ao resultado.
 *
 *  1. Confere se é JPEG e tira os metadados (EXIF com GPS, IPTC, comentários).
 *  2. Conta a foto no limite do dia (cidadão + dia em Boa Vista), num único
 *     comando atômico. Passou do limite: não chama a IA.
 *  3. Chama a IA com tempo limite (padrão 4,5 s; o aparelho desiste em 5 s).
 *  4. Liga o que a IA disse ao guia (mapearResultado) com a tabela vigente.
 *  5. SEMPRE, com sucesso ou erro: zera os bytes da imagem na memória.
 *
 * A imagem não é gravada em banco, disco, cache, log ou Sentry.
 * [CONFIRMAR com o prazo de retenção da T34] Padrão adotado: retenção zero.
 */
import type { Analise } from "@ecoponto/contracts";
import { diaEmBoaVista } from "@ecoponto/format";
import { LIMIAR_CONFIANCA_PADRAO, mapearResultado } from "@ecoponto/regras";
import type { Executor } from "../db/db.ts";
import type { ServicoGuia } from "../guia/servico.ts";
import { IaIndisponivel, type ClassificadorImagem } from "../ia/classificador.ts";
import { ehJpeg, removerMetadadosJpeg } from "../ia/jpeg.ts";

/** [DEFINIR] Padrão adotado: 30 fotos por cidadão por dia. */
export const LIMITE_FOTOS_DIA_PADRAO = 30;
/** O aparelho desiste em 5 s; o servidor, um pouco antes, para responder a tempo. */
export const TEMPO_LIMITE_IA_MS = 4_500;
/** Tamanho máximo da foto recebida (o aparelho manda ~150 a 400 KB). */
export const TAMANHO_MAXIMO_FOTO = 2 * 1024 * 1024;

export type ErroAnalise = "imagem_invalida" | "limite_diario" | "tempo_esgotado" | "ia_indisponivel" | "interno";

export type ResultadoServico =
  | { ok: true; analise: Analise }
  | { ok: false; erro: ErroAnalise; limite?: number };

export type OpcoesReciclar = {
  db: Executor;
  guia: ServicoGuia;
  ia: ClassificadorImagem;
  agora: () => Date;
  limiteFotosDia?: number;
  limiarConfianca?: number;
  tempoLimiteIaMs?: number;
};

export type ServicoReciclar = {
  analisar(usuarioId: string, imagem: Uint8Array, sinalPedido?: AbortSignal): Promise<ResultadoServico>;
  readonly limiteFotosDia: number;
};

export function criarServicoReciclar(o: OpcoesReciclar): ServicoReciclar {
  const limite = o.limiteFotosDia ?? LIMITE_FOTOS_DIA_PADRAO;
  const limiar = o.limiarConfianca ?? LIMIAR_CONFIANCA_PADRAO;
  const tempoIa = o.tempoLimiteIaMs ?? TEMPO_LIMITE_IA_MS;

  /** true se ainda cabia no limite (e já contou esta foto). */
  async function consumirFoto(usuarioId: string): Promise<boolean> {
    const { rows } = await o.db.query(
      `INSERT INTO reciclar_uso (usuario_id, dia, total) VALUES ($1, $2::date, 1)
       ON CONFLICT (usuario_id, dia) DO UPDATE SET total = reciclar_uso.total + 1
        WHERE reciclar_uso.total < $3
       RETURNING total`,
      [usuarioId, diaEmBoaVista(o.agora()), limite],
    );
    return rows.length === 1;
  }

  return {
    limiteFotosDia: limite,
    async analisar(usuarioId, imagem, sinalPedido) {
      let limpa: Uint8Array | null = null;
      try {
        if (!ehJpeg(imagem)) return { ok: false, erro: "imagem_invalida" };
        try {
          limpa = removerMetadadosJpeg(imagem);
        } catch {
          return { ok: false, erro: "imagem_invalida" };
        }
        if (!(await consumirFoto(usuarioId))) return { ok: false, erro: "limite_diario", limite };

        const guia = await o.guia.guia();
        if (!guia) return { ok: false, erro: "interno" };

        const tempo = AbortSignal.timeout(tempoIa);
        const signal = sinalPedido ? AbortSignal.any([tempo, sinalPedido]) : tempo;
        let rotulos;
        try {
          rotulos = await o.ia.classificar(limpa, { signal });
        } catch (e) {
          if (signal.aborted) return { ok: false, erro: "tempo_esgotado" };
          if (e instanceof IaIndisponivel) return { ok: false, erro: "ia_indisponivel" };
          throw e;
        }
        return { ok: true, analise: mapearResultado(rotulos, guia, limiar) };
      } finally {
        // Retenção zero: nada da foto sobra na memória depois da resposta.
        imagem.fill(0);
        limpa?.fill(0);
      }
    },
  };
}

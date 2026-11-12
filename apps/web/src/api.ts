/**
 * Cliente da API. Valida toda resposta pelo contrato (Zod): o que não bate
 * não é exibido.
 */
import { Analise, EstadoJogo, Guia, PartidaResposta, RespostaErro, type Esquema, type PartidaPedido } from "@ecoponto/contracts";
import { resumoErroDeContrato } from "@ecoponto/observability";

export type Falha =
  | { tipo: "rede" }
  /** Passou do tempo (5 s na análise). */
  | { tipo: "tempo" }
  | { tipo: "nao_autenticado" }
  | { tipo: "limite_diario"; limite: number | null }
  | { tipo: "imagem_invalida" }
  | { tipo: "ia_indisponivel" }
  | { tipo: "jogo_desligado" }
  | { tipo: "partida_invalida" }
  | { tipo: "servidor"; status: number }
  | { tipo: "contrato" };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

export type Reportar = (erro: unknown, contexto: Record<string, string>) => void;

const TEMPO_LIMITE_MS = 10_000;
/** Critério 2: resultado em até 5 s no 4G; passou disso, desiste e mostra a busca do guia. */
export const TEMPO_LIMITE_ANALISE_MS = 5_000;

export function criarApi(fetcher: typeof fetch, reportar: Reportar, tempoAnaliseMs = TEMPO_LIMITE_ANALISE_MS) {
  async function pedir<T>(caminho: string, schema: Esquema<T>, rotulo: string, init: RequestInit = {}, limiteMs = TEMPO_LIMITE_MS): Promise<Resultado<T>> {
    const ctrl = new AbortController();
    let estourou = false;
    const t = setTimeout(() => {
      estourou = true;
      ctrl.abort();
    }, limiteMs);
    let res: Response;
    try {
      res = await fetcher(caminho, {
        credentials: "same-origin",
        ...init,
        headers: { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
        signal: ctrl.signal,
      });
    } catch {
      return { ok: false, falha: estourou ? { tipo: "tempo" } : { tipo: "rede" } };
    } finally {
      clearTimeout(t);
    }

    let corpo: unknown = null;
    try {
      corpo = await res.json();
    } catch {
      corpo = null;
    }

    if (!res.ok) {
      const e = RespostaErro.safeParse(corpo);
      const codigo = e.success ? e.data.erro : null;
      if (res.status === 401) return { ok: false, falha: { tipo: "nao_autenticado" } };
      if (codigo === "limite_diario") return { ok: false, falha: { tipo: "limite_diario", limite: e.success ? (e.data.limite ?? null) : null } };
      if (codigo === "tempo_esgotado") return { ok: false, falha: { tipo: "tempo" } };
      if (codigo === "imagem_invalida" || codigo === "imagem_grande") return { ok: false, falha: { tipo: "imagem_invalida" } };
      if (codigo === "ia_indisponivel") return { ok: false, falha: { tipo: "ia_indisponivel" } };
      if (codigo === "jogo_desligado") return { ok: false, falha: { tipo: "jogo_desligado" } };
      if (codigo === "partida_invalida") return { ok: false, falha: { tipo: "partida_invalida" } };
      if (res.status >= 500) reportar(new Error(`HTTP ${res.status}`), { endpoint: rotulo });
      return { ok: false, falha: { tipo: "servidor", status: res.status } };
    }

    const r = schema.safeParse(corpo);
    if (!r.success) {
      // Só caminho e código do erro: nenhum valor vai para o Sentry.
      reportar(new Error("Resposta fora do contrato"), { endpoint: rotulo, detalhe: resumoErroDeContrato(r.error.issues) });
      return { ok: false, falha: { tipo: "contrato" } };
    }
    return { ok: true, dados: r.data };
  }

  return {
    guia: () => pedir("/api/publico/guia-materiais", Guia, "guia-materiais", { credentials: "omit" }),
    /** A foto vai como image/jpeg; nada além dela (nem nome do arquivo). */
    analisar: (foto: Blob) =>
      pedir("/api/cidadao/reciclar/analisar", Analise, "reciclar/analisar", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: foto }, tempoAnaliseMs),
    estadoJogo: () => pedir("/api/cidadao/jogo", EstadoJogo, "jogo"),
    registrarPartida: (p: PartidaPedido) =>
      pedir("/api/cidadao/jogo/partidas", PartidaResposta, "jogo/partidas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }),
  };
}

export type Api = ReturnType<typeof criarApi>;

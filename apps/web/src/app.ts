/**
 * Página "Reciclar Certo": abas (Posso levar? · Guia · Jogo), rotas e estado
 * compartilhado (guia guardado, jogo ligado). Tudo injetável para os testes.
 */
import { Guia, type EstadoJogo, type Esquema } from "@ecoponto/contracts";
import { criarApi, type Reportar } from "./api.ts";
import { criarCache } from "./cache.ts";
import type { Links } from "./config.ts";
import type { Contexto, EstadoGuia, Vista } from "./contexto.ts";
import { h } from "./dom.ts";
import { icone, type NomeIcone } from "./icons.ts";
import { prepararFoto } from "./imagem.ts";
import { lerRota, urlDaRota, type Aba, type Rota } from "./router.ts";
import { montarGuia } from "./views/guia.ts";
import { montarJogo } from "./views/jogo.ts";
import { montarPossoLevar } from "./views/posso-levar.ts";

export type Deps = {
  raiz: HTMLElement;
  fetch: typeof fetch;
  storage: Storage | null;
  online: () => boolean;
  agora: () => Date;
  links: Links;
  reportar: Reportar;
  prepararFoto?: (foto: Blob) => Promise<Blob>;
  aleatorio?: () => number;
  gerarId?: () => string;
  movimentoReduzido?: () => boolean;
  fotosExemplo?: boolean;
  /** Tempo máximo da análise no aparelho (padrão 5 s). */
  tempoAnaliseMs?: number;
};

export type App = {
  iniciar(): Promise<void>;
  /** Resolve quando não há mais nada carregando (testes). */
  ocioso(): Promise<void>;
  mudouConexao(): Promise<void>;
};

const ABAS: ReadonlyArray<{ aba: Aba; rotulo: string; icone: NomeIcone }> = [
  { aba: "posso-levar", rotulo: "Posso levar?", icone: "camera" },
  { aba: "guia", rotulo: "Guia", icone: "book-open" },
  { aba: "jogo", rotulo: "Jogo", icone: "gamepad-2" },
];

const BOOLEANO: Esquema<boolean> = {
  safeParse: (x) => (typeof x === "boolean" ? { success: true, data: x } : { success: false, error: { issues: [] } }),
};

function gerarIdPadrao(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function movimentoReduzidoPadrao(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function criarApp(d: Deps): App {
  const api = criarApi(d.fetch, d.reportar, d.tempoAnaliseMs);
  const cache = criarCache(d.storage, d.agora);
  const pendentes = new Set<Promise<unknown>>();
  let vista: Vista | null = null;
  let rota: Rota = lerRota(location.pathname, location.search);
  // O jogo só aparece se o servidor disse que está ligado (guardado para o offline).
  // null: ainda não sabemos (primeira visita); a aba fica escondida, mas /reciclar/jogo abre e confere.
  let jogoAtivo: boolean | null = cache.ler("jogo-ativo", BOOLEANO)?.dados ?? null;

  const acompanhar = <T>(p: Promise<T>): Promise<T> => {
    pendentes.add(p);
    void p.finally(() => pendentes.delete(p)).catch(() => {});
    return p;
  };

  // ---- Guia (compartilhado entre as abas) ----
  let guiaMemoria: EstadoGuia | null = null;
  let guiaEmVoo: Promise<EstadoGuia> | null = null;
  function carregarGuia(forcar = false): Promise<EstadoGuia> {
    if (guiaMemoria?.tipo === "ok" && !guiaMemoria.guardado && !forcar) return Promise.resolve(guiaMemoria);
    if (guiaEmVoo) return guiaEmVoo;
    guiaEmVoo = (async (): Promise<EstadoGuia> => {
      const guardado = cache.ler("guia", Guia);
      // Sem internet: direto do aparelho (sem esperar a rede falhar).
      const r = d.online() ? await api.guia() : ({ ok: false, falha: { tipo: "rede" } } as const);
      if (r.ok) {
        cache.salvar("guia", r.dados);
        return (guiaMemoria = { tipo: "ok", guia: r.dados, salvoEm: d.agora().toISOString(), guardado: false });
      }
      if (guardado) return (guiaMemoria = { tipo: "ok", guia: guardado.dados, salvoEm: guardado.salvoEm, guardado: true });
      return (guiaMemoria = { tipo: "erro", falha: r.falha });
    })().finally(() => (guiaEmVoo = null));
    return guiaEmVoo;
  }

  // ---- Abas (padrão WAI-ARIA tabs) ----
  const botoesAba = new Map<Aba, HTMLButtonElement>();
  const lista = h("div", { class: "abas__lista", role: "tablist", "aria-label": "Reciclar Certo" });
  for (const a of ABAS) {
    const b = h(
      "button",
      { type: "button", role: "tab", id: `aba-${a.aba}`, class: "aba", "aria-controls": "conteudo", "data-aba": a.aba },
      icone(a.icone, "icon--sm"),
      h("span", null, a.rotulo),
    );
    b.addEventListener("click", () => irPara({ aba: a.aba, busca: a.aba === "guia" ? rota.busca : "" }));
    b.addEventListener("keydown", (e) => {
      const visiveis = ABAS.map((x) => botoesAba.get(x.aba)!).filter((x) => !x.hidden);
      const i = visiveis.indexOf(b);
      let alvo: HTMLButtonElement | undefined;
      if (e.key === "ArrowRight") alvo = visiveis[(i + 1) % visiveis.length];
      else if (e.key === "ArrowLeft") alvo = visiveis[(i - 1 + visiveis.length) % visiveis.length];
      else if (e.key === "Home") alvo = visiveis[0];
      else if (e.key === "End") alvo = visiveis[visiveis.length - 1];
      if (!alvo) return;
      e.preventDefault();
      alvo.focus();
      alvo.click();
    });
    botoesAba.set(a.aba, b);
    lista.append(b);
  }
  const painel = h("main", { id: "conteudo", class: "page", role: "tabpanel", tabindex: "-1" });

  function atualizarAbas(): void {
    botoesAba.get("jogo")!.hidden = jogoAtivo !== true;
    for (const [aba, b] of botoesAba) {
      const sel = aba === rota.aba;
      b.setAttribute("aria-selected", String(sel));
      b.tabIndex = sel ? 0 : -1;
    }
    painel.setAttribute("aria-labelledby", `aba-${rota.aba}`);
  }

  function irPara(nova: Rota, opts: { focarBusca?: boolean; historico?: "push" | "replace" | "nenhum" } = {}): void {
    if (nova.aba === "jogo" && jogoAtivo === false) nova = { aba: "posso-levar", busca: "" };
    const mesmaAba = nova.aba === rota.aba && vista !== null;
    rota = nova;
    const url = urlDaRota(nova);
    if (opts.historico !== "nenhum" && url !== location.pathname + location.search) {
      if (opts.historico === "replace") history.replaceState(null, "", url);
      else history.pushState(null, "", url);
    }
    atualizarAbas();
    if (mesmaAba && nova.aba === "guia") {
      vista?.novaBusca?.(nova.busca);
      if (opts.focarBusca) vista?.focarBusca?.();
      return;
    }
    vista?.destruir?.();
    if (nova.aba === "guia") vista = montarGuia(ctx, painel, nova.busca, opts.focarBusca ?? false);
    else if (nova.aba === "jogo") vista = montarJogo(ctx, painel);
    else vista = montarPossoLevar(ctx, painel);
  }

  const ctx: Contexto = {
    api,
    cache,
    online: d.online,
    agora: d.agora,
    links: d.links,
    reportar: d.reportar,
    prepararFoto: d.prepararFoto ?? prepararFoto,
    aleatorio: d.aleatorio ?? Math.random,
    gerarId: d.gerarId ?? gerarIdPadrao,
    movimentoReduzido: d.movimentoReduzido ?? movimentoReduzidoPadrao,
    fotosExemplo: d.fotosExemplo ?? false,
    irPara: (r, o) => irPara(r, o ?? {}),
    acompanhar,
    carregarGuia,
    jogoMudou(e: EstadoJogo) {
      const antes = jogoAtivo;
      jogoAtivo = e.ativo;
      cache.salvar("jogo-ativo", jogoAtivo);
      if (antes !== jogoAtivo) {
        atualizarAbas();
        if (!jogoAtivo && rota.aba === "jogo") irPara({ aba: "posso-levar", busca: "" }, { historico: "replace" });
      }
    },
  };

  async function verificarJogo(): Promise<void> {
    if (!d.online()) return;
    const r = await api.estadoJogo();
    if (r.ok) ctx.jogoMudou(r.dados);
  }

  return {
    async iniciar() {
      d.raiz.replaceChildren(h("nav", { class: "abas", "aria-label": "Seções" }, lista), painel);
      irPara(rota, { historico: "replace" });
      window.addEventListener("popstate", () => irPara(lerRota(location.pathname, location.search), { historico: "nenhum" }));
      // Em paralelo: guia (para abrir rápido e para o offline) e se o jogo está ligado.
      void acompanhar(carregarGuia());
      if (rota.aba !== "jogo") void acompanhar(verificarJogo());
    },
    async ocioso() {
      for (let i = 0; i < 50 && pendentes.size > 0; i++) {
        await Promise.allSettled([...pendentes]);
        await new Promise((r) => setTimeout(r, 0));
      }
      await new Promise((r) => setTimeout(r, 0));
    },
    async mudouConexao() {
      vista?.mudouConexao?.();
      if (d.online()) void acompanhar(verificarJogo());
    },
  };
}

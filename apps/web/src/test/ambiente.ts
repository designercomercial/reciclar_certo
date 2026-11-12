/**
 * Monta a página num DOM de teste ligada à API real com os dados de exemplo
 * (Fastify `inject` + PGlite + IA mock, sem rede). O que a tela mostra é
 * conferido contra o que a API calcula, não contra valores copiados.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAppMock, criarDbPglite, type AppMock, type Db } from "@ecoponto/api";
import { criarApp, type App, type Deps } from "../app.ts";
import type { Links } from "../config.ts";

export const LINKS_TESTE: Links = { ecopontos: "/ecopontos/" };
export const AGORA = new Date("2026-11-12T10:00:00-04:00");

export type Pessoa = "dev-cidadao-ana" | "dev-cidadao-bruno" | "dev-cidadao-limite";

/** Um PGlite por arquivo de teste (criar um leva segundos); zerado a cada teste. */
let dbDoArquivo: Db | null = null;

export async function novaApi(o: Parameters<typeof buildAppMock>[0] = {}): Promise<AppMock> {
  dbDoArquivo ??= await criarDbPglite();
  return buildAppMock({ agora: () => AGORA, devLogin: false, db: dbDoArquivo, ...o });
}

export type Pedido = { metodo: string; url: string };

/** fetch que chama a API com o token da pessoa e anota cada pedido. */
export function fetchComo(api: AppMock, pessoa: Pessoa = "dev-cidadao-ana", pedidos: Pedido[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    const metodo = (init?.method ?? "GET").toUpperCase();
    pedidos.push({ metodo, url });
    const cab = new Headers(init?.headers);
    let payload: Buffer | string | undefined;
    if (init?.body instanceof Blob) payload = Buffer.from(await init.body.arrayBuffer());
    else if (typeof init?.body === "string") payload = init.body;
    if (init?.signal?.aborted) throw new DOMException("abortado", "AbortError");
    const r = await api.inject({
      method: metodo as "GET" | "POST",
      url,
      headers: { authorization: `Bearer ${pessoa}`, ...(cab.get("content-type") ? { "content-type": cab.get("content-type")! } : {}) },
      ...(payload === undefined ? {} : { payload }),
    });
    return new Response(r.body, { status: r.statusCode, headers: { "content-type": String(r.headers["content-type"] ?? "application/json") } });
  }) as typeof fetch;
}

/** fetch de quem está sem internet. */
export const fetchSemRede = (async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

/** fetch que só responde quando o pedido é cancelado (para ver skeleton e tempo esgotado). */
export const fetchPendente = ((_: unknown, init?: RequestInit) =>
  new Promise((_ok, falha) => {
    init?.signal?.addEventListener("abort", () => falha(new DOMException("abortado", "AbortError")));
  })) as unknown as typeof fetch;

/** Um fetch para cada caminho (o resto vai para `padrao`). */
export function fetchPorRota(rotas: Record<string, typeof fetch>, padrao: typeof fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    const alvo = Object.entries(rotas).find(([prefixo]) => url.startsWith(prefixo))?.[1] ?? padrao;
    return alvo(input, init);
  }) as typeof fetch;
}

const pastaExemplos = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/exemplos");

/** Foto de exemplo como o input de arquivo entregaria. */
export function arquivoFoto(nome: string): File {
  return new File([readFileSync(resolve(pastaExemplos, `${nome}.jpg`))], `${nome}.jpg`, { type: "image/jpeg" });
}

/** Simula a pessoa escolhendo a foto no input (câmera ou galeria). */
export function escolherFoto(raiz: HTMLElement, arquivo: File, input: "foto-camera" | "foto-galeria" = "foto-camera"): void {
  const el = raiz.querySelector<HTMLInputElement>(`#${input}`);
  if (!el) throw new Error(`input ${input} não está na tela`);
  Object.defineProperty(el, "files", { configurable: true, value: [arquivo] });
  el.dispatchEvent(new Event("change"));
}

export type Montagem = { app: App; raiz: HTMLElement; reportados: Array<{ erro: unknown; contexto: Record<string, string> }> };

export async function montar(
  url: string,
  fetcher: typeof fetch,
  opts: Partial<Pick<Deps, "storage" | "aleatorio" | "gerarId" | "movimentoReduzido" | "tempoAnaliseMs">> & { online?: boolean | (() => boolean); esperar?: boolean } = {},
): Promise<Montagem> {
  history.replaceState(null, "", url);
  document.body.replaceChildren();
  const raiz = document.createElement("div");
  document.body.append(raiz);
  const reportados: Montagem["reportados"] = [];
  const online = typeof opts.online === "function" ? opts.online : () => (opts.online as boolean | undefined) ?? true;
  let n = 0;
  const app = criarApp({
    raiz,
    fetch: fetcher,
    storage: opts.storage === undefined ? memoria() : opts.storage,
    online,
    agora: () => AGORA,
    links: LINKS_TESTE,
    reportar: (erro, contexto) => reportados.push({ erro, contexto }),
    // happy-dom não decodifica imagem: a redução tem teste próprio.
    prepararFoto: async (b) => b,
    aleatorio: opts.aleatorio ?? (() => 0.42),
    gerarId: opts.gerarId ?? (() => `partida-tela-${Date.now().toString(36)}-${++n}-xxxx`),
    movimentoReduzido: opts.movimentoReduzido ?? (() => false),
    ...(opts.tempoAnaliseMs === undefined ? {} : { tempoAnaliseMs: opts.tempoAnaliseMs }),
  });
  void app.iniciar();
  if (opts.esperar !== false) await app.ocioso();
  else await new Promise((r) => setTimeout(r, 0));
  return { app, raiz, reportados };
}

/** localStorage em memória, para simular "voltar ao app depois". */
export function memoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

export const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function clicar(el: Element | null | undefined): void {
  if (!el) throw new Error("elemento não encontrado");
  (el as HTMLElement).click();
}

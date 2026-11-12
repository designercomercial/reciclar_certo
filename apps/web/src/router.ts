export const BASE = "/reciclar";

export type Aba = "posso-levar" | "guia" | "jogo";

export type Rota = { aba: Aba; busca: string };

/**
 * /reciclar/            → Posso levar?
 * /reciclar/guia?q=pet  → Guia de materiais (com a busca)
 * /reciclar/jogo        → Jogo da Separação
 */
export function lerRota(pathname: string, search: string): Rota {
  const resto = pathname.replace(/\/+$/, "").slice(BASE.length);
  const q = new URLSearchParams(search).get("q") ?? "";
  if (resto === "/guia") return { aba: "guia", busca: q };
  if (resto === "/jogo") return { aba: "jogo", busca: "" };
  return { aba: "posso-levar", busca: "" };
}

export function urlDaRota(r: Rota): string {
  if (r.aba === "guia") return `${BASE}/guia${r.busca ? `?q=${encodeURIComponent(r.busca)}` : ""}`;
  if (r.aba === "jogo") return `${BASE}/jogo`;
  return `${BASE}/`;
}

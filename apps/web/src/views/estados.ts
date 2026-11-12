import { formatData } from "@ecoponto/format";
import type { Falha } from "../api.ts";
import { h } from "../dom.ts";
import { icone } from "../icons.ts";

/** Skeleton no formato do conteúdo. Sem spinner. */
export function skeleton(forma: "resultado" | "guia" | "jogo" | "partida", texto = "Carregando…"): HTMLElement {
  const b = (cls: string) => h("span", { class: `sk ${cls}` });
  const corpo =
    forma === "guia"
      ? [b("sk--campo"), ...Array.from({ length: 6 }, () => h("div", { class: "sk-linha" }, b("sk--icone"), b("sk--texto")))]
      : forma === "resultado"
        ? [h("div", { class: "card" }, b("sk--faixa"), b("sk--destaque"), b("sk--texto"), b("sk--texto"), b("sk--curto"))]
        : forma === "jogo"
          ? [b("sk--destaque"), b("sk--texto"), h("div", { class: "sk-grade" }, Array.from({ length: 6 }, () => b("sk--lixeira"))), b("sk--botao")]
          : [h("div", { class: "card" }, b("sk--destaque"), b("sk--texto"), b("sk--botao"))];
  return h(
    "div",
    { class: "skeleton", "data-estado": "carregando" },
    h("p", { class: "visually-hidden", role: "status" }, texto),
    h("div", { "aria-hidden": "true", class: "skeleton__corpo" }, corpo),
  );
}

export function botaoTentar(tentar: () => void, classe = "botao"): HTMLButtonElement {
  return h("button", { type: "button", class: classe, "on:click": () => tentar() }, icone("refresh-cw", "icon--sm"), "Tentar novamente");
}

/** Erro de conexão sem nada guardado: mensagem + "Tentar novamente". */
export function erroConexao(falha: Falha, online: boolean, tentar: () => void, oque = "o guia"): HTMLElement {
  let titulo = `Não foi possível carregar ${oque}.`;
  let texto = "Verifique sua conexão e tente de novo.";
  let nome: "wifi-off" | "triangle-alert" = "triangle-alert";
  if (falha.tipo === "rede" && !online) {
    titulo = "Sem internet.";
    texto = "Conecte-se à internet e tente de novo.";
    nome = "wifi-off";
  } else if (falha.tipo === "nao_autenticado") {
    titulo = "Sua sessão terminou.";
    texto = "Feche esta tela e abra Reciclar Certo de novo pelo app.";
  } else if (falha.tipo === "servidor" || falha.tipo === "contrato") {
    texto = "O problema é do nosso lado. Tente de novo em alguns minutos.";
  }
  return h(
    "div",
    { class: "estado", role: "alert", "data-estado": "erro" },
    h("span", { class: "estado__icone" }, icone(nome)),
    h("p", { class: "estado__titulo" }, titulo),
    h("p", null, texto),
    falha.tipo === "nao_autenticado" ? null : botaoTentar(tentar),
  );
}

/** Posso levar? e jogo precisam de internet. */
export function conecteSe(extra: HTMLElement | null = null): HTMLElement {
  return h(
    "div",
    { class: "estado", role: "status", "data-estado": "offline" },
    h("span", { class: "estado__icone" }, icone("wifi-off")),
    h("p", { class: "estado__titulo" }, "Conecte-se à internet para usar."),
    extra,
  );
}

/** Guia aberto do que ficou guardado no aparelho. */
export function avisoGuiaGuardado(salvoEm: string, online: boolean, tentar: () => void): HTMLElement {
  return h(
    "div",
    { class: "faixa-offline", role: "status", "data-estado": "offline" },
    icone(online ? "triangle-alert" : "wifi-off"),
    h("p", null, online ? `Não foi possível atualizar. Guia de ${formatData(salvoEm)}.` : `Sem internet. Guia de ${formatData(salvoEm)}.`),
    botaoTentar(tentar, "botao botao--secundario botao--pequeno"),
  );
}

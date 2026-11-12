/** O que cada aba recebe do app (tudo injetável nos testes). */
import type { EstadoJogo, Guia } from "@ecoponto/contracts";
import type { Api, Falha, Reportar } from "./api.ts";
import type { Cache } from "./cache.ts";
import type { Links } from "./config.ts";
import { h } from "./dom.ts";
import { icone } from "./icons.ts";
import type { Rota } from "./router.ts";

export type EstadoGuia = { tipo: "ok"; guia: Guia; salvoEm: string; guardado: boolean } | { tipo: "erro"; falha: Falha };

export type Contexto = {
  api: Api;
  cache: Cache;
  online: () => boolean;
  agora: () => Date;
  links: Links;
  reportar: Reportar;
  prepararFoto: (foto: Blob) => Promise<Blob>;
  aleatorio: () => number;
  gerarId: () => string;
  /** prefers-reduced-motion: reduce → nenhuma animação. */
  movimentoReduzido: () => boolean;
  fotosExemplo: boolean;
  irPara(r: Rota, opts?: { focarBusca?: boolean }): void;
  /** Guarda a promessa para `ocioso()` (testes esperam a tela assentar). */
  acompanhar<T>(p: Promise<T>): Promise<T>;
  carregarGuia(forcar?: boolean): Promise<EstadoGuia>;
  /** O jogo mudou de estado (ex.: já ganhou XP hoje). */
  jogoMudou(e: EstadoJogo): void;
};

export type Vista = {
  destruir?(): void;
  mudouConexao?(): void;
  /** O guia recebe a busca da URL quando a pessoa volta pelo histórico. */
  novaBusca?(termo: string): void;
  focarBusca?(): void;
};

/** Campo de busca do guia, usado quando a análise falha ou fica incerta. */
export function formBuscaGuia(ctx: Contexto, id: string, rotulo = "Procure no guia"): HTMLFormElement {
  const campo = h("input", {
    id,
    class: "campo",
    type: "search",
    name: "q",
    autocomplete: "off",
    enterkeyhint: "search",
    placeholder: "Ex.: garrafa PET, caixa de leite, óleo de cozinha",
  });
  return h(
    "form",
    {
      class: "busca",
      role: "search",
      "on:submit": (e: Event) => {
        e.preventDefault();
        ctx.irPara({ aba: "guia", busca: campo.value.trim() }, { focarBusca: !campo.value.trim() });
      },
    },
    h("label", { class: "busca__rotulo", for: id }, rotulo),
    h("div", { class: "busca__linha" }, campo, h("button", { type: "submit", class: "botao botao--icone", "aria-label": "Buscar" }, icone("search"))),
  );
}

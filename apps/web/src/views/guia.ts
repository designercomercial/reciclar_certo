/**
 * Aba "Guia de materiais": busca (sem acento, com sinônimos) e lista por
 * categoria. Os pontos vêm da tabela vigente no servidor. Funciona offline com
 * o último guia baixado ("Sem internet. Guia de [data].").
 */
import type { CategoriaDoGuia, Guia } from "@ecoponto/contracts";
import { CATEGORIA_GUIA, formatDataSimples, formatValor } from "@ecoponto/format";
import { buscarNoGuia, type ItemEncontrado } from "@ecoponto/regras";
import type { Contexto, EstadoGuia, Vista } from "../contexto.ts";
import { h, substituir } from "../dom.ts";
import { icone } from "../icons.ts";
import { avisoGuiaGuardado, erroConexao, skeleton } from "./estados.ts";

export function montarGuia(ctx: Contexto, painel: HTMLElement, buscaInicial: string, focarBusca: boolean): Vista {
  let termo = buscaInicial;
  let guia: Guia | null = null;
  let ativo = true;

  const campo = h("input", {
    id: "busca-guia",
    class: "campo",
    type: "search",
    autocomplete: "off",
    enterkeyhint: "search",
    placeholder: "Ex.: garrafa PET, caixa de leite, óleo de cozinha",
    "aria-describedby": "busca-guia-ajuda",
  });
  campo.value = termo;
  const status = h("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  const avisos = h("div", { class: "avisos" });
  const resultados = h("div", { class: "resultados-busca" });
  const categorias = h("div", { class: "categorias" });

  campo.addEventListener("input", () => {
    termo = campo.value;
    // A busca fica na URL (voltar e compartilhar), sem criar histórico a cada letra.
    const u = new URL(location.href);
    if (termo.trim()) u.searchParams.set("q", termo.trim());
    else u.searchParams.delete("q");
    history.replaceState(history.state, "", u.pathname + u.search);
    desenharBusca();
  });

  const form = h(
    "form",
    { class: "busca", role: "search", "on:submit": (e: Event) => (e.preventDefault(), campo.blur()) },
    h("label", { class: "busca__rotulo", for: "busca-guia" }, "Buscar no guia"),
    // O exemplo também fica visível: o placeholder é cortado em telas de 360 px.
    h("p", { id: "busca-guia-ajuda", class: "busca__ajuda" }, "Ex.: garrafa PET, caixa de leite, óleo de cozinha"),
    h("div", { class: "busca__linha busca__linha--icone" }, icone("search", "busca__lupa"), campo),
  );

  const intro = h("div", { class: "intro" }, h("h2", { class: "titulo-secao" }, "Guia de materiais"), h("p", null, "Veja o que o ecoponto recebe e como preparar."));

  function desenharBusca(): void {
    if (!guia) return;
    const t = termo.trim();
    categorias.hidden = t !== "";
    if (!t) {
      substituir(resultados);
      status.textContent = "";
      return;
    }
    const achados = buscarNoGuia(guia, t);
    status.textContent = achados.length === 0 ? "Nenhum item encontrado." : achados.length === 1 ? "1 item encontrado." : `${achados.length} itens encontrados.`;
    substituir(
      resultados,
      h("h3", { class: "resultados-busca__titulo" }, `Resultados para “${t}”`),
      achados.length
        ? h("ul", { class: "lista-itens" }, achados.slice(0, 20).map(itemEncontrado))
        : h(
            "div",
            { class: "estado estado--vazio", "data-estado": "vazio" },
            h("span", { class: "estado__icone" }, icone("search")),
            h("p", { class: "estado__titulo" }, `Não encontramos “${t}” no guia.`),
            h("p", null, "Tente outra palavra ou pergunte no ecoponto."),
            h(
              "button",
              {
                type: "button",
                class: "botao botao--secundario",
                "on:click": () => {
                  campo.value = "";
                  campo.dispatchEvent(new Event("input"));
                  campo.focus();
                },
              },
              "Ver todas as categorias",
            ),
          ),
    );
  }

  function itemEncontrado(e: ItemEncontrado): HTMLElement {
    const cat = CATEGORIA_GUIA[e.categoria.id].rotulo;
    if (e.tipo === "aceito") {
      return h(
        "li",
        { class: "item-guia item-guia--aceito", "data-item": e.item.id },
        h("p", { class: "item-guia__selo" }, icone("circle-check", "icon--sm"), "Aceito"),
        h("h4", { class: "item-guia__nome" }, e.item.nome),
        h("p", { class: "item-guia__cat" }, e.categoria.valor ? `${cat} · ${formatValor(e.categoria.valor)}` : cat),
        h("p", null, h("strong", null, "Como preparar: "), [e.item.dica, ...e.categoria.preparo].filter(Boolean).join(" ")),
      );
    }
    return h(
      "li",
      { class: "item-guia item-guia--nao-aceito", "data-item": e.item.id },
      h("p", { class: "item-guia__selo" }, icone("circle-x", "icon--sm"), "Não aceito"),
      h("h4", { class: "item-guia__nome" }, e.item.nome),
      h("p", null, h("strong", null, "Por quê: "), e.item.motivo),
      h("p", null, h("strong", null, "Onde descartar: "), e.item.ondeDescartar),
    );
  }

  function categoria(c: CategoriaDoGuia): HTMLElement {
    const info = CATEGORIA_GUIA[c.id];
    return h(
      "details",
      { class: `categoria categoria--${c.id}`, "data-categoria": c.id },
      h(
        "summary",
        { class: "categoria__resumo" },
        h("span", { class: "categoria__icone" }, icone(info.icone)),
        h("span", { class: "categoria__titulos" }, h("span", { class: "categoria__nome" }, c.nome), c.valor ? h("span", { class: "categoria__valor" }, formatValor(c.valor)) : h("span", { class: "categoria__valor" }, "Leve a outros pontos de coleta")),
        icone("chevron-down", "categoria__seta"),
      ),
      h(
        "div",
        { class: "categoria__corpo" },
        c.preparo.length ? [h("h3", { class: "categoria__sub" }, "Como preparar"), h("ul", { class: "lista-preparo" }, c.preparo.map((p) => h("li", null, icone("circle-check", "icon--sm"), p)))] : null,
        c.aceitos.length
          ? [
              h("h3", { class: "categoria__sub" }, "Aceitos"),
              h("ul", { class: "lista-simples lista-simples--aceito" }, c.aceitos.map((i) => h("li", { "data-item": i.id }, icone("circle-check", "icon--sm"), h("span", null, i.nome, i.dica ? h("span", { class: "dica" }, i.dica) : null)))),
            ]
          : null,
        h("h3", { class: "categoria__sub" }, c.aceitos.length ? "Não aceitos" : "O ecoponto não recebe"),
        h(
          "ul",
          { class: "lista-simples lista-simples--nao-aceito" },
          c.naoAceitos.map((i) =>
            h("li", { "data-item": i.id }, icone("circle-x", "icon--sm"), h("span", null, h("strong", null, i.nome), h("span", { class: "dica" }, `${i.motivo} Onde descartar: ${i.ondeDescartar}`))),
          ),
        ),
      ),
    );
  }

  function desenhar(e: EstadoGuia): void {
    if (!ativo) return;
    if (e.tipo === "erro") {
      guia = null;
      substituir(painel, intro, erroConexao(e.falha, ctx.online(), () => void ctx.acompanhar(carregar(true))));
      return;
    }
    guia = e.guia;
    substituir(avisos, e.guardado ? avisoGuiaGuardado(e.salvoEm, ctx.online(), () => void ctx.acompanhar(carregar(true))) : null);
    substituir(
      categorias,
      h("ul", { class: "lista-categorias" }, e.guia.categorias.map((c) => h("li", null, categoria(c)))),
      h("p", { class: "nota" }, `Pontos da tabela de valores ${e.guia.tabela.versao}, em vigor desde ${formatDataSimples(e.guia.tabela.vigenteDesde)}.`),
    );
    substituir(painel, intro, avisos, form, status, resultados, categorias);
    desenharBusca();
    if (focarBusca) {
      focarBusca = false;
      campo.focus();
    }
  }

  async function carregar(forcar = false): Promise<void> {
    if (!guia) substituir(painel, intro, skeleton("guia", "Carregando o guia…"));
    desenhar(await ctx.carregarGuia(forcar));
  }

  void ctx.acompanhar(carregar());

  return {
    destruir() {
      ativo = false;
    },
    mudouConexao() {
      // Caiu: mostra o aviso com a data do guia guardado. Voltou: atualiza.
      void ctx.acompanhar(carregar(true));
    },
    novaBusca(t) {
      termo = t;
      campo.value = t;
      desenharBusca();
    },
    focarBusca() {
      if (guia) campo.focus();
      else focarBusca = true;
    },
  };
}

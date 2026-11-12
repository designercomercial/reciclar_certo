/**
 * Aba "Posso levar?" (T21): foto → servidor → IA → resultado.
 *
 * Estados: início · analisando (skeleton) · aceito · não aceito · incerto ·
 * erro/tempo esgotado (com a busca do guia) · limite do dia · sem internet.
 * A foto fica só na memória desta tela e é descartada ao trocar de foto ou de aba.
 */
import type { Analise } from "@ecoponto/contracts";
import { CATEGORIA_GUIA, formatDataSimples, formatValor } from "@ecoponto/format";
import type { Falha } from "../api.ts";
import { formBuscaGuia, type Contexto, type Vista } from "../contexto.ts";
import { h, substituir } from "../dom.ts";
import { FOTOS_EXEMPLO } from "../exemplos.gerado.ts";
import { icone } from "../icons.ts";
import { FotoIlegivel } from "../imagem.ts";
import { conecteSe, skeleton } from "./estados.ts";

export function montarPossoLevar(ctx: Contexto, painel: HTMLElement): Vista {
  let previa: string | null = null;
  let ultimaFoto: Blob | null = null;
  let execucao = 0;

  const soltarPrevia = () => {
    if (previa) URL.revokeObjectURL(previa);
    previa = null;
  };

  // ---- Início ----
  function inicio(): void {
    soltarPrevia();
    ultimaFoto = null;
    if (!ctx.online()) {
      substituir(painel, cabecalho(), conecteSe(linkGuia("Ver o guia de materiais")));
      return;
    }
    const camera = h("input", { id: "foto-camera", class: "visually-hidden", type: "file", accept: "image/*", capture: "environment" });
    const galeria = h("input", { id: "foto-galeria", class: "visually-hidden", type: "file", accept: "image/*" });
    for (const input of [camera, galeria]) {
      input.addEventListener("change", () => {
        const f = input.files?.[0];
        input.value = "";
        if (f) void ctx.acompanhar(analisar(f));
      });
    }
    substituir(
      painel,
      cabecalho(),
      h(
        "div",
        { class: "acoes-foto" },
        // <label> ligado ao input: abre a câmera também em webviews que bloqueiam input.click().
        h("label", { class: "botao botao--largo", for: "foto-camera" }, icone("camera"), "Fotografar item"),
        camera,
        h("label", { class: "botao botao--largo botao--secundario", for: "foto-galeria" }, icone("image-up"), "Escolher da galeria"),
        galeria,
      ),
      h(
        "ul",
        { class: "dicas" },
        h("li", null, icone("lightbulb", "icon--sm"), "Fotografe um item por vez, com boa luz."),
        h("li", null, icone("shield-check", "icon--sm"), "A foto é usada só para esta resposta e não fica guardada."),
      ),
      ctx.fotosExemplo ? exemplos() : null,
    );
  }

  function cabecalho(): HTMLElement {
    return h("div", { class: "intro" }, h("h2", { class: "titulo-secao" }, "Posso levar?"), h("p", null, "Fotografe um item e veja se o ecoponto recebe."));
  }

  function linkGuia(texto: string): HTMLButtonElement {
    return h("button", { type: "button", class: "link link--botao", "on:click": () => ctx.irPara({ aba: "guia", busca: "" }) }, icone("book-open", "icon--sm"), texto);
  }

  /** Só na demonstração (IA mock): fotos prontas, sem precisar de câmera. */
  function exemplos(): HTMLElement {
    return h(
      "details",
      { class: "exemplos" },
      h("summary", null, "Testar com fotos de exemplo (demonstração)"),
      h(
        "ul",
        { class: "exemplos__lista" },
        FOTOS_EXEMPLO.map((ex) =>
          h(
            "li",
            null,
            h(
              "button",
              {
                type: "button",
                class: "exemplo",
                "data-exemplo": ex.id,
                "on:click": () =>
                  void ctx.acompanhar(
                    fetch(`/reciclar/exemplos/${ex.id}.jpg`)
                      .then((r) => r.blob())
                      .then((b) => analisar(b))
                      .catch(() => mostrarFalha({ tipo: "rede" })),
                  ),
              },
              h("img", { src: `/reciclar/exemplos/${ex.id}.jpg`, alt: "", width: 64, height: 48, loading: "lazy" }),
              h("span", null, ex.legenda),
            ),
          ),
        ),
      ),
    );
  }

  // ---- Análise ----
  async function analisar(arquivo: Blob): Promise<void> {
    const minha = ++execucao;
    soltarPrevia();
    previa = URL.createObjectURL(arquivo);
    substituir(painel, cabecalho(), miniatura(), skeleton("resultado", "Analisando a foto…"));
    if (!ctx.online()) return mostrarFalha({ tipo: "rede" });

    let foto: Blob;
    try {
      foto = await ctx.prepararFoto(arquivo);
    } catch (e) {
      if (!(e instanceof FotoIlegivel)) ctx.reportar(e, { etapa: "prepararFoto" });
      return mostrarFalha({ tipo: "imagem_invalida" });
    }
    ultimaFoto = foto;
    const r = await ctx.api.analisar(foto);
    if (minha !== execucao) return; // outra foto foi escolhida no meio
    if (r.ok) mostrarResultado(r.dados);
    else mostrarFalha(r.falha);
  }

  function miniatura(): HTMLElement | null {
    return previa ? h("img", { class: "previa", src: previa, alt: "Sua foto" }) : null;
  }

  function botaoOutra(texto = "Analisar outro item"): HTMLButtonElement {
    return h("button", { type: "button", class: "botao botao--largo botao--secundario", "on:click": () => inicio() }, icone("camera"), texto);
  }

  function focar(el: HTMLElement): void {
    el.setAttribute("tabindex", "-1");
    queueMicrotask(() => el.focus({ preventScroll: false }));
  }

  // ---- Resultados ----
  function mostrarResultado(a: Analise): void {
    let cartao: HTMLElement;
    if (a.resultado === "aceito") {
      cartao = h(
        "article",
        { class: "resultado resultado--aceito", "data-resultado": "aceito" },
        faixa("circle-check", "Aceito", "O ecoponto recebe este item."),
        h(
          "div",
          { class: "resultado__corpo" },
          h("h3", { class: "resultado__item" }, `${a.materialNome}: ${minuscula(a.item.nome)}`),
          h("h4", { class: "resultado__subtitulo" }, "Como preparar"),
          h("ul", { class: "lista-preparo" }, a.preparo.map((p) => h("li", null, icone("circle-check", "icon--sm"), p))),
          h(
            "p",
            { class: "estimativa" },
            icone("sparkles", "icon--sm"),
            h("span", null, `Vale cerca de ${formatValor(a.estimativa)}.`),
          ),
          h("p", { class: "nota" }, `Tabela de valores ${a.tabela.versao}, em vigor desde ${formatDataSimples(a.tabela.vigenteDesde)}. O valor final depende do peso na balança do ecoponto.`),
          h("a", { class: "botao botao--largo", href: ctx.links.ecopontos }, icone("map-pin"), "Ver ecopontos"),
          botaoOutra(),
        ),
      );
    } else if (a.resultado === "nao_aceito") {
      cartao = h(
        "article",
        { class: "resultado resultado--nao-aceito", "data-resultado": "nao_aceito" },
        faixa("circle-x", "Não aceito", "O ecoponto não recebe este item."),
        h(
          "div",
          { class: "resultado__corpo" },
          h("h3", { class: "resultado__item" }, a.item.nome),
          h("dl", { class: "dados" }, h("div", null, h("dt", null, "Por quê"), h("dd", null, a.motivo)), h("div", null, h("dt", null, "Onde descartar"), h("dd", null, a.ondeDescartar))),
          botaoOutra(),
        ),
      );
    } else {
      cartao = h(
        "article",
        { class: "resultado resultado--incerto", "data-resultado": "incerto" },
        faixa("circle-question-mark", "Não temos certeza.", "A foto não deu para identificar bem."),
        h(
          "div",
          { class: "resultado__corpo" },
          a.sugestoes.length
            ? [
                h("h3", { class: "resultado__subtitulo" }, "Pode ser:"),
                h(
                  "ul",
                  { class: "sugestoes" },
                  a.sugestoes.map((s) =>
                    h(
                      "li",
                      null,
                      h(
                        "button",
                        { type: "button", class: "sugestao", "on:click": () => ctx.irPara({ aba: "guia", busca: s.nome }) },
                        h("span", null, h("strong", null, s.nome), h("span", { class: "sugestao__cat" }, CATEGORIA_GUIA[s.categoria].rotulo)),
                        icone("chevron-right", "icon--sm"),
                      ),
                    ),
                  ),
                ),
              ]
            : h("p", null, "Tente outra foto, com o item sozinho e com boa luz, ou procure no guia."),
          h("button", { type: "button", class: "botao botao--largo", "on:click": () => ctx.irPara({ aba: "guia", busca: "" }, { focarBusca: true }) }, icone("book-open"), "Procurar no guia"),
          botaoOutra("Tentar outra foto"),
        ),
      );
    }
    substituir(painel, cabecalho(), miniatura(), cartao);
    focar(cartao.querySelector<HTMLElement>(".resultado__titulo")!);
  }

  function faixa(nome: "circle-check" | "circle-x" | "circle-question-mark", titulo: string, texto: string): HTMLElement {
    return h("div", { class: "resultado__faixa" }, icone(nome), h("div", null, h("p", { class: "resultado__titulo" }, titulo), h("p", null, texto)));
  }

  function mostrarFalha(f: Falha): void {
    if (f.tipo === "rede" && !ctx.online()) {
      substituir(painel, cabecalho(), conecteSe(linkGuia("Ver o guia de materiais")));
      return;
    }
    let titulo = "Não conseguimos analisar a foto agora.";
    let texto = "Procure o item no guia:";
    let comFoto = true;
    if (f.tipo === "limite_diario") {
      titulo = `Você já analisou ${f.limite ?? "o máximo de"} fotos hoje.`;
      texto = "Amanhã você pode fotografar de novo. Enquanto isso, procure no guia:";
      comFoto = false;
    } else if (f.tipo === "imagem_invalida") {
      titulo = "Não conseguimos abrir esta foto.";
      texto = "Tente outra foto ou procure no guia:";
      comFoto = false;
    } else if (f.tipo === "nao_autenticado") {
      titulo = "Sua sessão terminou.";
      texto = "Feche esta tela e abra Reciclar Certo de novo pelo app. Enquanto isso, procure no guia:";
      comFoto = false;
    }
    const caixa = h(
      "div",
      { class: "caixa caixa--erro", role: "alert", "data-estado": f.tipo === "tempo" ? "tempo-esgotado" : "erro" },
      icone("triangle-alert"),
      h("div", { class: "caixa__texto" }, h("p", { class: "caixa__titulo" }, titulo)),
    );
    const repetir =
      comFoto && ultimaFoto
        ? h("button", { type: "button", class: "botao botao--largo botao--secundario", "on:click": () => ultimaFoto && void ctx.acompanhar(analisar(ultimaFoto)) }, icone("refresh-cw"), "Tentar de novo")
        : null;
    substituir(painel, cabecalho(), miniatura(), caixa, h("p", null, texto), formBuscaGuia(ctx, "busca-alternativa", "Buscar no guia"), repetir, botaoOutra("Fotografar outro item"));
  }

  inicio();
  return {
    destruir() {
      execucao++;
      soltarPrevia();
      ultimaFoto = null;
    },
    mudouConexao() {
      // Só a tela inicial muda sozinha; um resultado na tela continua.
      if (painel.querySelector(".acoes-foto") || painel.querySelector('[data-estado="offline"]')) inicio();
    },
  };
}

/** "Lata de alumínio" → "lata de alumínio" (depois de "Metal: "). Siglas ficam. */
function minuscula(nome: string): string {
  const [p, ...resto] = nome.split(" ");
  if (!p) return nome;
  const primeira = /^[A-ZÀ-Ý]{2,}$/.test(p) ? p : p.charAt(0).toLowerCase() + p.slice(1);
  return [primeira, ...resto].join(" ");
}

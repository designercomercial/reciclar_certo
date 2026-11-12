/**
 * Aba "Jogo da Separação" (T45, Fase 3).
 *
 * Duas formas de jogar, as duas com teclado e leitor de tela:
 *  - arrastar o item até a lixeira (Pointer Events: dedo, mouse ou caneta);
 *  - tocar no item e depois na lixeira (no teclado: Enter no item, Enter na lixeira).
 * Uma região aria-live anuncia o item, a lixeira escolhida e o resultado.
 *
 * O aparelho mostra o retorno de cada jogada; o servidor corrige de novo e
 * decide o XP (só na primeira partida do dia em Boa Vista).
 * Comemorações (T47): nenhuma animação com "reduzir movimento" ligado.
 */
import { LIXEIRAS, type EstadoJogo, type Lixeira, type PartidaResposta, type Resposta } from "@ecoponto/contracts";
import { explicacaoLixeira, LIXEIRA } from "@ecoponto/format";
import { itemDoJogo, sortearItens, type ItemJogo } from "@ecoponto/regras";
import type { Contexto, Vista } from "../contexto.ts";
import { h, substituir } from "../dom.ts";
import { icone } from "../icons.ts";
import { botaoTentar, conecteSe, erroConexao, skeleton } from "./estados.ts";

/** Distância (px) que o dedo precisa andar para virar "arrastar" (abaixo disso é toque). */
const LIMIAR_ARRASTO = 8;

export function montarJogo(ctx: Contexto, painel: HTMLElement): Vista {
  let estado: Extract<EstadoJogo, { ativo: true }> | null = null;
  let fase: "carregando" | "intro" | "jogando" | "fim" = "carregando";
  let ativo = true;
  let limparArrasto: (() => void) | null = null;

  const intro = () => h("div", { class: "intro" }, h("h2", { class: "titulo-secao" }, "Jogo da Separação"), h("p", null, "Separe os itens nas lixeiras certas."));
  const focar = (el: HTMLElement | null) => {
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    queueMicrotask(() => el.focus());
  };

  // ---- Carregar estado (ligado? ainda dá XP hoje?) ----
  async function carregar(): Promise<void> {
    fase = "carregando";
    if (!ctx.online()) {
      substituir(painel, intro(), conecteSe());
      return;
    }
    substituir(painel, intro(), skeleton("jogo"));
    const r = await ctx.api.estadoJogo();
    if (!ativo) return;
    if (!r.ok) {
      if (r.falha.tipo === "rede" && !ctx.online()) substituir(painel, intro(), conecteSe());
      else substituir(painel, intro(), erroConexao(r.falha, ctx.online(), () => void ctx.acompanhar(carregar()), "o jogo"));
      return;
    }
    ctx.jogoMudou(r.dados);
    if (!r.dados.ativo) return; // o app esconde a aba e volta para "Posso levar?"
    estado = r.dados;
    mostrarIntro();
  }

  function mostrarIntro(): void {
    if (!estado) return;
    fase = "intro";
    substituir(
      painel,
      intro(),
      h(
        "ul",
        { class: "como-jogar" },
        h("li", null, icone("hand", "icon--sm"), "Arraste o item até a lixeira."),
        h("li", null, icone("circle-check", "icon--sm"), "Ou toque no item e depois na lixeira."),
        h("li", null, icone("info", "icon--sm"), "No teclado: Enter no item e depois Enter na lixeira."),
      ),
      estado.xpDisponivelHoje
        ? h("div", { class: "caixa caixa--info" }, icone("sparkles"), h("p", null, `A primeira partida do dia vale até ${estado.xpMaximo} XP.`))
        : h("div", { class: "caixa caixa--info" }, icone("info"), h("p", null, "Hoje você já ganhou XP. Esta partida é treino.")),
      h("button", { type: "button", class: "botao botao--largo", "on:click": () => comecar() }, icone("gamepad-2"), "Começar partida"),
    );
  }

  // ---- Partida ----
  function comecar(): void {
    if (!estado) return;
    fase = "jogando";
    const itens = sortearItens(estado.itensPorPartida, ctx.aleatorio);
    const respostas: Resposta[] = [];
    let indice = 0;
    let selecionado = false;
    let ignorarClique = false;
    const idPartida = ctx.gerarId();

    const progresso = h("p", { class: "jogo__progresso" });
    const barra = h("span", { class: "barra__preenchido" });
    const retorno = h("div", { class: "jogo__retorno" });
    const anuncio = h("p", { class: "visually-hidden", "aria-live": "polite", "data-anuncio": "" });
    const nomeItem = h("strong", { class: "item-jogo__nome" });
    const item = h(
      "button",
      { type: "button", class: "item-jogo", "aria-pressed": "false", "aria-describedby": "jogo-instrucao" },
      h("span", { class: "item-jogo__rotulo" }, "Item"),
      nomeItem,
    );
    const instrucao = h("p", { id: "jogo-instrucao", class: "jogo__instrucao" }, "Arraste até a lixeira certa, ou toque no item e depois na lixeira.");

    const botoesLixeira = LIXEIRAS.map((l) => {
      const info = LIXEIRA[l];
      return h(
        "button",
        { type: "button", class: `lixeira lixeira--${l}`, "data-lixeira": l, "aria-label": `Lixeira ${info.cor}: ${info.nome.toLowerCase()}` },
        h("span", { class: "lixeira__icone" }, icone(info.icone)),
        h("span", { class: "lixeira__nome" }, info.nome),
        h("span", { class: "lixeira__cor" }, info.cor),
      );
    });
    const lixeiras = h("div", { class: "lixeiras", role: "group", "aria-label": "Lixeiras" }, botoesLixeira);

    /** Fala para o leitor de tela (limpa antes para repetir frases iguais). */
    function anunciar(texto: string): void {
      anuncio.textContent = "";
      setTimeout(() => {
        anuncio.textContent = texto;
      }, 30);
    }

    function atual(): ItemJogo {
      return itens[indice]!;
    }

    function mostrarItem(): string {
      selecionado = false;
      item.setAttribute("aria-pressed", "false");
      item.classList.remove("item-jogo--selecionado");
      const it = atual();
      nomeItem.textContent = it.nome;
      item.setAttribute("aria-label", `${it.nome}. Item ${indice + 1} de ${itens.length}.`);
      progresso.textContent = `Item ${indice + 1} de ${itens.length}`;
      barra.style.width = `${(indice / itens.length) * 100}%`;
      return `Item ${indice + 1} de ${itens.length}: ${it.nome}. Escolha a lixeira.`;
    }

    function responder(l: Lixeira, botao: HTMLElement): void {
      if (fase !== "jogando") return;
      const it = atual();
      const certo = it.lixeira === l;
      respostas.push({ itemId: it.id, lixeira: l });
      const explicacao = explicacaoLixeira(it.nome, it.lixeira);
      const texto = certo ? `Acertou! ${explicacao}` : `Não foi dessa vez. ${explicacao}`;
      substituir(
        retorno,
        h(
          "div",
          { class: `caixa ${certo ? "caixa--sucesso" : "caixa--erro"}`, "data-jogada": certo ? "acerto" : "erro" },
          icone(certo ? "circle-check" : "circle-x"),
          h("p", null, texto),
        ),
      );
      if (certo && !ctx.movimentoReduzido()) {
        botao.classList.remove("anima-acerto");
        void botao.offsetWidth; // reinicia a animação
        botao.classList.add("anima-acerto");
        setTimeout(() => botao.classList.remove("anima-acerto"), 700);
      }
      indice++;
      if (indice >= itens.length) {
        anunciar(texto);
        void ctx.acompanhar(terminar(idPartida, respostas));
        return;
      }
      anunciar(`${texto} ${mostrarItem()}`);
    }

    // Toque / teclado
    item.addEventListener("click", () => {
      if (ignorarClique) {
        ignorarClique = false;
        return;
      }
      selecionado = !selecionado;
      item.setAttribute("aria-pressed", String(selecionado));
      item.classList.toggle("item-jogo--selecionado", selecionado);
      anunciar(selecionado ? `${atual().nome} selecionado. Agora escolha a lixeira.` : `${atual().nome}: seleção desfeita.`);
    });
    botoesLixeira.forEach((b, n) => {
      b.addEventListener("click", () => responder(LIXEIRAS[n]!, b));
      // Setas andam entre as lixeiras.
      b.addEventListener("keydown", (e) => {
        const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!passo) return;
        e.preventDefault();
        botoesLixeira[(n + passo + botoesLixeira.length) % botoesLixeira.length]!.focus();
      });
    });

    // Arrastar
    item.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0 || fase !== "jogando") return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let fantasma: HTMLElement | null = null;
      let alvo: HTMLElement | null = null;
      const marcarAlvo = (novo: HTMLElement | null) => {
        if (novo === alvo) return;
        alvo?.classList.remove("lixeira--alvo");
        alvo = novo;
        alvo?.classList.add("lixeira--alvo");
      };
      const mover = (ev: PointerEvent) => {
        if (!fantasma) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < LIMIAR_ARRASTO) return;
          fantasma = h("div", { class: "item-jogo item-jogo--fantasma", "aria-hidden": "true" }, h("strong", { class: "item-jogo__nome" }, atual().nome));
          document.body.append(fantasma);
          item.classList.add("item-jogo--arrastando");
        }
        fantasma.style.left = `${ev.clientX}px`;
        fantasma.style.top = `${ev.clientY}px`;
        const sob = document.elementFromPoint(ev.clientX, ev.clientY);
        marcarAlvo((sob?.closest?.(".lixeira") as HTMLElement | null) ?? null);
      };
      const soltar = (ev: PointerEvent) => {
        const arrastou = fantasma !== null;
        const destino = alvo;
        fim();
        if (!arrastou) return; // foi um toque: o click cuida
        ignorarClique = true;
        setTimeout(() => (ignorarClique = false), 0);
        if (destino && ev.type === "pointerup") {
          responder(destino.dataset.lixeira as Lixeira, destino);
          item.focus();
        }
      };
      const fim = () => {
        marcarAlvo(null);
        fantasma?.remove();
        item.classList.remove("item-jogo--arrastando");
        document.removeEventListener("pointermove", mover);
        document.removeEventListener("pointerup", soltar);
        document.removeEventListener("pointercancel", soltar);
        limparArrasto = null;
      };
      limparArrasto = fim;
      document.addEventListener("pointermove", mover);
      document.addEventListener("pointerup", soltar);
      document.addEventListener("pointercancel", soltar);
    });

    const primeiro = mostrarItem();
    substituir(
      painel,
      h("h2", { class: "titulo-secao visually-hidden" }, "Jogo da Separação"),
      h("div", { class: "jogo__topo" }, progresso, h("span", { class: "barra", "aria-hidden": "true" }, barra)),
      h("div", { class: "jogo__mesa" }, item, instrucao),
      lixeiras,
      retorno,
      anuncio,
    );
    item.focus();
    anunciar(`Partida começou. ${primeiro} Lixeiras: ${LIXEIRAS.map((l) => `${LIXEIRA[l].nome}, ${LIXEIRA[l].cor}`).join("; ")}.`);
  }

  // ---- Fim ----
  async function terminar(id: string, respostas: Resposta[]): Promise<void> {
    fase = "fim";
    limparArrasto?.();
    substituir(painel, skeleton("partida", "Registrando sua partida…"));
    const r = await ctx.api.registrarPartida({ id, respostas });
    if (!ativo) return;

    const acertosLocais = respostas.filter((x) => itemDoJogo(x.itemId)?.lixeira === x.lixeira).length;
    const erros = respostas.filter((x) => itemDoJogo(x.itemId)?.lixeira !== x.lixeira);
    const titulo = h("h2", { class: "titulo-secao" }, "Fim da partida");
    const revisao = erros.length
      ? h(
          "div",
          { class: "revisao" },
          h("h3", { class: "categoria__sub" }, "Para lembrar"),
          h("ul", { class: "lista-simples" }, erros.map((x) => {
            const it = itemDoJogo(x.itemId)!;
            return h("li", null, icone("lightbulb", "icon--sm"), explicacaoLixeira(it.nome, it.lixeira));
          })),
        )
      : null;
    const deNovo = h("button", { type: "button", class: "botao botao--largo", "on:click": () => comecar() }, icone("refresh-cw"), "Jogar de novo");

    if (!r.ok) {
      const semRede = r.falha.tipo === "rede" && !ctx.online();
      substituir(
        painel,
        titulo,
        h("p", { class: "placar" }, `Você acertou ${acertosLocais} de ${respostas.length}.`),
        h(
          "div",
          { class: "caixa caixa--erro", role: "alert" },
          icone(semRede ? "wifi-off" : "triangle-alert"),
          h("div", { class: "caixa__texto" }, h("p", { class: "caixa__titulo" }, "Não conseguimos registrar sua partida."), h("p", null, semRede ? "Conecte-se à internet e tente de novo para contar o XP." : "Tente de novo para contar o XP.")),
        ),
        // Mesmo id: se o servidor já tinha gravado, devolve o mesmo resultado.
        botaoTentar(() => void ctx.acompanhar(terminar(id, respostas)), "botao botao--largo"),
        revisao,
        deNovo,
      );
      focar(titulo);
      return;
    }

    const p: PartidaResposta = r.dados;
    if (estado && p.xpConcedido > 0) {
      estado = { ...estado, xpDisponivelHoje: false };
      ctx.jogoMudou(estado);
    }
    const comemorar = p.acertos > 0 && !ctx.movimentoReduzido();
    substituir(
      painel,
      h(
        "div",
        { class: "fim" },
        h("span", { class: `fim__trofeu${comemorar ? " anima-trofeu" : ""}` }, icone("trophy")),
        comemorar ? h("span", { class: "celebracao anima-celebracao", "aria-hidden": "true" }, Array.from({ length: 12 }, (_, n) => h("span", { style: `--n:${n}` }))) : null,
        titulo,
        h("p", { class: "placar", "data-placar": "" }, `Você acertou ${p.acertos} de ${p.total}.`),
      ),
      p.xpConcedido > 0
        ? h("div", { class: "caixa caixa--sucesso", "data-xp": String(p.xpConcedido) }, icone("sparkles"), h("p", { class: "caixa__titulo" }, `Você ganhou ${p.xpConcedido} XP.`))
        : h("div", { class: "caixa caixa--info", "data-xp": "0" }, icone("info"), h("p", null, "Partida extra: hoje você já ganhou XP, mas o treino vale.")),
      revisao,
      deNovo,
    );
    focar(titulo);
  }

  void ctx.acompanhar(carregar());

  return {
    destruir() {
      ativo = false;
      limparArrasto?.();
    },
    mudouConexao() {
      if (fase === "carregando" || fase === "intro") void ctx.acompanhar(carregar());
    },
  };
}

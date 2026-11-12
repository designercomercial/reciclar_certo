/** Tela "Jogo da Separação" contra a API real (XP controlado no servidor). */
import { describe, expect, it } from "vitest";
import { LIXEIRAS } from "@ecoponto/contracts";
import { ITENS_JOGO } from "@ecoponto/regras";
import type { XpMock } from "@ecoponto/api";
import { clicar, fetchComo, fetchSemRede, montar, novaApi, texto, type Montagem } from "./test/ambiente.ts";

const lixeiraCerta = (nome: string) => ITENS_JOGO.find((i) => i.nome === nome)!.lixeira;
const nomeAtual = (raiz: HTMLElement) => texto(raiz.querySelector(".item-jogo__nome"));
const botaoLixeira = (raiz: HTMLElement, l: string) => raiz.querySelector<HTMLButtonElement>(`.lixeira[data-lixeira="${l}"]`)!;

async function comecar(m: Montagem) {
  clicar([...m.raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Começar partida")));
}

/** Joga a partida inteira tocando no item e depois na lixeira. */
async function jogarPorToque(m: Montagem, errar = 0) {
  for (let n = 0; n < 10; n++) {
    const nome = nomeAtual(m.raiz);
    clicar(m.raiz.querySelector(".item-jogo"));
    const certa = lixeiraCerta(nome);
    const escolha = n < errar ? LIXEIRAS.find((l) => l !== certa)! : certa;
    clicar(botaoLixeira(m.raiz, escolha));
  }
  await m.app.ocioso();
}

describe("Jogo da Separação", () => {
  it("jogo desligado: a aba não aparece e /reciclar/jogo volta para Posso levar?", async () => {
    const { raiz } = await montar("/reciclar/jogo", fetchComo(await novaApi({ jogoAtivo: false })));
    expect(raiz.querySelector<HTMLElement>('[data-aba="jogo"]')!.hidden).toBe(true);
    expect(location.pathname).toBe("/reciclar/");
    expect(raiz.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-aba")).toBe("posso-levar");
  });

  it("jogo ligado: a aba aparece", async () => {
    const { raiz } = await montar("/reciclar/", fetchComo(await novaApi()));
    expect(raiz.querySelector<HTMLElement>('[data-aba="jogo"]')!.hidden).toBe(false);
  });

  it("lixeiras com nome, cor por extenso e ícone, nunca só a cor", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()));
    await comecar(m);
    const nomes = [...m.raiz.querySelectorAll(".lixeira")].map((b) => b.getAttribute("aria-label"));
    expect(nomes).toEqual(["Lixeira azul: papel", "Lixeira vermelha: plástico", "Lixeira verde: vidro", "Lixeira amarela: metal", "Lixeira marrom: orgânico", "Lixeira cinza: não reciclável"]);
    for (const b of m.raiz.querySelectorAll(".lixeira")) {
      expect(b.querySelector("svg.icon")).not.toBeNull();
      expect(texto(b.querySelector(".lixeira__nome"))).not.toBe("");
      expect(b.tagName).toBe("BUTTON"); // teclado nativo: Tab + Enter/Espaço
    }
  });

  it("por toque: 10 itens, retorno a cada jogada, acertos e XP no fim; a 2ª partida é extra (critério 7)", async () => {
    const api = await novaApi();
    const m = await montar("/reciclar/jogo", fetchComo(api));
    expect(texto(m.raiz.querySelector(".caixa--info"))).toBe("A primeira partida do dia vale até 20 XP.");
    await comecar(m);
    expect(texto(m.raiz.querySelector(".jogo__progresso"))).toBe("Item 1 de 10");

    // Primeira jogada errada, para ver o retorno de erro.
    const nome = nomeAtual(m.raiz);
    clicar(m.raiz.querySelector(".item-jogo"));
    expect(m.raiz.querySelector(".item-jogo")!.getAttribute("aria-pressed")).toBe("true");
    const certa = lixeiraCerta(nome);
    clicar(botaoLixeira(m.raiz, LIXEIRAS.find((l) => l !== certa)!));
    expect(texto(m.raiz.querySelector('[data-jogada="erro"]'))).toMatch(new RegExp(`^Não foi dessa vez\\. ${nome} vai na lixeira \\w+\\.$`));
    expect(texto(m.raiz.querySelector(".jogo__progresso"))).toBe("Item 2 de 10");

    // As outras 9 certas.
    for (let n = 1; n < 10; n++) {
      const atual = nomeAtual(m.raiz);
      clicar(m.raiz.querySelector(".item-jogo"));
      clicar(botaoLixeira(m.raiz, lixeiraCerta(atual)));
      if (n < 9) expect(m.raiz.querySelector('[data-jogada="acerto"]')).not.toBeNull();
    }
    await m.app.ocioso();
    expect(texto(m.raiz.querySelector("[data-placar]"))).toBe("Você acertou 9 de 10.");
    expect(texto(m.raiz.querySelector("[data-xp]"))).toBe("Você ganhou 19 XP.");
    expect(texto(m.raiz.querySelector(".revisao"))).toContain(`${nome} vai na lixeira`);
    expect((api.xp as XpMock).eventos.map((e) => e.xp)).toEqual([19]);

    // Jogar de novo: partida extra, sem XP.
    clicar([...m.raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Jogar de novo")));
    await jogarPorToque(m);
    expect(texto(m.raiz.querySelector("[data-placar]"))).toBe("Você acertou 10 de 10.");
    expect(texto(m.raiz.querySelector('[data-xp="0"]'))).toBe("Partida extra: hoje você já ganhou XP, mas o treino vale.");
    expect((api.xp as XpMock).eventos).toHaveLength(1);
  });

  it("quem já ganhou XP hoje vê o aviso antes de começar", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi(), "dev-cidadao-bruno"));
    expect(texto(m.raiz.querySelector(".caixa--info"))).toBe("Hoje você já ganhou XP. Esta partida é treino.");
  });

  it("por arrastar: soltar o item sobre a lixeira responde", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()));
    await comecar(m);
    const nome = nomeAtual(m.raiz);
    const destino = botaoLixeira(m.raiz, lixeiraCerta(nome));
    const original = document.elementFromPoint;
    document.elementFromPoint = () => destino.querySelector(".lixeira__nome");
    try {
      const item = m.raiz.querySelector(".item-jogo")!;
      item.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new PointerEvent("pointermove", { clientX: 130, clientY: 180, bubbles: true }));
      expect(document.querySelector(".item-jogo--fantasma")).not.toBeNull();
      expect(destino.classList.contains("lixeira--alvo")).toBe(true);
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 130, clientY: 180, bubbles: true }));
      item.dispatchEvent(new MouseEvent("click", { bubbles: true })); // o click que o navegador manda depois
    } finally {
      document.elementFromPoint = original;
    }
    expect(document.querySelector(".item-jogo--fantasma")).toBeNull();
    expect(texto(m.raiz.querySelector('[data-jogada="acerto"]'))).toContain(`Acertou! ${nome} vai na lixeira`);
    expect(texto(m.raiz.querySelector(".jogo__progresso"))).toBe("Item 2 de 10");
    // O click depois do arrasto não vira "selecionar".
    expect(m.raiz.querySelector(".item-jogo")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("um toque curto não vira arrasto", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()));
    await comecar(m);
    const item = m.raiz.querySelector<HTMLElement>(".item-jogo")!;
    item.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 103, clientY: 102, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointerup", { clientX: 103, clientY: 102, bubbles: true }));
    item.click();
    expect(document.querySelector(".item-jogo--fantasma")).toBeNull();
    expect(item.getAttribute("aria-pressed")).toBe("true");
    expect(texto(m.raiz.querySelector(".jogo__progresso"))).toBe("Item 1 de 10");
  });

  it("teclado: setas andam entre as lixeiras; o foco começa no item", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()));
    await comecar(m);
    expect(document.activeElement?.classList.contains("item-jogo")).toBe(true);
    const papel = botaoLixeira(m.raiz, "papel");
    papel.focus();
    papel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(botaoLixeira(m.raiz, "plastico"));
    botaoLixeira(m.raiz, "plastico").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    papel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.activeElement).toBe(botaoLixeira(m.raiz, "nao_reciclavel"));
  });

  it("leitor de tela: anuncia o item, as lixeiras e o resultado", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()));
    await comecar(m);
    const anuncio = m.raiz.querySelector("[data-anuncio]")!;
    expect(anuncio.getAttribute("aria-live")).toBe("polite");
    await new Promise((r) => setTimeout(r, 50));
    const primeiro = nomeAtual(m.raiz);
    expect(texto(anuncio)).toContain(`Item 1 de 10: ${primeiro}. Escolha a lixeira.`);
    expect(texto(anuncio)).toContain("Papel, azul; Plástico, vermelha; Vidro, verde; Metal, amarela; Orgânico, marrom; Não reciclável, cinza");
    expect(m.raiz.querySelector(".item-jogo")!.getAttribute("aria-label")).toBe(`${primeiro}. Item 1 de 10.`);

    clicar(m.raiz.querySelector(".item-jogo"));
    await new Promise((r) => setTimeout(r, 50));
    expect(texto(anuncio)).toBe(`${primeiro} selecionado. Agora escolha a lixeira.`);

    clicar(botaoLixeira(m.raiz, lixeiraCerta(primeiro)));
    await new Promise((r) => setTimeout(r, 50));
    expect(texto(anuncio)).toMatch(new RegExp(`^Acertou! ${primeiro} vai na lixeira \\w+\\. Item 2 de 10: .+\\. Escolha a lixeira\\.$`));
  });

  it("comemora sem 'reduzir movimento'", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()), { movimentoReduzido: () => false });
    await comecar(m);
    const nome = nomeAtual(m.raiz);
    clicar(botaoLixeira(m.raiz, lixeiraCerta(nome)));
    expect(m.raiz.querySelector(".anima-acerto")).not.toBeNull();
    await jogarPorToqueRestante(m, 9);
    expect(m.raiz.querySelector(".anima-celebracao")).not.toBeNull();
  });

  it("com 'reduzir movimento' ligado, nenhuma animação roda (critério 8)", async () => {
    const m = await montar("/reciclar/jogo", fetchComo(await novaApi()), { movimentoReduzido: () => true });
    await comecar(m);
    await jogarPorToque(m);
    expect(texto(m.raiz.querySelector("[data-placar]"))).toBe("Você acertou 10 de 10.");
    expect(m.raiz.querySelector("[class*='anima-']")).toBeNull();
    expect(m.raiz.querySelector(".celebracao")).toBeNull();
  });

  it("sem internet → Conecte-se à internet para usar.", async () => {
    const storage = (await import("./test/ambiente.ts")).memoria();
    storage.setItem("eco-reciclar:v1:jogo-ativo", JSON.stringify({ dados: true, salvoEm: "2026-11-12T09:00:00-04:00" }));
    const { raiz } = await montar("/reciclar/jogo", fetchSemRede, { online: false, storage });
    expect(raiz.querySelector<HTMLElement>('[data-aba="jogo"]')!.hidden).toBe(false);
    expect(texto(raiz.querySelector('[data-estado="offline"] .estado__titulo'))).toBe("Conecte-se à internet para usar.");
  });

  it("falha ao registrar: mostra os acertos e deixa tentar de novo com a mesma partida", async () => {
    const api = await novaApi();
    let cair = true;
    const normal = fetchComo(api);
    const ids: string[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/jogo/partidas")) {
        ids.push((JSON.parse(String(init?.body)) as { id: string }).id);
        if (cair) throw new TypeError("Failed to fetch");
      }
      return normal(input, init);
    }) as typeof fetch;
    const m = await montar("/reciclar/jogo", fetcher);
    await comecar(m);
    await jogarPorToque(m);
    expect(texto(m.raiz.querySelector('[role="alert"] .caixa__titulo'))).toBe("Não conseguimos registrar sua partida.");
    expect(texto(m.raiz.querySelector(".placar"))).toBe("Você acertou 10 de 10.");
    cair = false;
    clicar([...m.raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Tentar novamente")));
    await m.app.ocioso();
    expect(texto(m.raiz.querySelector("[data-xp]"))).toBe("Você ganhou 20 XP.");
    expect(new Set(ids).size).toBe(1);
  });
});

async function jogarPorToqueRestante(m: Montagem, quantos: number) {
  for (let n = 0; n < quantos; n++) {
    const nome = nomeAtual(m.raiz);
    clicar(m.raiz.querySelector(".item-jogo"));
    clicar(botaoLixeira(m.raiz, lixeiraCerta(nome)));
  }
  await m.app.ocioso();
}

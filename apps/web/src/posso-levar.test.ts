/** Tela "Posso levar?" contra a API real (IA mock com as fotos de exemplo). */
import { describe, expect, it } from "vitest";
import { dimensoesAlvo } from "./imagem.ts";
import { arquivoFoto, clicar, escolherFoto, fetchComo, fetchPendente, fetchPorRota, fetchSemRede, montar, novaApi, texto, type Pedido } from "./test/ambiente.ts";

describe("Posso levar?", () => {
  it("mostra os dois caminhos: câmera traseira e galeria", async () => {
    const { raiz } = await montar("/reciclar/", fetchComo(await novaApi()));
    const camera = raiz.querySelector<HTMLInputElement>("#foto-camera")!;
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(camera.accept).toBe("image/*");
    expect(raiz.querySelector("#foto-galeria")!.hasAttribute("capture")).toBe(false);
    expect(texto(raiz.querySelector('label[for="foto-camera"]'))).toBe("Fotografar item");
    expect(texto(raiz.querySelector('label[for="foto-galeria"]'))).toBe("Escolher da galeria");
    // Abas acessíveis
    const abas = [...raiz.querySelectorAll('[role="tab"]')];
    expect(abas.map((a) => a.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
  });

  it("lata → Aceito, metal, com estimativa e link para os ecopontos (critério 1)", async () => {
    const api = await novaApi();
    const pedidos: Pedido[] = [];
    const { raiz, app } = await montar("/reciclar/", fetchComo(api, "dev-cidadao-ana", pedidos));
    escolherFoto(raiz, arquivoFoto("lata"), "foto-galeria");
    await app.ocioso();
    const r = raiz.querySelector('[data-resultado="aceito"]');
    expect(r).not.toBeNull();
    expect(texto(r?.querySelector(".resultado__titulo"))).toBe("Aceito");
    expect(texto(r?.querySelector(".resultado__item"))).toBe("Metal: lata de alumínio");
    expect(texto(r)).toContain("Lave e amasse.");
    expect(texto(r?.querySelector(".estimativa"))).toBe("Vale cerca de 45 pontos por kg.");
    expect(r?.querySelector<HTMLAnchorElement>('a[href="/ecopontos/"]')?.textContent).toContain("Ver ecopontos");
    // Sempre ícone + texto
    expect(r?.querySelector('.resultado__faixa [data-icone="circle-check"]')).not.toBeNull();
    expect(pedidos.filter((p) => p.metodo === "POST")).toEqual([{ metodo: "POST", url: "/api/cidadao/reciclar/analisar" }]);
  });

  it("casca de banana → Não aceito, com o motivo e onde descartar (critério 1)", async () => {
    const { raiz, app } = await montar("/reciclar/", fetchComo(await novaApi()));
    escolherFoto(raiz, arquivoFoto("casca-banana"));
    await app.ocioso();
    const r = raiz.querySelector('[data-resultado="nao_aceito"]');
    expect(texto(r?.querySelector(".resultado__titulo"))).toBe("Não aceito");
    expect(texto(r)).toContain("O ecoponto não recebe este item.");
    expect(texto(r)).toContain("Resto de comida vai no lixo comum ou na compostagem.");
    expect(r?.querySelector('[data-icone="circle-x"]')).not.toBeNull();
  });

  it("foto borrada → Não temos certeza, com 2 sugestões e Procurar no guia", async () => {
    const { raiz, app } = await montar("/reciclar/", fetchComo(await novaApi()));
    escolherFoto(raiz, arquivoFoto("foto-borrada"));
    await app.ocioso();
    const r = raiz.querySelector('[data-resultado="incerto"]');
    expect(texto(r?.querySelector(".resultado__titulo"))).toBe("Não temos certeza.");
    expect([...(r?.querySelectorAll(".sugestao strong") ?? [])].map((s) => s.textContent)).toEqual(["Caixa de leite", "Jornal e revista"]);
    const procurar = [...(r?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("Procurar no guia"));
    clicar(procurar);
    await app.ocioso();
    expect(location.pathname).toBe("/reciclar/guia");
    expect(raiz.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-aba")).toBe("guia");
  });

  it("enquanto analisa: skeleton, sem spinner", async () => {
    const api = await novaApi();
    const { raiz } = await montar("/reciclar/", fetchPorRota({ "/api/cidadao/reciclar": fetchPendente }, fetchComo(api)));
    escolherFoto(raiz, arquivoFoto("lata"));
    await new Promise((r) => setTimeout(r, 10));
    expect(raiz.querySelector('[data-estado="carregando"] .sk')).not.toBeNull();
    expect(texto(raiz.querySelector('[role="status"]'))).toBe("Analisando a foto…");
    expect(raiz.querySelector(".spinner, [class*='spin']")).toBeNull();
  });

  it("passou do tempo (5 s) → cancela e mostra a busca do guia (critério 2)", async () => {
    const api = await novaApi();
    const { raiz, app } = await montar("/reciclar/", fetchPorRota({ "/api/cidadao/reciclar": fetchPendente }, fetchComo(api)), { tempoAnaliseMs: 60 });
    escolherFoto(raiz, arquivoFoto("lata"));
    await app.ocioso();
    const erro = raiz.querySelector('[data-estado="tempo-esgotado"]');
    expect(texto(erro)).toBe("Não conseguimos analisar a foto agora.");
    const busca = raiz.querySelector<HTMLInputElement>("#busca-alternativa")!;
    expect(busca.placeholder).toBe("Ex.: garrafa PET, caixa de leite, óleo de cozinha");
    busca.value = "lata";
    busca.form!.requestSubmit();
    await app.ocioso();
    expect(location.pathname + location.search).toBe("/reciclar/guia?q=lata");
    expect(texto(raiz.querySelector('[data-item="lata-aluminio"]'))).toContain("Lata de alumínio");
  });

  it("o tempo de 5 s também vale quando o servidor responde 504 (IA lenta)", async () => {
    const { raiz, app } = await montar("/reciclar/", fetchComo(await novaApi({ tempoLimiteIaMs: 50 })));
    escolherFoto(raiz, arquivoFoto("foto-lenta"));
    await app.ocioso();
    expect(raiz.querySelector('[data-estado="tempo-esgotado"]')).not.toBeNull();
    expect(raiz.querySelector("#busca-alternativa")).not.toBeNull();
  });

  it("IA fora do ar → mensagem de erro com a busca do guia e Tentar de novo", async () => {
    const { raiz, app } = await montar("/reciclar/", fetchComo(await novaApi()));
    escolherFoto(raiz, arquivoFoto("foto-erro"));
    await app.ocioso();
    expect(texto(raiz.querySelector('[role="alert"]'))).toBe("Não conseguimos analisar a foto agora.");
    expect([...raiz.querySelectorAll("button")].some((b) => b.textContent?.includes("Tentar de novo"))).toBe(true);
  });

  it("limite do dia → avisa e oferece o guia", async () => {
    const { raiz, app } = await montar("/reciclar/", fetchComo(await novaApi(), "dev-cidadao-limite"));
    escolherFoto(raiz, arquivoFoto("lata"));
    await app.ocioso();
    expect(texto(raiz.querySelector('[role="alert"]'))).toBe("Você já analisou 30 fotos hoje.");
    expect(raiz.querySelector("#busca-alternativa")).not.toBeNull();
  });

  it("sem internet → Conecte-se à internet para usar.", async () => {
    const { raiz } = await montar("/reciclar/", fetchSemRede, { online: false });
    expect(texto(raiz.querySelector('[data-estado="offline"] .estado__titulo'))).toBe("Conecte-se à internet para usar.");
    expect(raiz.querySelector("#foto-camera")).toBeNull();
  });
});

describe("redução da foto no aparelho", () => {
  it("lado maior de até 1280 px, mantendo a proporção", () => {
    expect(dimensoesAlvo(4000, 3000)).toEqual({ largura: 1280, altura: 960 });
    expect(dimensoesAlvo(3024, 4032)).toEqual({ largura: 960, altura: 1280 });
    expect(dimensoesAlvo(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

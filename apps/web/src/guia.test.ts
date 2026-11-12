/** Tela "Guia de materiais" contra a API real. */
import { describe, expect, it } from "vitest";
import { Guia } from "@ecoponto/contracts";
import { fetchComo, fetchPendente, fetchSemRede, memoria, montar, novaApi, texto } from "./test/ambiente.ts";

async function digitar(raiz: HTMLElement, valor: string) {
  const campo = raiz.querySelector<HTMLInputElement>("#busca-guia")!;
  campo.value = valor;
  campo.dispatchEvent(new Event("input"));
}

describe("Guia de materiais", () => {
  it("carregando: skeleton, sem spinner", async () => {
    const { raiz } = await montar("/reciclar/guia", fetchPendente, { esperar: false });
    expect(raiz.querySelector('[data-estado="carregando"] .sk')).not.toBeNull();
    expect(raiz.querySelector("[class*='spin']")).toBeNull();
  });

  it("lista as 6 categorias com os valores da tabela vigente (critério 5)", async () => {
    const api = await novaApi();
    const doServidor = Guia.parse((await api.inject({ method: "GET", url: "/api/publico/guia-materiais" })).json());
    const { raiz } = await montar("/reciclar/guia", fetchComo(api));
    const cats = [...raiz.querySelectorAll<HTMLElement>(".categoria")];
    expect(cats.map((c) => texto(c.querySelector(".categoria__nome")))).toEqual(["Plástico", "Papel", "Metal", "Vidro", "Óleo de cozinha", "Não aceitos"]);
    for (const c of doServidor.categorias) {
      const el = raiz.querySelector(`[data-categoria="${c.id}"]`)!;
      if (c.valor) expect(texto(el.querySelector(".categoria__valor"))).toBe(`${c.valor.pontos} pontos por ${c.valor.unidade}`);
      // Exemplos aceitos, não aceitos e como preparar
      expect(el.querySelectorAll(".lista-simples--aceito li").length).toBe(c.aceitos.length);
      expect(el.querySelectorAll(".lista-simples--nao-aceito li").length).toBe(c.naoAceitos.length);
      for (const p of c.preparo) expect(texto(el)).toContain(p);
    }
    expect(texto(raiz.querySelector('[data-categoria="metal"] .categoria__valor'))).toBe("45 pontos por kg");
    expect(texto(raiz.querySelector('[data-categoria="oleo"] .categoria__valor'))).toBe("25 pontos por litro");
    expect(texto(raiz)).toContain("Pontos da tabela de valores v3, em vigor desde 01/10/2026.");
  });

  it("o campo de busca tem rótulo e o texto de exemplo da especificação", async () => {
    const { raiz } = await montar("/reciclar/guia", fetchComo(await novaApi()));
    const campo = raiz.querySelector<HTMLInputElement>("#busca-guia")!;
    expect(texto(raiz.querySelector('label[for="busca-guia"]'))).toBe("Buscar no guia");
    expect(campo.placeholder).toBe("Ex.: garrafa PET, caixa de leite, óleo de cozinha");
  });

  it("busca sem acento e com variações (critério 4)", async () => {
    const { raiz } = await montar("/reciclar/guia", fetchComo(await novaApi()));
    const primeiro = () => raiz.querySelector(".lista-itens li")?.getAttribute("data-item");

    await digitar(raiz, "oleo de cozinha");
    expect(primeiro()).toBe("oleo-soja");
    await digitar(raiz, "pet");
    expect(primeiro()).toBe("garrafa-pet");
    await digitar(raiz, "garrafa pet");
    expect(primeiro()).toBe("garrafa-pet");
    await digitar(raiz, "longa vida");
    expect(primeiro()).toBe("caixa-leite");
    expect(texto(raiz.querySelector('[role="status"]'))).toMatch(/item encontrado|itens encontrados/);
    // A busca vai para a URL
    expect(location.search).toBe("?q=longa+vida");
  });

  it("o resultado diz se é aceito, como preparar e onde descartar", async () => {
    const { raiz } = await montar("/reciclar/guia?q=lata", fetchComo(await novaApi()));
    const lata = raiz.querySelector('[data-item="lata-aluminio"]');
    expect(texto(lata?.querySelector(".item-guia__selo"))).toBe("Aceito");
    expect(texto(lata)).toContain("Metal · 45 pontos por kg");
    expect(texto(lata)).toContain("Como preparar: Lave e amasse.");

    const campo = raiz.querySelector<HTMLInputElement>("#busca-guia")!;
    campo.value = "isopor";
    campo.dispatchEvent(new Event("input"));
    const isopor = raiz.querySelector('[data-item="isopor"]');
    expect(texto(isopor?.querySelector(".item-guia__selo"))).toBe("Não aceito");
    expect(texto(isopor)).toContain("Onde descartar:");
  });

  it("nada encontrado: diz o que fazer", async () => {
    const { raiz } = await montar("/reciclar/guia?q=girafa", fetchComo(await novaApi()));
    expect(texto(raiz.querySelector('[data-estado="vazio"] .estado__titulo'))).toBe("Não encontramos “girafa” no guia.");
  });

  it("offline: o guia abre do cache com o aviso de data (critério 9)", async () => {
    const storage = memoria();
    await montar("/reciclar/guia", fetchComo(await novaApi()), { storage });
    const { raiz } = await montar("/reciclar/guia", fetchSemRede, { storage, online: false });
    expect(texto(raiz.querySelector(".faixa-offline p"))).toBe("Sem internet. Guia de 12/11/2026.");
    expect(raiz.querySelectorAll(".categoria")).toHaveLength(6);
    // A busca continua funcionando sem internet.
    await digitar(raiz, "pet");
    expect(raiz.querySelector(".lista-itens li")?.getAttribute("data-item")).toBe("garrafa-pet");
  });

  it("erro de conexão sem cache: mensagem + Tentar novamente", async () => {
    const api = await novaApi();
    let online = false;
    const { raiz, app } = await montar("/reciclar/guia", (...a) => (online ? fetchComo(api)(...a) : fetchSemRede(...a)), { online: () => online });
    expect(texto(raiz.querySelector('[data-estado="erro"] .estado__titulo'))).toBe("Sem internet.");
    online = true;
    [...raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Tentar novamente"))!.click();
    await app.ocioso();
    expect(raiz.querySelectorAll(".categoria")).toHaveLength(6);
  });
});

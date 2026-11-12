/**
 * Ponta a ponta no Chromium (Pixel 5): build de produção, service worker,
 * API com IA mock. Cobre o que só um navegador de verdade mostra.
 */
import { expect, test, type Page } from "@playwright/test";
import { ITENS_JOGO } from "../../../packages/regras/src/jogo.ts";

const FOTOS = "public/exemplos";
const lixeiraDe = (nome: string) => ITENS_JOGO.find((i) => i.nome === nome)!.lixeira;

/** 4G "regular" do Chrome DevTools: 4 Mbps de descida, 3 de subida, 20 ms (+ latência de rádio). */
async function simular4G(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 170,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });
}

test.describe("Posso levar?", () => {
  test("lata e casca de banana no 4G simulado: resultado em menos de 5 s (critérios 1 e 2)", async ({ page }) => {
    await page.goto("/reciclar/");
    await simular4G(page);

    let inicio = Date.now();
    await page.setInputFiles("#foto-galeria", `${FOTOS}/lata.jpg`);
    const aceito = page.locator('[data-resultado="aceito"]');
    await expect(aceito).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - inicio).toBeLessThan(5_000);
    await expect(aceito.locator(".resultado__item")).toHaveText("Metal: lata de alumínio");
    await expect(aceito.locator(".estimativa")).toHaveText("Vale cerca de 45 pontos por kg.");
    await expect(aceito.getByRole("link", { name: "Ver ecopontos" })).toBeVisible();

    await page.getByRole("button", { name: "Analisar outro item" }).click();
    inicio = Date.now();
    await page.setInputFiles("#foto-camera", `${FOTOS}/casca-banana.jpg`);
    const naoAceito = page.locator('[data-resultado="nao_aceito"]');
    await expect(naoAceito).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - inicio).toBeLessThan(5_000);
    await expect(naoAceito).toContainText("Resto de comida vai no lixo comum ou na compostagem.");
  });

  test("foto grande do celular é reduzida no aparelho (≤ 1280 px, JPEG) antes de enviar", async ({ page }) => {
    await page.goto("/reciclar/");
    // Uma "foto" de 4000×3000 gerada no próprio navegador.
    const grande = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 4000;
      c.height = 3000;
      const ctx = c.getContext("2d")!;
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsl(${i * 7} 70% 50%)`;
        ctx.fillRect(Math.random() * 4000, Math.random() * 3000, 300, 300);
      }
      const b = await new Promise<Blob>((ok) => c.toBlob((x) => ok(x!), "image/png"));
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    });
    let enviado: Buffer | null = null;
    await page.route("**/api/cidadao/reciclar/analisar", async (route) => {
      enviado = route.request().postDataBuffer();
      await route.continue();
    });
    await page.setInputFiles("#foto-galeria", { name: "foto.png", mimeType: "image/png", buffer: Buffer.from(grande) });
    await expect(page.locator("[data-resultado]")).toBeVisible();
    expect(enviado).not.toBeNull();
    const b = enviado as unknown as Buffer;
    expect(b[0]).toBe(0xff); // JPEG
    expect(b[1]).toBe(0xd8);
    expect(b.length).toBeLessThan(Buffer.from(grande).length);
    const dims = await page.evaluate(async (bytes) => {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }));
      return [bmp.width, bmp.height];
    }, Array.from(b));
    expect(dims).toEqual([1280, 960]);
  });

  test("passou de 5 s: cancela e mostra a busca do guia (critério 2)", async ({ page }) => {
    await page.goto("/reciclar/");
    let cancelado = false;
    await page.route("**/api/cidadao/reciclar/analisar", async (route) => {
      await new Promise((r) => setTimeout(r, 8_000));
      await route.continue().catch(() => (cancelado = true));
    });
    const inicio = Date.now();
    await page.setInputFiles("#foto-galeria", `${FOTOS}/lata.jpg`);
    await expect(page.getByText("Não conseguimos analisar a foto agora.")).toBeVisible({ timeout: 6_500 });
    const passou = Date.now() - inicio;
    expect(passou).toBeGreaterThanOrEqual(4_900);
    expect(passou).toBeLessThan(6_500);
    await expect(page.getByLabel("Buscar no guia")).toBeVisible();
    await page.getByLabel("Buscar no guia").fill("lata");
    await page.getByLabel("Buscar no guia").press("Enter");
    await expect(page).toHaveURL(/\/reciclar\/guia\?q=lata$/);
    await expect(page.locator('.lista-itens [data-item="lata-aluminio"]')).toBeVisible();
    void cancelado;
  });
});

test.describe("Guia", () => {
  test("funciona offline a partir do cache (critério 9)", async ({ page, context }) => {
    await page.goto("/reciclar/guia");
    await expect(page.locator(".categoria")).toHaveCount(6);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Garante que o service worker controla a página (o guia passa por ele).
    await page.reload();
    await expect(page.locator(".categoria")).toHaveCount(6);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".faixa-offline")).toContainText(/Sem internet\. Guia de \d{2}\/\d{2}\/\d{4}\./);
    await expect(page.locator(".categoria")).toHaveCount(6);
    await page.getByLabel("Buscar no guia").fill("garrafa pet");
    await expect(page.locator(".lista-itens li").first()).toHaveAttribute("data-item", "garrafa-pet");

    // As outras abas pedem internet.
    await page.getByRole("tab", { name: "Posso levar?" }).click();
    await expect(page.getByText("Conecte-se à internet para usar.")).toBeVisible();
    await page.getByRole("tab", { name: "Jogo" }).click();
    await expect(page.getByText("Conecte-se à internet para usar.")).toBeVisible();
    await context.setOffline(false);
  });
});

async function itemAtual(page: Page) {
  return (await page.locator(".jogo__mesa .item-jogo__nome").textContent())!.trim();
}

test.describe("Jogo da Separação", () => {
  test("arrastar, tocar e teclado; XP só na primeira partida do dia (critérios 6 e 7)", async ({ page }) => {
    await page.goto("/reciclar/jogo");
    await page.getByRole("button", { name: "Começar partida" }).click();

    // 1) Arrastar com o dedo/mouse.
    let nome = await itemAtual(page);
    const item = page.locator(".jogo__mesa .item-jogo");
    const alvo = page.locator(`.lixeira[data-lixeira="${lixeiraDe(nome)}"]`);
    const a = (await item.boundingBox())!;
    const b = (await alvo.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await expect(alvo).toHaveClass(/lixeira--alvo/);
    await page.mouse.up();
    await expect(page.locator('[data-jogada="acerto"]')).toContainText(`Acertou! ${nome} vai na lixeira`);
    await expect(page.locator(".jogo__progresso")).toHaveText("Item 2 de 10");

    // 2) Tocar no item e depois na lixeira.
    nome = await itemAtual(page);
    await item.tap();
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await page.locator(`.lixeira[data-lixeira="${lixeiraDe(nome)}"]`).tap();
    await expect(page.locator(".jogo__progresso")).toHaveText("Item 3 de 10");

    // 3) Só teclado: Enter no item, Tab até as lixeiras, setas, Enter.
    nome = await itemAtual(page);
    await item.focus();
    await page.keyboard.press("Enter");
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab"); // primeira lixeira (papel)
    const ordem = ["papel", "plastico", "vidro", "metal", "organico", "nao_reciclavel"];
    for (let i = 0; i < ordem.indexOf(lixeiraDe(nome)); i++) await page.keyboard.press("ArrowRight");
    await expect(page.locator(".lixeira:focus")).toHaveAttribute("data-lixeira", lixeiraDe(nome));
    await page.keyboard.press("Enter");
    await expect(page.locator(".jogo__progresso")).toHaveText("Item 4 de 10");

    // O resto por toque, errando um.
    for (let n = 3; n < 10; n++) {
      nome = await itemAtual(page);
      const certa = lixeiraDe(nome);
      await page.locator(`.lixeira[data-lixeira="${n === 3 ? ordem.find((l) => l !== certa) : certa}"]`).tap();
    }
    await expect(page.locator("[data-placar]")).toHaveText("Você acertou 9 de 10.");
    await expect(page.locator("[data-xp]")).toHaveText("Você ganhou 19 XP.");

    await page.getByRole("button", { name: "Jogar de novo" }).click();
    for (let n = 0; n < 10; n++) await page.locator(`.lixeira[data-lixeira="${lixeiraDe(await itemAtual(page))}"]`).tap();
    await expect(page.locator('[data-xp="0"]')).toHaveText("Partida extra: hoje você já ganhou XP, mas o treino vale.");
  });

  test("com 'reduzir movimento', nenhuma animação roda (critério 8)", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/reciclar/jogo");
    await page.getByRole("button", { name: "Começar partida" }).click();
    for (let n = 0; n < 10; n++) {
      await page.locator(`.lixeira[data-lixeira="${lixeiraDe(await itemAtual(page))}"]`).tap();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    }
    await expect(page.locator("[data-placar]")).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator(".celebracao")).toHaveCount(0);
    await ctx.close();
  });

  test("sem 'reduzir movimento', a comemoração anima", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 393, height: 851 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/reciclar/jogo");
    await page.getByRole("button", { name: "Começar partida" }).click();
    for (let n = 0; n < 10; n++) await page.locator(`.lixeira[data-lixeira="${lixeiraDe(await itemAtual(page))}"]`).tap();
    await expect(page.locator(".celebracao")).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await ctx.close();
  });
});

test("360 px: sem rolagem horizontal nas três abas, nos dois temas", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme });
    const page = await ctx.newPage();
    for (const url of ["/reciclar/", "/reciclar/guia?q=garrafa", "/reciclar/jogo"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      if (url.endsWith("jogo")) await page.getByRole("button", { name: "Começar partida" }).click();
      const [scroll, largura] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scroll, `${url} ${colorScheme}`).toBeLessThanOrEqual(largura);
    }
    // Abas inteiras, sem reticências.
    await page.goto("/reciclar/");
    const cortada = await page.locator(".aba span").evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth));
    expect(cortada).toBe(false);
    await ctx.close();
  }
});

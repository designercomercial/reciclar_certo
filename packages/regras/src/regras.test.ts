import { describe, expect, it } from "vitest";
import type { Guia } from "@ecoponto/contracts";
import {
  buscarNoGuia,
  calcularXp,
  CONTEUDO_ATUALIZADO_EM,
  CONTEUDO_GUIA,
  corrigirPartida,
  ITENS_JOGO,
  mapearResultado,
  montarGuia,
  normalizar,
  sortearItens,
} from "./index.ts";

/** Tabela v3 (a mesma de Meus Pontos). */
const GUIA: Guia = montarGuia(
  CONTEUDO_GUIA,
  {
    versao: { versao: "v3", vigenteDesde: "2026-10-01" },
    valores: {
      plastico: { pontos: 22, unidade: "kg" },
      papel: { pontos: 11, unidade: "kg" },
      metal: { pontos: 45, unidade: "kg" },
      vidro: { pontos: 6, unidade: "kg" },
      oleo: { pontos: 25, unidade: "litro" },
    },
  },
  CONTEUDO_ATUALIZADO_EM,
);

const primeiro = (termo: string) => buscarNoGuia(GUIA, termo)[0]?.item.id;

describe("conteúdo do guia", () => {
  it("tem as 6 categorias, cada material com 5+ aceitos e 3+ não aceitos", () => {
    expect(GUIA.categorias.map((c) => c.id)).toEqual(["plastico", "papel", "metal", "vidro", "oleo", "nao_aceitos"]);
    for (const c of GUIA.categorias) {
      if (c.id !== "nao_aceitos") expect(c.aceitos.length, c.id).toBeGreaterThanOrEqual(5);
      expect(c.naoAceitos.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("não repete id de item", () => {
    const ids = GUIA.categorias.flatMap((c) => [...c.aceitos, ...c.naoAceitos].map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("os valores vêm da tabela, e material sem valor sai do guia", () => {
    expect(GUIA.categorias.find((c) => c.id === "metal")?.valor).toEqual({ pontos: 45, unidade: "kg" });
    expect(GUIA.categorias.find((c) => c.id === "oleo")?.valor).toEqual({ pontos: 25, unidade: "litro" });
    const semVidro = montarGuia(CONTEUDO_GUIA, { versao: GUIA.tabela, valores: { metal: { pontos: 45, unidade: "kg" } } }, CONTEUDO_ATUALIZADO_EM);
    expect(semVidro.categorias.map((c) => c.id)).toEqual(["metal", "nao_aceitos"]);
  });
});

describe("busca do guia", () => {
  it("normaliza acento, maiúscula e pontuação", () => {
    expect(normalizar("Óleo de Cozinha!")).toBe("oleo de cozinha");
  });

  it("encontra sem acento", () => {
    expect(primeiro("oleo de cozinha")).toBe("oleo-soja");
    expect(primeiro("aluminio")).toBe("lata-aluminio");
    expect(primeiro("lampada")).toBe("lampada");
    expect(primeiro("PAPELAO")).toBe("caixa-papelao");
  });

  it("encontra com variações e sinônimos", () => {
    expect(primeiro("pet")).toBe("garrafa-pet");
    expect(primeiro("garrafa pet")).toBe("garrafa-pet");
    expect(primeiro("Garrafa PET")).toBe("garrafa-pet");
    expect(primeiro("caixa de leite")).toBe("caixa-leite");
    expect(primeiro("longa vida")).toBe("caixa-leite");
    expect(primeiro("latas")).toBe("lata-aluminio");
    expect(primeiro("shampoo")).toBe("frasco-higiene");
  });

  it("diz quando o item não é aceito", () => {
    const [r] = buscarNoGuia(GUIA, "casca de banana");
    expect(r?.tipo).toBe("nao_aceito");
    expect(r?.item.id).toBe("casca-banana");
  });

  it("busca pelo nome da categoria lista os itens dela", () => {
    const ids = buscarNoGuia(GUIA, "vidro").map((r) => r.categoria.id);
    expect(ids).toContain("vidro");
    expect(buscarNoGuia(GUIA, "metal").filter((r) => r.tipo === "aceito").length).toBeGreaterThanOrEqual(5);
  });

  it("termo vazio ou sem relação não traz nada", () => {
    expect(buscarNoGuia(GUIA, "  ")).toEqual([]);
    expect(buscarNoGuia(GUIA, "xyzw")).toEqual([]);
  });
});

describe("mapeamento do resultado da IA (T21)", () => {
  it("casca de banana → não aceito, com onde descartar", () => {
    const r = mapearResultado([{ rotulo: "casca-banana", confianca: 0.96 }], GUIA);
    expect(r.resultado).toBe("nao_aceito");
    if (r.resultado !== "nao_aceito") return;
    expect(r.ondeDescartar).toBe("Resto de comida vai no lixo comum ou na compostagem.");
  });

  it("lata (texto livre da IA) → aceito, metal, com estimativa da tabela", () => {
    const r = mapearResultado([{ rotulo: "Lata de alumínio", confianca: 0.94 }], GUIA);
    expect(r).toMatchObject({
      resultado: "aceito",
      item: { id: "lata-aluminio", nome: "Lata de alumínio" },
      material: "metal",
      materialNome: "Metal",
      estimativa: { pontos: 45, unidade: "kg" },
      tabela: { versao: "v3" },
    });
    if (r.resultado === "aceito") expect(r.preparo[0]).toBe("Lave e amasse.");
  });

  it("confiança abaixo do limiar → incerto, com as 2 sugestões mais prováveis", () => {
    const r = mapearResultado(
      [
        { rotulo: "jornal", confianca: 0.3 },
        { rotulo: "caixa-leite", confianca: 0.45 },
        { rotulo: "caixa-papelao", confianca: 0.2 },
      ],
      GUIA,
    );
    expect(r).toEqual({
      resultado: "incerto",
      confianca: 0.45,
      sugestoes: [
        { id: "caixa-leite", nome: "Caixa de leite", categoria: "papel" },
        { id: "jornal-revista", nome: "Jornal e revista", categoria: "papel" },
      ],
    });
  });

  it("o limiar é configurável", () => {
    const rotulos = [{ rotulo: "garrafa-pet", confianca: 0.75 }];
    expect(mapearResultado(rotulos, GUIA, 0.7).resultado).toBe("aceito");
    expect(mapearResultado(rotulos, GUIA, 0.8).resultado).toBe("incerto");
  });

  it("rótulo fora do guia → incerto, mesmo com confiança alta", () => {
    const r = mapearResultado([{ rotulo: "girafa", confianca: 0.99 }], GUIA);
    expect(r).toEqual({ resultado: "incerto", confianca: 0.99, sugestoes: [] });
  });

  it("nada reconhecido → incerto com confiança 0", () => {
    expect(mapearResultado([], GUIA)).toEqual({ resultado: "incerto", confianca: 0, sugestoes: [] });
  });

  it("item não aceito dentro de uma categoria de material → não aceito", () => {
    expect(mapearResultado([{ rotulo: "pilha", confianca: 0.9 }], GUIA).resultado).toBe("nao_aceito");
  });
});

describe("jogo da separação", () => {
  it("sorteia 10 itens diferentes, passando pelas 6 lixeiras", () => {
    for (let s = 0; s < 20; s++) {
      let x = s + 1;
      const itens = sortearItens(10, () => ((x = (x * 9301 + 49297) % 233280) / 233280));
      expect(itens).toHaveLength(10);
      expect(new Set(itens.map((i) => i.id)).size).toBe(10);
      expect(new Set(itens.map((i) => i.lixeira)).size).toBe(6);
    }
  });

  it("corrige pelo gabarito", () => {
    const itens = ITENS_JOGO.slice(0, 10);
    const respostas = itens.map((i, n) => ({ itemId: i.id, lixeira: n < 7 ? i.lixeira : ("organico" as const) }));
    const c = corrigirPartida(respostas);
    // Os 3 últimos (índices 7 a 9) são plástico: viraram erro.
    expect(c).toEqual({ ok: true, acertos: 7, total: 10 });
  });

  it("recusa partida malformada", () => {
    const um = { itemId: "jornal", lixeira: "papel" as const };
    expect(corrigirPartida(Array.from({ length: 10 }, () => um))).toEqual({ ok: false });
    expect(corrigirPartida([um])).toEqual({ ok: false });
    const invalido = ITENS_JOGO.slice(0, 9).map((i) => ({ itemId: i.id, lixeira: i.lixeira }));
    expect(corrigirPartida([...invalido, { itemId: "nao-existe", lixeira: "papel" }])).toEqual({ ok: false });
  });

  it("XP: 10 por jogar + 1 por acerto, até 20", () => {
    expect(calcularXp(0)).toBe(10);
    expect(calcularXp(7)).toBe(17);
    expect(calcularXp(10)).toBe(20);
    expect(calcularXp(10, { base: 10, porAcerto: 2, maximo: 25 })).toBe(25);
  });
});

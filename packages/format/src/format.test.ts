import { describe, expect, it } from "vitest";
import {
  diaEmBoaVista,
  explicacaoLixeira,
  formatData,
  formatDataSimples,
  formatDiaHora,
  formatInteiro,
  formatPercentual,
  formatPontos,
  formatValor,
} from "./index.ts";

describe("números pt-BR", () => {
  it("agrupa milhares com ponto", () => {
    expect(formatInteiro(1250)).toBe("1.250");
    expect(formatInteiro(300)).toBe("300");
  });

  it("escreve pontos no singular e no plural", () => {
    expect(formatPontos(1250)).toBe("1.250 pontos");
    expect(formatPontos(1)).toBe("1 ponto");
  });

  it("escreve o valor da tabela com a unidade", () => {
    expect(formatValor({ pontos: 45, unidade: "kg" })).toBe("45 pontos por kg");
    expect(formatValor({ pontos: 25, unidade: "litro" })).toBe("25 pontos por litro");
    expect(formatPercentual(0.934)).toBe("93%");
  });
});

describe("datas em Boa Vista (UTC−4)", () => {
  it("usa o dia de Boa Vista, não o UTC", () => {
    // 02:30 UTC do dia 16 ainda é dia 15 em Boa Vista.
    expect(formatData("2026-12-16T02:30:00Z")).toBe("15/12/2026");
    expect(diaEmBoaVista(new Date("2026-12-16T02:30:00Z"))).toBe("2026-12-15");
    expect(diaEmBoaVista(new Date("2026-12-16T04:00:00Z"))).toBe("2026-12-16");
    expect(formatDiaHora("2026-11-11T18:32:00Z")).toBe("11/11 às 14:32");
    expect(formatDataSimples("2026-10-01")).toBe("01/10/2026");
  });
});

describe("lixeiras", () => {
  it("explica com a cor, como pede a especificação", () => {
    expect(explicacaoLixeira("Pote de vidro", "vidro")).toBe("Pote de vidro vai na lixeira verde.");
  });
});

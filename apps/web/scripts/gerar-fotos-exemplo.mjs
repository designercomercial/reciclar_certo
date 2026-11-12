/**
 * Gera as fotos de exemplo da IA mock (ilustrações, não fotos reais) e a
 * tabela de hashes que o mock usa para reconhecê-las.
 *
 *   apps/web/public/exemplos/{id}.jpg       usadas na demonstração e nos testes
 *   apps/api/src/ia/exemplos.gerado.ts      hash → resposta da IA mock
 *
 * Rodar: pnpm fotos-exemplo   (usa o Chromium do Playwright)
 *
 * São arquivos de conteúdo (imagem), não interface: as cores das ilustrações
 * não passam pelos tokens.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { removerMetadadosJpeg } from "../../api/src/ia/jpeg.ts";

const aqui = dirname(fileURLToPath(import.meta.url));
const pastaFotos = resolve(aqui, "../public/exemplos");
const arquivoMock = resolve(aqui, "../../api/src/ia/exemplos.gerado.ts");

const fundo = (cor) => `<rect width="800" height="600" fill="${cor}"/>`;
const mesa = `<rect y="430" width="800" height="170" fill="#C9A27A"/><rect y="430" width="800" height="8" fill="#B08A63"/>`;

/** id, legenda, resposta da IA mock, desenho. */
const EXEMPLOS = [
  {
    id: "casca-banana",
    legenda: "Casca de banana",
    rotulos: [{ rotulo: "casca-banana", confianca: 0.96 }, { rotulo: "resto-comida", confianca: 0.03 }],
    svg: `${fundo("#EAF2E3")}${mesa}
      <path d="M250 430 C 300 300, 420 240, 560 250 C 520 280, 430 330, 380 430 Z" fill="#F2D23A" stroke="#8A6D1A" stroke-width="6"/>
      <path d="M380 430 C 420 360, 470 330, 600 340 C 560 380, 500 410, 470 440 Z" fill="#E8C22E" stroke="#8A6D1A" stroke-width="6"/>
      <path d="M300 430 C 260 380, 220 360, 170 370 C 210 395, 240 420, 250 440 Z" fill="#E0B52A" stroke="#8A6D1A" stroke-width="6"/>
      <circle cx="560" cy="250" r="10" fill="#4A3A12"/>`,
  },
  {
    id: "lata",
    legenda: "Lata de alumínio",
    // A IA real devolve texto livre: o servidor liga ao item do guia pela busca.
    rotulos: [{ rotulo: "lata de alumínio", confianca: 0.94 }, { rotulo: "lata-aco", confianca: 0.04 }],
    svg: `${fundo("#E3ECF5")}${mesa}
      <ellipse cx="400" cy="140" rx="110" ry="26" fill="#C7CED6" stroke="#5B6670" stroke-width="5"/>
      <rect x="290" y="140" width="220" height="300" fill="#D7DDE3" stroke="#5B6670" stroke-width="5"/>
      <rect x="290" y="210" width="220" height="150" fill="#C62828"/>
      <path d="M320 285 q 40 -40 80 0 t 80 0" stroke="#FFFFFF" stroke-width="10" fill="none"/>
      <ellipse cx="400" cy="440" rx="110" ry="26" fill="#AEB7C0" stroke="#5B6670" stroke-width="5"/>
      <ellipse cx="400" cy="140" rx="30" ry="8" fill="#8D96A0"/>`,
  },
  {
    id: "garrafa-pet",
    legenda: "Garrafa PET",
    rotulos: [{ rotulo: "garrafa pet", confianca: 0.91 }, { rotulo: "embalagem-limpeza", confianca: 0.05 }],
    svg: `${fundo("#F4F1EA")}${mesa}
      <rect x="370" y="70" width="60" height="40" rx="6" fill="#1565C0"/>
      <path d="M375 110 L425 110 L440 170 C 500 200, 500 230, 500 260 L500 420 Q500 440 480 440 L320 440 Q300 440 300 420 L300 260 C 300 230, 300 200, 360 170 Z" fill="#BFE3F5" fill-opacity="0.85" stroke="#4A8DB5" stroke-width="5"/>
      <rect x="300" y="280" width="200" height="70" fill="#2E7D32"/>`,
  },
  {
    id: "pote-vidro",
    legenda: "Pote de vidro",
    rotulos: [{ rotulo: "pote-vidro", confianca: 0.88 }, { rotulo: "garrafa-vidro", confianca: 0.08 }],
    svg: `${fundo("#EFEAF4")}${mesa}
      <rect x="300" y="160" width="200" height="40" rx="8" fill="#9E9E9E" stroke="#616161" stroke-width="5"/>
      <rect x="285" y="200" width="230" height="240" rx="30" fill="#D9F0E3" fill-opacity="0.8" stroke="#5E8F72" stroke-width="5"/>
      <rect x="315" y="230" width="20" height="170" rx="10" fill="#FFFFFF" fill-opacity="0.7"/>`,
  },
  {
    id: "pilha",
    legenda: "Pilha",
    rotulos: [{ rotulo: "pilha", confianca: 0.9 }],
    svg: `${fundo("#F1EFE8")}${mesa}
      <g transform="rotate(-12 400 330)">
        <rect x="250" y="290" width="300" height="90" rx="16" fill="#212121"/>
        <rect x="250" y="290" width="110" height="90" rx="16" fill="#F2A900"/>
        <rect x="550" y="315" width="22" height="40" rx="5" fill="#9E9E9E"/>
      </g>`,
  },
  {
    id: "foto-borrada",
    legenda: "Foto borrada",
    // Confiança baixa: "Não temos certeza." com 2 sugestões.
    rotulos: [{ rotulo: "caixa-leite", confianca: 0.41 }, { rotulo: "jornal-revista", confianca: 0.33 }, { rotulo: "caixa-papelao", confianca: 0.12 }],
    svg: `<defs><filter id="b"><feGaussianBlur stdDeviation="28"/></filter></defs>${fundo("#DDD8CF")}
      <g filter="url(#b)"><rect x="260" y="150" width="260" height="300" fill="#FFFFFF"/><rect x="260" y="230" width="260" height="90" fill="#1E88E5"/><rect y="430" width="800" height="170" fill="#BFA07E"/></g>`,
  },
  {
    id: "foto-lenta",
    legenda: "Simular demora (mais de 5 s)",
    rotulos: [{ rotulo: "garrafa-pet", confianca: 0.9 }],
    atrasoMs: 8000,
    svg: `${fundo("#ECEFF1")}
      <path d="M320 120 h160 v40 c 0 70 -60 100 -60 140 c 0 40 60 70 60 140 v40 h-160 v-40 c 0 -70 60 -100 60 -140 c 0 -40 -60 -70 -60 -140 Z" fill="#FFF8E1" stroke="#5D4037" stroke-width="8"/>
      <path d="M350 440 h100 c -10 -40 -40 -55 -50 -70 c -10 15 -40 30 -50 70 Z" fill="#F2A900"/>`,
  },
  {
    id: "foto-erro",
    legenda: "Simular IA fora do ar",
    rotulos: [],
    falha: true,
    svg: `${fundo("#FBE9E7")}
      <path d="M330 220 h140 v80 a70 70 0 0 1 -140 0 Z" fill="#9E9E9E" stroke="#424242" stroke-width="8"/>
      <rect x="360" y="160" width="16" height="60" fill="#424242"/><rect x="424" y="160" width="16" height="60" fill="#424242"/>
      <path d="M400 370 v90" stroke="#424242" stroke-width="12"/>
      <path d="M250 150 L550 470" stroke="#C62828" stroke-width="18" stroke-linecap="round"/>`,
  },
];

mkdirSync(pastaFotos, { recursive: true });
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 800, height: 600 } });
const linhas = [];
for (const ex of EXEMPLOS) {
  await pagina.setContent(
    `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">${ex.svg}</svg></body></html>`,
  );
  const jpg = await pagina.screenshot({ type: "jpeg", quality: 70 });
  writeFileSync(resolve(pastaFotos, `${ex.id}.jpg`), jpg);
  // O servidor tira os metadados antes de chamar a IA; o hash é do que a IA recebe.
  const hash = createHash("sha256").update(removerMetadadosJpeg(jpg)).digest("hex");
  const extra = `${ex.atrasoMs ? `, atrasoMs: ${ex.atrasoMs}` : ""}${ex.falha ? ", falha: true" : ""}`;
  linhas.push(`  // ${ex.legenda}\n  "${hash}": { arquivo: "${ex.id}.jpg", rotulos: ${JSON.stringify(ex.rotulos)}${extra} },`);
  console.log(`${ex.id}.jpg  ${(jpg.length / 1024).toFixed(1)} KB`);
}
await navegador.close();

writeFileSync(
  arquivoMock,
  `/**
 * GERADO por apps/web/scripts/gerar-fotos-exemplo.mjs. Não edite à mão.
 * Hash (SHA-256 da imagem sem metadados) → resposta da IA mock.
 */
import type { Rotulo } from "@ecoponto/regras";

export type ExemploMock = { arquivo: string; rotulos: Rotulo[]; atrasoMs?: number; falha?: boolean };

export const EXEMPLOS_MOCK: Readonly<Record<string, ExemploMock>> = {
${linhas.join("\n")}
};
`,
);

writeFileSync(
  resolve(aqui, "../src/exemplos.gerado.ts"),
  `/** GERADO por scripts/gerar-fotos-exemplo.mjs. Fotos de exemplo da demonstração (IA mock). */
export const FOTOS_EXEMPLO: ReadonlyArray<{ id: string; legenda: string }> = ${JSON.stringify(
    EXEMPLOS.map(({ id, legenda }) => ({ id, legenda })),
    null,
    2,
  )};
`,
);
console.log("Tabela da IA mock atualizada.");

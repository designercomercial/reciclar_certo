/**
 * GERADO por apps/web/scripts/gerar-fotos-exemplo.mjs. Não edite à mão.
 * Hash (SHA-256 da imagem sem metadados) → resposta da IA mock.
 */
import type { Rotulo } from "@ecoponto/regras";

export type ExemploMock = { arquivo: string; rotulos: Rotulo[]; atrasoMs?: number; falha?: boolean };

export const EXEMPLOS_MOCK: Readonly<Record<string, ExemploMock>> = {
  // Casca de banana
  "2afb19614256f18356fa3b56cdfaf744862c18f5a18af8f6f28fea20823df174": { arquivo: "casca-banana.jpg", rotulos: [{"rotulo":"casca-banana","confianca":0.96},{"rotulo":"resto-comida","confianca":0.03}] },
  // Lata de alumínio
  "b6ea09a63e5fe063675aaf4fc3b66663c52c0af81ffc9c75d2d75ecb456ab528": { arquivo: "lata.jpg", rotulos: [{"rotulo":"lata de alumínio","confianca":0.94},{"rotulo":"lata-aco","confianca":0.04}] },
  // Garrafa PET
  "b3f9a1ff739c2dfbae56f55fd507e1f1c12e0367fd2df21939ce47ece6f4d6fc": { arquivo: "garrafa-pet.jpg", rotulos: [{"rotulo":"garrafa pet","confianca":0.91},{"rotulo":"embalagem-limpeza","confianca":0.05}] },
  // Pote de vidro
  "3e5eccb62ab64cac3aebe9af6274c3da1c789bd2de1b78dc2c9fa708580bdee7": { arquivo: "pote-vidro.jpg", rotulos: [{"rotulo":"pote-vidro","confianca":0.88},{"rotulo":"garrafa-vidro","confianca":0.08}] },
  // Pilha
  "9a52ad0527bb8e861675178567718ce327f89f0330c22165ad6dd8afc3d51c13": { arquivo: "pilha.jpg", rotulos: [{"rotulo":"pilha","confianca":0.9}] },
  // Foto borrada
  "d803c7257b5c65a4e884867d02eadafaf03c68e4dc78afca01d487b24f60e65b": { arquivo: "foto-borrada.jpg", rotulos: [{"rotulo":"caixa-leite","confianca":0.41},{"rotulo":"jornal-revista","confianca":0.33},{"rotulo":"caixa-papelao","confianca":0.12}] },
  // Simular demora (mais de 5 s)
  "bb649fe1ad1d03b6776223125c70dd18f82645ac550bc9b89d9c7861f42eba9a": { arquivo: "foto-lenta.jpg", rotulos: [{"rotulo":"garrafa-pet","confianca":0.9}], atrasoMs: 8000 },
  // Simular IA fora do ar
  "98e9ee950e7212ec2d156900c5d2bd5e4110ae11fe019ad50725906ffcc3d3fb": { arquivo: "foto-erro.jpg", rotulos: [], falha: true },
};

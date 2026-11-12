/**
 * Configuração da página (no build, por VITE_*).
 *
 * PENDENTE: o endereço real (deep link) do canal Ecopontos no app SASI.
 */
export type Links = {
  /** Canal "Ecopontos" (mapa fora do escopo). */
  ecopontos: string;
};

const env = import.meta.env;

export const LINKS: Links = {
  ecopontos: env.VITE_LINK_ECOPONTOS ?? "/ecopontos/",
};

/**
 * Fotos de exemplo para testar a IA mock sem câmera. Ligadas no `pnpm dev` e
 * na demonstração (VITE_FOTOS_EXEMPLO=1). Desligue em produção.
 */
export const FOTOS_EXEMPLO_ATIVAS: boolean = env.DEV || env.VITE_FOTOS_EXEMPLO === "1";

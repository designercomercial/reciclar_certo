/**
 * Reduz a foto no aparelho antes de enviar (resposta rápida no 4G):
 * lado maior de até 1280 px, JPEG com qualidade 0,7.
 *
 * Redesenhar no canvas também descarta o EXIF (localização, modelo do
 * aparelho). O servidor tira os metadados de novo, por garantia.
 */
export const LADO_MAXIMO = 1280;
export const QUALIDADE = 0.7;
/** Foto que já é JPEG, pequena e no tamanho certo vai como está. */
export const TAMANHO_SEM_REDUZIR = 400 * 1024;

export class FotoIlegivel extends Error {}

/** Medidas finais mantendo a proporção. */
export function dimensoesAlvo(largura: number, altura: number, max = LADO_MAXIMO): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const f = max / maior;
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}

type Fonte = { largura: number; altura: number; desenhar: (ctx: CanvasRenderingContext2D, l: number, a: number) => void; soltar: () => void };

async function decodificar(foto: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image": respeita a rotação do EXIF (foto em pé continua em pé).
      const bmp = await createImageBitmap(foto, { imageOrientation: "from-image" });
      return { largura: bmp.width, altura: bmp.height, desenhar: (ctx, l, a) => ctx.drawImage(bmp, 0, 0, l, a), soltar: () => bmp.close() };
    } catch {
      /* tenta pelo <img> */
    }
  }
  const url = URL.createObjectURL(foto);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { largura: img.naturalWidth, altura: img.naturalHeight, desenhar: (ctx, l, a) => ctx.drawImage(img, 0, 0, l, a), soltar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new FotoIlegivel("não foi possível abrir a foto");
  }
}

export async function prepararFoto(foto: Blob): Promise<Blob> {
  const fonte = await decodificar(foto);
  try {
    const alvo = dimensoesAlvo(fonte.largura, fonte.altura);
    if (foto.type === "image/jpeg" && foto.size <= TAMANHO_SEM_REDUZIR && alvo.largura === fonte.largura && alvo.altura === fonte.altura) {
      return foto;
    }
    const canvas = document.createElement("canvas");
    canvas.width = alvo.largura;
    canvas.height = alvo.altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FotoIlegivel("sem canvas");
    fonte.desenhar(ctx, alvo.largura, alvo.altura);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob) throw new FotoIlegivel("falha ao gerar JPEG");
    return blob;
  } finally {
    fonte.soltar();
  }
}

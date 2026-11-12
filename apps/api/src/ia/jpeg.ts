/**
 * JPEG: validação e remoção de metadados antes de mandar para a IA.
 *
 * Uma foto de celular pode trazer EXIF com localização (GPS), modelo do
 * aparelho e data. Nada disso vai para a IA: removemos APP1 (EXIF/XMP),
 * APP13 (IPTC) e comentários. Ficam só os segmentos que desenham a imagem.
 */

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
/** APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), COM (comentário). */
const REMOVER = new Set([0xe1, 0xed, 0xfe]);

export function ehJpeg(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0xff && b[1] === SOI && b[2] === 0xff;
}

/** Cópia do JPEG sem metadados. Lança erro se a estrutura for inválida. */
export function removerMetadadosJpeg(b: Uint8Array): Uint8Array {
  if (!ehJpeg(b)) throw new Error("não é JPEG");
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error("segmento inválido");
    const marcador = b[i + 1];
    if (marcador === undefined) throw new Error("fim inesperado");
    if (marcador === 0xff) {
      i++; // preenchimento
      continue;
    }
    if (marcador === EOI) {
      partes.push(b.subarray(i, i + 2));
      break;
    }
    if (marcador === SOS) {
      // Daqui para frente são os dados da imagem (até o EOI).
      partes.push(b.subarray(i));
      break;
    }
    const tam = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    if (tam < 2 || i + 2 + tam > b.length) throw new Error("tamanho de segmento inválido");
    if (!REMOVER.has(marcador)) partes.push(b.subarray(i, i + 2 + tam));
    i += 2 + tam;
  }
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

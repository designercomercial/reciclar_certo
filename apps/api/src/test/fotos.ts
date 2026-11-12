/** Fotos de exemplo (as mesmas da demonstração) e JPEGs montados à mão. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = resolve(dirname(fileURLToPath(import.meta.url)), "../../../web/public/exemplos");

export type Exemplo = "casca-banana" | "lata" | "garrafa-pet" | "pote-vidro" | "pilha" | "foto-borrada" | "foto-lenta" | "foto-erro";

export function foto(nome: Exemplo): Buffer {
  return readFileSync(resolve(pasta, `${nome}.jpg`));
}

/** Insere um segmento APP1 (EXIF) com "localização" logo depois do SOI. */
export function comExif(jpg: Buffer, texto = "Exif\0\0GPS 2.8235N 60.6758W Moto G"): Buffer {
  const dados = Buffer.from(texto, "latin1");
  const seg = Buffer.alloc(4 + dados.length);
  seg[0] = 0xff;
  seg[1] = 0xe1;
  seg.writeUInt16BE(dados.length + 2, 2);
  dados.copy(seg, 4);
  return Buffer.concat([jpg.subarray(0, 2), seg, jpg.subarray(2)]);
}

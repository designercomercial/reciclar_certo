/**
 * Ponto de integração com o motor de XP (T42), que ainda não existe.
 *
 * Fora do escopo: missões, conquistas, níveis. Aqui só o evento.
 * Quando o T42 existir, implemente `XpPort` chamando o motor e ligue em
 * `server.ts`. O motor deve tratar `chave` como idempotência: o mesmo evento
 * pode chegar de novo se o cidadão reenviar a partida.
 */

export type EventoXp = {
  usuarioId: string;
  origem: "jogo_separacao";
  xp: number;
  /** Idempotência: "jogo:{idDaPartida}". */
  chave: string;
  em: string;
};

export interface XpPort {
  registrarEventoXp(evento: EventoXp): Promise<void>;
}

export type XpMock = XpPort & { readonly eventos: readonly EventoXp[] };

/** Guarda os eventos em memória (um por chave) e escreve no log. */
export function xpMock(log: (dados: Record<string, unknown>) => void = () => {}): XpMock {
  const porChave = new Map<string, EventoXp>();
  return {
    get eventos() {
      return [...porChave.values()];
    },
    async registrarEventoXp(e) {
      if (porChave.has(e.chave)) return;
      porChave.set(e.chave, e);
      // Sem usuário no log.
      log({ evento: "xp", origem: e.origem, xp: e.xp });
    },
  };
}

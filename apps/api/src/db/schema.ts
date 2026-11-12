/**
 * Tabelas de "Reciclar Certo".
 *
 * Nenhuma tabela guarda imagem: não existe coluna bytea nem caminho de arquivo.
 * O teste de privacidade confere isso (critério 3).
 */
export const SCHEMA = /* sql */ `
-- Tabela de valores (T29), versão mínima: só o que o guia e a estimativa leem.
-- Uma versão vale a partir de vigente_desde (dia em Boa Vista) até a próxima.
CREATE TABLE IF NOT EXISTS tabela_valores (
  versao        text    NOT NULL,
  vigente_desde date    NOT NULL,
  material      text    NOT NULL CHECK (material IN ('plastico', 'papel', 'metal', 'vidro', 'oleo')),
  pontos        integer NOT NULL CHECK (pontos >= 0),
  unidade       text    NOT NULL CHECK (unidade IN ('kg', 'litro')),
  PRIMARY KEY (versao, material)
);
CREATE INDEX IF NOT EXISTS tabela_valores_vigencia ON tabela_valores (vigente_desde DESC);

-- Uso do "Posso levar?" por dia (só a contagem, para o limite de custo da IA).
CREATE TABLE IF NOT EXISTS reciclar_uso (
  usuario_id text    NOT NULL,
  dia        date    NOT NULL,
  total      integer NOT NULL CHECK (total >= 0),
  PRIMARY KEY (usuario_id, dia)
);

-- Partidas do Jogo da Separação. O id vem do aparelho (idempotência).
CREATE TABLE IF NOT EXISTS jogo_partidas (
  id         text        PRIMARY KEY,
  usuario_id text        NOT NULL,
  dia        date        NOT NULL,
  acertos    integer     NOT NULL CHECK (acertos >= 0),
  total      integer     NOT NULL CHECK (total > 0),
  xp         integer     NOT NULL DEFAULT 0 CHECK (xp >= 0),
  criada_em  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS jogo_partidas_usuario_dia ON jogo_partidas (usuario_id, dia);

-- XP diário: no máximo UMA linha por cidadão por dia em Boa Vista.
-- A chave primária é o que garante "XP só na primeira partida do dia",
-- mesmo com duas partidas enviadas ao mesmo tempo.
CREATE TABLE IF NOT EXISTS jogo_xp_diario (
  usuario_id text NOT NULL,
  dia        date NOT NULL,
  partida_id text NOT NULL REFERENCES jogo_partidas (id),
  PRIMARY KEY (usuario_id, dia)
);
`;

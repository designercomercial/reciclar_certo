/**
 * Contratos da página "Reciclar Certo".
 *
 * Compartilhados entre a API (valida o que sai) e a web (valida o que chega).
 * Valores (pontos por kg ou litro), resultado da análise e XP são sempre
 * calculados no servidor. A página só exibe.
 *
 * Usa zod/mini, como Meus Pontos e Prêmios: mesma validação, bundle menor.
 */
import * as z from "zod/mini";

/** Qualquer esquema que valide e devolva T. */
export type Esquema<T> = {
  safeParse(dados: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }> } };
};

// ---------------------------------------------------------------------------
// Básicos
// ---------------------------------------------------------------------------

/** Data e hora com fuso (ISO 8601). */
export const DataHora = z.iso.datetime({ offset: true });
/** Data sem hora (AAAA-MM-DD), no fuso de Boa Vista. */
export const Data = z.iso.date();

const Inteiro = z.int().check(z.nonnegative());
const Texto = z.string().check(z.minLength(1));
const Id = z.string().check(z.regex(/^[a-z0-9-]{1,48}$/));
/** 0 a 1. */
export const Confianca = z.number().check(z.gte(0), z.lte(1));

/** Materiais da tabela de valores (T29). Os mesmos de Meus Pontos. */
export const MATERIAIS = ["plastico", "papel", "metal", "vidro", "oleo"] as const;
export const Material = z.enum(MATERIAIS);
export type Material = z.infer<typeof Material>;

export const Unidade = z.enum(["kg", "litro"]);
export type Unidade = z.infer<typeof Unidade>;

/**
 * [CONFIRMAR com a tabela de valores vigente] Categorias do guia: os cinco
 * materiais da tabela e "Não aceitos".
 */
export const CATEGORIAS_GUIA = [...MATERIAIS, "nao_aceitos"] as const;
export const CategoriaGuia = z.enum(CATEGORIAS_GUIA);
export type CategoriaGuia = z.infer<typeof CategoriaGuia>;

export const VersaoTabela = z.object({ versao: Texto, vigenteDesde: Data });
export type VersaoTabela = z.infer<typeof VersaoTabela>;

/** Pontos por kg (ou por litro, no óleo) da versão vigente. */
export const ValorVigente = z.object({ pontos: Inteiro, unidade: Unidade });
export type ValorVigente = z.infer<typeof ValorVigente>;

// ---------------------------------------------------------------------------
// GET /api/publico/guia-materiais
// ---------------------------------------------------------------------------

export const ItemAceito = z.object({
  id: Id,
  nome: Texto,
  /** Outros nomes que a busca entende ("pet", "longa vida"). */
  sinonimos: z.array(Texto),
  /** Dica específica do item, além do preparo da categoria. */
  dica: z.nullable(Texto),
});
export type ItemAceito = z.infer<typeof ItemAceito>;

export const ItemNaoAceito = z.object({
  id: Id,
  nome: Texto,
  sinonimos: z.array(Texto),
  motivo: Texto,
  ondeDescartar: Texto,
});
export type ItemNaoAceito = z.infer<typeof ItemNaoAceito>;

export const CategoriaDoGuia = z.object({
  id: CategoriaGuia,
  nome: Texto,
  /** Material da tabela de valores; null em "Não aceitos". */
  material: z.nullable(Material),
  aceitos: z.array(ItemAceito),
  naoAceitos: z.array(ItemNaoAceito),
  preparo: z.array(Texto),
  /** Da tabela vigente; null em "Não aceitos". */
  valor: z.nullable(ValorVigente),
});
export type CategoriaDoGuia = z.infer<typeof CategoriaDoGuia>;

export const Guia = z.object({
  tabela: VersaoTabela,
  /** Data da versão do conteúdo do guia. */
  atualizadoEm: DataHora,
  categorias: z.array(CategoriaDoGuia).check(z.minLength(1)),
});
export type Guia = z.infer<typeof Guia>;

// ---------------------------------------------------------------------------
// POST /api/cidadao/reciclar/analisar   (corpo: image/jpeg)
// ---------------------------------------------------------------------------

export const ItemIdentificado = z.object({ id: Id, nome: Texto });

export const AnaliseAceito = z.object({
  resultado: z.literal("aceito"),
  confianca: Confianca,
  item: ItemIdentificado,
  material: Material,
  /** "Metal" */
  materialNome: Texto,
  preparo: z.array(Texto).check(z.minLength(1)),
  estimativa: ValorVigente,
  tabela: VersaoTabela,
});

export const AnaliseNaoAceito = z.object({
  resultado: z.literal("nao_aceito"),
  confianca: Confianca,
  item: ItemIdentificado,
  motivo: Texto,
  ondeDescartar: Texto,
});

export const Sugestao = z.object({ id: Id, nome: Texto, categoria: CategoriaGuia });
export type Sugestao = z.infer<typeof Sugestao>;

export const AnaliseIncerto = z.object({
  resultado: z.literal("incerto"),
  confianca: Confianca,
  /** As duas mais prováveis (pode vir vazio se a IA não reconheceu nada do guia). */
  sugestoes: z.array(Sugestao).check(z.maxLength(2)),
});

export const Analise = z.discriminatedUnion("resultado", [AnaliseAceito, AnaliseNaoAceito, AnaliseIncerto]);
export type Analise = z.infer<typeof Analise>;
export type ResultadoAnalise = Analise["resultado"];

// ---------------------------------------------------------------------------
// Jogo da Separação (T45)
// ---------------------------------------------------------------------------

/** Lixeiras no padrão nacional da coleta seletiva. */
export const LIXEIRAS = ["papel", "plastico", "vidro", "metal", "organico", "nao_reciclavel"] as const;
export const Lixeira = z.enum(LIXEIRAS);
export type Lixeira = z.infer<typeof Lixeira>;

export const EstadoJogo = z.discriminatedUnion("ativo", [
  z.object({ ativo: z.literal(false) }),
  z.object({
    ativo: z.literal(true),
    /** false: a próxima partida é "extra" (já ganhou XP hoje). */
    xpDisponivelHoje: z.boolean(),
    xpMaximo: Inteiro,
    itensPorPartida: z.int().check(z.positive()),
  }),
]);
export type EstadoJogo = z.infer<typeof EstadoJogo>;

/** UUID gerado no aparelho: reenviar a mesma partida não duplica nada. */
export const IdPartida = z.string().check(z.regex(/^[A-Za-z0-9_-]{16,80}$/));

export const Resposta = z.object({ itemId: Id, lixeira: Lixeira });
export type Resposta = z.infer<typeof Resposta>;

export const PartidaPedido = z.object({
  id: IdPartida,
  respostas: z.array(Resposta),
});
export type PartidaPedido = z.infer<typeof PartidaPedido>;

export const PartidaResposta = z.object({
  acertos: Inteiro,
  total: Inteiro,
  /** 0 se já ganhou XP hoje (fuso de Boa Vista). */
  xpConcedido: Inteiro,
  extra: z.boolean(),
  /** true quando é o reenvio de uma partida já registrada. */
  repetida: z.boolean(),
});
export type PartidaResposta = z.infer<typeof PartidaResposta>;

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export const CodigoErro = z.enum([
  "nao_autenticado",
  "parametro_invalido",
  "imagem_invalida",
  "imagem_grande",
  "limite_diario",
  "tempo_esgotado",
  "ia_indisponivel",
  "jogo_desligado",
  "partida_invalida",
  "nao_encontrado",
  "interno",
]);
export type CodigoErro = z.infer<typeof CodigoErro>;

export const RespostaErro = z.object({
  erro: CodigoErro,
  /** Só em limite_diario. */
  limite: z.optional(Inteiro),
});
export type RespostaErro = z.infer<typeof RespostaErro>;

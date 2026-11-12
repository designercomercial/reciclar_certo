/**
 * Conteúdo do guia de materiais (versionado no repositório).
 *
 * [DEFINIR] Fonte do conteúdo: cadastro no Painel de Gestão ou arquivo.
 * Padrão adotado: este arquivo. Os PONTOS não ficam aqui: o servidor junta
 * cada categoria com a tabela de valores vigente (T29) a cada pedido.
 *
 * [REVISAR com a equipe do programa] Textos de exemplo, em linguagem simples.
 */
import type { CategoriaDoGuia } from "@ecoponto/contracts";

export type ConteudoCategoria = Omit<CategoriaDoGuia, "valor">;

/** Data desta versão do conteúdo. Mude ao editar o arquivo. */
export const CONTEUDO_ATUALIZADO_EM = "2026-11-10T09:00:00-04:00";

export const CONTEUDO_GUIA: readonly ConteudoCategoria[] = [
  {
    id: "plastico",
    nome: "Plástico",
    material: "plastico",
    preparo: ["Tire os restos de comida ou de produto.", "Lave com pouca água e deixe secar.", "Amasse as garrafas para ocupar menos espaço."],
    aceitos: [
      { id: "garrafa-pet", nome: "Garrafa PET", sinonimos: ["pet", "garrafa de refrigerante", "garrafa de água", "garrafa plástica"], dica: null },
      { id: "embalagem-limpeza", nome: "Embalagem de produto de limpeza", sinonimos: ["detergente", "amaciante", "água sanitária", "desinfetante", "frasco de limpeza"], dica: "Enxágue bem antes de levar." },
      { id: "pote-plastico", nome: "Pote de margarina ou sorvete", sinonimos: ["pote plástico", "pote de margarina", "pote de sorvete", "vasilha"], dica: null },
      { id: "sacola-plastica", nome: "Sacola plástica", sinonimos: ["sacolinha", "saco plástico", "sacola de supermercado"], dica: "Junte várias dentro de uma só." },
      { id: "frasco-higiene", nome: "Frasco de xampu ou condicionador", sinonimos: ["xampu", "shampoo", "condicionador", "frasco de sabonete líquido"], dica: null },
      { id: "tampa-plastica", nome: "Tampa plástica", sinonimos: ["tampinha", "tampinha de garrafa"], dica: null },
    ],
    naoAceitos: [
      { id: "isopor", nome: "Isopor", sinonimos: ["bandeja de isopor", "copo de isopor"], motivo: "O ecoponto ainda não tem destino para isopor.", ondeDescartar: "Lixo comum." },
      { id: "embalagem-metalizada", nome: "Embalagem de salgadinho ou biscoito", sinonimos: ["pacote de salgadinho", "embalagem metalizada", "pacote de biscoito"], motivo: "Mistura plástico e alumínio, e não dá para separar.", ondeDescartar: "Lixo comum." },
      { id: "cano-pvc", nome: "Cano de PVC", sinonimos: ["cano", "tubo de pvc", "conexão de pvc"], motivo: "É material de obra, não de coleta seletiva.", ondeDescartar: "Junte com o entulho da obra." },
      { id: "brinquedo-pilha", nome: "Brinquedo com pilha ou peça de metal", sinonimos: ["brinquedo", "brinquedo eletrônico"], motivo: "Tem peças de materiais diferentes.", ondeDescartar: "Tire as pilhas e leve a um ponto de coleta de pilhas. O resto vai no lixo comum." },
    ],
  },
  {
    id: "papel",
    nome: "Papel",
    material: "papel",
    preparo: ["Mantenha limpo e seco.", "Desmonte as caixas.", "Dobre, não amasse em bola."],
    aceitos: [
      { id: "jornal-revista", nome: "Jornal e revista", sinonimos: ["jornal", "revista", "encarte", "panfleto"], dica: null },
      { id: "caixa-papelao", nome: "Caixa de papelão", sinonimos: ["papelão", "caixa", "caixa de mudança"], dica: "Desmonte e amarre as caixas." },
      { id: "papel-escritorio", nome: "Folha de caderno e papel de escritório", sinonimos: ["folha", "caderno", "papel sulfite", "papel a4", "folha de caderno"], dica: "Pode levar com grampo." },
      { id: "caixa-leite", nome: "Caixa de leite", sinonimos: ["longa vida", "tetra pak", "caixa de suco", "embalagem cartonada"], dica: "Lave, deixe secar e abra a caixa." },
      { id: "embalagem-papel", nome: "Embalagem de papel", sinonimos: ["caixa de cereal", "caixa de pasta de dente", "caixa de remédio", "papel de presente"], dica: null },
      { id: "envelope", nome: "Envelope", sinonimos: ["envelope de carta", "correspondência"], dica: "Tire a parte de plástico, se tiver." },
    ],
    naoAceitos: [
      { id: "papel-higienico", nome: "Papel higiênico e guardanapo usados", sinonimos: ["papel higiênico", "guardanapo", "lenço de papel", "papel toalha"], motivo: "Papel sujo ou molhado não pode ser reciclado.", ondeDescartar: "Lixo comum." },
      { id: "papel-engordurado", nome: "Papel engordurado", sinonimos: ["caixa de pizza suja", "papel com gordura"], motivo: "A gordura estraga o papel na reciclagem.", ondeDescartar: "Lixo comum. A parte limpa da caixa pode ir para o ecoponto." },
      { id: "papel-plastificado", nome: "Papel plastificado, adesivo ou foto", sinonimos: ["etiqueta", "adesivo", "fotografia", "papel plastificado"], motivo: "Tem plástico ou cola misturados no papel.", ondeDescartar: "Lixo comum." },
      { id: "papel-carbono", nome: "Papel carbono", sinonimos: ["carbono"], motivo: "A tinta do papel carbono não sai na reciclagem.", ondeDescartar: "Lixo comum." },
    ],
  },
  {
    id: "metal",
    nome: "Metal",
    material: "metal",
    preparo: ["Lave e amasse.", "Deixe secar antes de guardar."],
    aceitos: [
      { id: "lata-aluminio", nome: "Lata de alumínio", sinonimos: ["lata", "latinha", "lata de refrigerante", "lata de cerveja", "lata de alumínio"], dica: null },
      { id: "lata-aco", nome: "Lata de conserva", sinonimos: ["lata de sardinha", "lata de milho", "lata de leite em pó", "lata de aço"], dica: "Lave e encaixe a tampa dentro da lata, para ninguém se cortar." },
      { id: "tampa-metal", nome: "Tampa de metal", sinonimos: ["tampinha de metal", "tampa de pote", "tampa de garrafa"], dica: null },
      { id: "panela-velha", nome: "Panela e frigideira velhas", sinonimos: ["panela", "frigideira", "chaleira"], dica: "Tire o cabo de plástico, se der." },
      { id: "papel-aluminio", nome: "Papel alumínio e marmitex de alumínio", sinonimos: ["papel alumínio", "marmitex", "quentinha de alumínio", "bandeja de alumínio"], dica: "Só se estiver limpo." },
      { id: "arame-prego", nome: "Arame, prego e parafuso", sinonimos: ["arame", "prego", "parafuso", "ferro"], dica: "Junte numa caixa ou garrafa para ninguém se ferir." },
    ],
    naoAceitos: [
      { id: "pilha-bateria", nome: "Pilha e bateria", sinonimos: ["pilha", "bateria", "bateria de celular"], motivo: "Tem produtos tóxicos e precisa de coleta especial.", ondeDescartar: "Pontos de coleta de pilhas em supermercados e lojas de eletrônicos." },
      { id: "lata-tinta", nome: "Lata de tinta ou solvente", sinonimos: ["lata de tinta", "solvente", "thinner", "verniz"], motivo: "Resto de tinta e solvente é resíduo perigoso.", ondeDescartar: "Pergunte na loja de tintas se ela recebe as latas de volta." },
      { id: "aerossol", nome: "Aerossol (spray)", sinonimos: ["spray", "desodorante aerossol", "inseticida", "lata de spray"], motivo: "A lata tem pressão e pode ter produto perigoso.", ondeDescartar: "Lixo comum, com a lata bem vazia. Não fure nem queime." },
    ],
  },
  {
    id: "vidro",
    nome: "Vidro",
    material: "vidro",
    preparo: ["Lave e deixe secar.", "Tire as tampas: elas vão em plástico ou metal.", "Leve inteiro. Se quebrar, embrulhe em jornal e avise o atendente."],
    aceitos: [
      { id: "garrafa-vidro", nome: "Garrafa de vidro", sinonimos: ["garrafa de cerveja", "garrafa de vinho", "garrafa de refrigerante de vidro", "long neck"], dica: null },
      { id: "pote-vidro", nome: "Pote de vidro", sinonimos: ["pote de conserva", "pote de palmito", "pote de azeitona", "vidro de geleia"], dica: null },
      { id: "frasco-perfume", nome: "Frasco de perfume vazio", sinonimos: ["perfume", "vidro de perfume"], dica: null },
      { id: "frasco-remedio", nome: "Frasco de remédio de vidro vazio", sinonimos: ["vidro de remédio", "frasco de xarope"], dica: "Só vazio. Remédio que sobrou vai para a farmácia." },
      { id: "garrafa-azeite", nome: "Garrafa de azeite ou molho", sinonimos: ["garrafa de azeite", "vidro de molho", "garrafa de vinagre"], dica: "Lave com detergente para tirar a gordura." },
    ],
    naoAceitos: [
      { id: "espelho", nome: "Espelho", sinonimos: ["espelho quebrado"], motivo: "Tem uma camada de metal que impede a reciclagem.", ondeDescartar: "Embrulhe em jornal, escreva \"vidro\" e coloque no lixo comum." },
      { id: "vidro-plano", nome: "Vidro de janela ou de box", sinonimos: ["vidro de janela", "box", "vidro temperado", "para-brisa"], motivo: "É um tipo de vidro diferente do de garrafas e potes.", ondeDescartar: "Vidraçarias costumam receber. Se não, embrulhe e coloque no lixo comum." },
      { id: "lampada", nome: "Lâmpada", sinonimos: ["lâmpada fluorescente", "lâmpada led", "lâmpada queimada"], motivo: "Algumas lâmpadas têm mercúrio e precisam de coleta especial.", ondeDescartar: "Lojas que vendem lâmpadas recebem as usadas." },
      { id: "louca-ceramica", nome: "Louça e cerâmica", sinonimos: ["prato", "xícara", "pires", "porcelana", "cerâmica", "copo de vidro"], motivo: "Não derrete junto com o vidro de embalagem.", ondeDescartar: "Embrulhe em jornal e coloque no lixo comum." },
    ],
  },
  {
    id: "oleo",
    nome: "Óleo de cozinha",
    material: "oleo",
    preparo: ["Espere esfriar.", "Coe para tirar os restos de comida.", "Guarde numa garrafa PET bem fechada."],
    aceitos: [
      { id: "oleo-soja", nome: "Óleo de soja usado", sinonimos: ["óleo de cozinha", "óleo usado", "óleo de soja"], dica: null },
      { id: "oleo-fritura", nome: "Óleo de fritura", sinonimos: ["óleo de fritar", "óleo da fritadeira"], dica: null },
      { id: "oleo-girassol", nome: "Óleo de girassol ou canola usado", sinonimos: ["girassol", "canola"], dica: null },
      { id: "oleo-milho", nome: "Óleo de milho usado", sinonimos: ["óleo de milho"], dica: null },
      { id: "azeite-usado", nome: "Azeite usado", sinonimos: ["azeite de oliva", "azeite"], dica: null },
    ],
    naoAceitos: [
      { id: "oleo-motor", nome: "Óleo de motor", sinonimos: ["óleo de carro", "óleo de moto", "óleo lubrificante"], motivo: "É resíduo perigoso, diferente do óleo de cozinha.", ondeDescartar: "Postos e oficinas que trocam óleo recebem o usado." },
      { id: "oleo-com-agua", nome: "Óleo misturado com água ou detergente", sinonimos: ["óleo com água", "água com óleo"], motivo: "A mistura não serve para reciclar.", ondeDescartar: "Lixo comum, dentro de uma garrafa fechada. Nunca no ralo." },
      { id: "gordura-solida", nome: "Margarina, manteiga e banha", sinonimos: ["margarina", "manteiga", "banha", "gordura"], motivo: "Gordura sólida não é aceita junto com o óleo.", ondeDescartar: "Lixo comum." },
    ],
  },
  {
    id: "nao_aceitos",
    nome: "Não aceitos",
    material: null,
    preparo: [],
    aceitos: [],
    naoAceitos: [
      { id: "casca-banana", nome: "Casca de banana", sinonimos: ["banana", "casca de fruta", "resto de fruta"], motivo: "É resto de comida, não é reciclável.", ondeDescartar: "Resto de comida vai no lixo comum ou na compostagem." },
      { id: "resto-comida", nome: "Resto de comida", sinonimos: ["comida", "borra de café", "casca de ovo", "orgânico"], motivo: "É resíduo orgânico, não é reciclável.", ondeDescartar: "Lixo comum ou compostagem." },
      { id: "fralda", nome: "Fralda e absorvente", sinonimos: ["fralda descartável", "absorvente"], motivo: "É resíduo sanitário.", ondeDescartar: "Lixo comum, bem fechado." },
      { id: "eletronico", nome: "Celular, carregador e eletrônicos", sinonimos: ["celular", "carregador", "fone de ouvido", "computador", "eletrônico"], motivo: "Precisa de coleta própria de eletrônicos.", ondeDescartar: "Lojas de eletrônicos e pontos de coleta de eletrônicos." },
      { id: "remedio-vencido", nome: "Remédio vencido", sinonimos: ["remédio", "medicamento", "comprimido"], motivo: "Pode contaminar a água e o solo.", ondeDescartar: "Farmácias com coleta de medicamentos." },
      { id: "seringa", nome: "Seringa e agulha", sinonimos: ["agulha", "seringa", "lanceta"], motivo: "Pode ferir e transmitir doenças.", ondeDescartar: "Leve à unidade de saúde dentro de uma garrafa PET fechada." },
      { id: "pneu", nome: "Pneu", sinonimos: ["pneu velho", "câmara de ar"], motivo: "Precisa de coleta própria.", ondeDescartar: "Borracharias e lojas de pneus recebem os usados." },
      { id: "entulho", nome: "Entulho de obra", sinonimos: ["entulho", "tijolo", "cimento", "azulejo"], motivo: "Não é material de coleta seletiva.", ondeDescartar: "Contrate uma caçamba ou procure a coleta de entulho da prefeitura." },
    ],
  },
];

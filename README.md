# Reciclar Certo – ECOponto Boa Vista

Página do canal "Reciclar Certo" do app do cidadão (plataforma SASI), aberta em webview. Tem três abas:

- **Posso levar?** (T21): o cidadão fotografa um item e a IA, no servidor, diz se o ecoponto recebe.
- **Guia de materiais**: o que é aceito, o que não é e como preparar, com os pontos da tabela de valores vigente. Funciona offline.
- **Jogo da Separação** (T45, Fase 3): 10 itens para separar nas lixeiras. Dá XP só na primeira partida do dia.

## Como rodar

Requisitos: Node 22+ e pnpm 12 (`corepack enable pnpm`). Não precisa instalar PostgreSQL nem Docker.

```bash
pnpm install
pnpm dev          # API em :3010 + Vite em :5175 → http://localhost:5175/reciclar/
```

O `pnpm dev`:
- usa o **PGlite** (PostgreSQL em WASM, em memória) e a **IA mock**;
- liga o jogo;
- entra sempre como `cidadao-ana`.

Para escolher a pessoa em `/dev`, use `pnpm --filter @ecoponto/api dev:escolher`.

| Pessoa | O que mostra |
|---|---|
| `cidadao-ana` | ainda não jogou hoje (a primeira partida dá XP) |
| `cidadao-bruno` | já ganhou XP hoje ("Partida extra") |
| `cidadao-limite` | já usou as 30 fotos de hoje |

**Fotos de exemplo.** Sem câmera, abra "Testar com fotos de exemplo (demonstração)" na aba Posso levar?. A IA mock reconhece essas fotos e responde:

| Foto | Resultado |
|---|---|
| lata | aceito |
| casca de banana | não aceito |
| garrafa PET | aceito |
| pote de vidro | aceito |
| pilha | não aceito |
| foto borrada | incerto |
| demora | mais de 5 s: tempo esgotado |
| IA fora do ar | erro |

Qualquer outra foto volta como "Não temos certeza.".

As fotos ficam em `apps/web/public/exemplos`. São ilustrações, geradas por `pnpm fotos-exemplo`.

Testes:

```bash
pnpm test        # unitários, API (PGlite + PostgreSQL real) e telas (Vitest + happy-dom)
pnpm typecheck
pnpm test:e2e    # Playwright: 4G simulado, tempo esgotado, offline com service worker, arrastar/toque/teclado, reduzir movimento, 360 px
```

Os testes de concorrência sobem um **PostgreSQL real** pelo `embedded-postgres`. Para usar outro servidor: `ECO_PG_TESTE=postgres://...`.

## Da foto ao resultado

1. **Aparelho.** O botão "Fotografar item" é um `<input type=file capture=environment>`, que abre a câmera traseira. "Escolher da galeria" é o mesmo campo, sem `capture`.
   - A foto é reduzida no canvas: lado maior de até 1280 px, JPEG com qualidade 0,7. Redesenhar também tira o EXIF.
   - O envio é `image/jpeg` para `POST /api/cidadao/reciclar/analisar`, com limite de **5 s**. Passou disso, a página cancela e mostra a busca do guia.
2. **Servidor** (`apps/api/src/reciclar/servico.ts`):
   1. confere se é JPEG e tira os metadados de novo (APP1/EXIF com GPS, IPTC, comentários);
   2. conta a foto no limite do dia, num `INSERT … ON CONFLICT … WHERE total < limite` atômico;
   3. chama a IA com tempo limite de 4,5 s;
   4. liga os rótulos da IA aos itens do guia (`mapearResultado`, em `packages/regras`);
   5. zera os bytes da foto na memória.
3. **Quem decide é o guia, não a IA.** A IA só diz o que vê ("lata de alumínio", 0,94). Se o item está nos aceitos, o resultado é **aceito**, com preparo e estimativa da tabela vigente. Se está nos não aceitos, é **não aceito**, com motivo e onde descartar. Confiança abaixo de 70%, ou rótulo fora do guia, dá **incerto**, com as 2 sugestões mais prováveis.

**Privacidade.** A foto não é gravada em banco, disco, cache, log ou Sentry. Nenhuma tabela tem coluna binária. Quem garante isso é o teste `privacidade da foto` em `apps/api/src/app.test.ts`: ele confere a memória zerada, que nenhum pedaço da foto ficou no banco e que nada dela foi para o log. Para a IA só vão os bytes da imagem, sem usuário e sem localização.

**Log estruturado.** Cada análise gera `{evento: "analise", resultado, material, item, confianca, duracaoMs}`, sem imagem e sem usuário.

## Onde trocar a IA mock pela real

A porta fica em `apps/api/src/ia/classificador.ts`:

```ts
interface ClassificadorImagem {
  classificar(imagem: Uint8Array, opts: { signal: AbortSignal }): Promise<{ rotulo: string; confianca: number }[]>;
}
```

A IA do app do atendente (T07/T14) ainda não existia no repositório. Por isso existem duas implementações:
- `classificadorMock`, que reconhece as fotos de exemplo pelo hash;
- `classificadorHttp`, um adaptador genérico. Ele entra quando `ECO_IA_URL` e `ECO_IA_CHAVE` estão definidas, e a chave fica só no servidor.

Quando o contrato da IA real estiver definido, ajuste `classificadorHttp` ou escreva outro adaptador e escolha-o em `apps/api/src/config.ts`. O rótulo pode ser o id do guia (`lata-aluminio`) ou texto livre: o servidor faz a ligação pela busca.

## Como ligar e desligar o jogo

`ECO_JOGO_SEPARACAO=1` liga o jogo; o `--jogo` do `pnpm dev` faz o mesmo. Sem isso, o jogo fica desligado:
- `GET /api/cidadao/jogo` responde `{ativo: false}`;
- a aba some e `/reciclar/jogo` volta para Posso levar?;
- `POST /api/cidadao/jogo/partidas` responde 404.

`ECO_JOGO_SEPARACAO=0` força desligado.

**XP diário** (`apps/api/src/jogo/servico.ts`). A tabela `jogo_xp_diario` tem chave primária `(usuario_id, dia)`, com o dia calculado em `America/Boa_Vista` no servidor. A primeira partida do dia insere a linha e ganha XP; as outras caem no `ON CONFLICT` e recebem 0, com a mensagem "Partida extra". O id da partida vem do aparelho, então reenviar não duplica nada.

Depois do commit, o servidor chama `registrarEventoXp` (`apps/api/src/xp/xp.ts`, mock do T42) com a chave `jogo:{id}`.

Os testes de concorrência, num PostgreSQL real, cobrem dois casos:
- 8 partidas simultâneas: só uma ganha XP;
- o mesmo id enviado 6 vezes: uma partida só.

Regra de XP: 10 + 1 por acerto, até 20. Muda com `ECO_JOGO_XP_BASE`, `ECO_JOGO_XP_POR_ACERTO` e `ECO_JOGO_XP_MAXIMO`.

## Onde ficam os tokens

`packages/tokens/tokens.css`, o único arquivo com cores. Usa os mesmos valores de Minha Carteirinha, Meus Pontos e Prêmios, mais:
- `--resultado-*`: faixas de Aceito (verde), Não aceito (token de erro) e Incerto (token de aviso), sempre com ícone e texto;
- `--bin-*`: as 6 lixeiras do jogo. São a **exceção** aos tokens de marca, porque seguem o padrão nacional da coleta seletiva. Todas têm contraste AA no texto, e o amarelo do metal usa texto escuro, nunca branco;
- tema escuro.

Com "reduzir movimento" ligado no aparelho, nenhuma animação roda: as comemorações nem são criadas, e uma regra global no CSS desliga o resto.

## Outras variáveis

| Variável | Padrão | Uso |
|---|---|---|
| `ECO_LIMITE_FOTOS_DIA` | 30 | fotos por cidadão por dia |
| `ECO_LIMIAR_CONFIANCA` | 0.7 | abaixo disto: "Não temos certeza." |
| `ECO_IA_MOCK_ATRASO_MS` | 700 | atraso simulado da IA mock |
| `DATABASE_URL` | (PGlite) | PostgreSQL de verdade (`--seed` semeia se vazio) |
| `REDIS_URL` | (memória) | cache de 60 s do guia montado |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | – | Sentry, com foto, CPF e nome removidos (`packages/observability`) |
| `VITE_LINK_ECOPONTOS` | `/ecopontos/` | deep link do canal Ecopontos |
| `VITE_FOTOS_EXEMPLO` | ligado no dev | mostra as fotos de exemplo. **Desligar em produção.** |

## API

| Endpoint | Retorno |
|---|---|
| `GET /api/publico/guia-materiais` | categorias, exemplos, preparo e valores da tabela vigente (público, `Cache-Control: public`) |
| `POST /api/cidadao/reciclar/analisar` (corpo `image/jpeg`, até 2 MB) | `aceito` / `nao_aceito` / `incerto`, conforme a seção "Da foto ao resultado". Erros: `401`, `413`, `415`, `429` (limite do dia), `503` (IA fora), `504` (tempo esgotado) |
| `GET /api/cidadao/jogo` | `{ativo, xpDisponivelHoje, xpMaximo, itensPorPartida}` |
| `POST /api/cidadao/jogo/partidas` `{id, respostas[10]}` | `{acertos, total, xpConcedido, extra, repetida}`. O servidor corrige pelo gabarito. |

O endpoint `GET /api/cidadao/jogo` não estava na especificação. Ele existe para a página saber se mostra a aba e se a partida vai dar XP.

## Estrutura

```
packages/contracts      Zod (zod/mini): guia, análise, jogo, erros
packages/regras         busca do guia, mapeamento do resultado da IA, gabarito e XP do jogo, conteúdo do guia
packages/format         pt-BR, dia em America/Boa_Vista, rótulos das categorias e lixeiras
packages/tokens         tokens.css
packages/observability  limpeza dos eventos do Sentry
apps/api                Fastify + PostgreSQL (pg ou PGlite); IA mock; XP mock
apps/web                Vite + TypeScript sem framework; service worker
```

## Pendências de definição

1. **Câmera no webview SASI:** confirmar se o webview abre a câmera com `capture`. A galeria é o plano B.
2. **Retenção da foto (T34):** adotado **zero**. A foto é descartada logo depois da resposta.
3. **Limiar de confiança:** adotado **70%**.
4. **Limite de fotos:** adotado **30 por cidadão por dia**. Foto com erro ou tempo esgotado também conta, porque já gerou custo na IA.
5. **Fonte do conteúdo do guia:** adotado o **arquivo** `packages/regras/src/conteudo.ts`. Se for para o Painel de Gestão, só a origem muda (`guia/servico.ts`). Os textos são exemplos e precisam de revisão da equipe do programa.
6. **Categorias:** adotadas as 5 da tabela v3 mais "Não aceitos". A categoria "Não aceitos" não tem exemplos aceitos, por definição. Ela tem 8 itens com onde descartar.
7. **IA real (T07/T14):** o contrato não existe. `classificadorHttp` assume `{rotulos: [{rotulo, confianca}]}`.
8. **Motor de XP (T42):** só o mock. Falta definir o valor do XP (adotado 10 + 1 por acerto, até 20) e se o motor aceita `chave` como idempotência.
9. **Tabela de valores (T29):** criada aqui na versão mínima (`tabela_valores`), com os valores v2 e v3 das entregas de Meus Pontos. Na v3, metal vale **45** pontos/kg, não os 40 do exemplo da especificação. Quando o T29 existir, ler de lá.
10. **Autenticação no webview SASI:** hoje cookie `eco_sessao` ou Bearer, com tokens de desenvolvimento. O servidor não sobe em produção sem isso.
11. **Deep link do canal Ecopontos:** `VITE_LINK_ECOPONTOS`.
12. **Gabarito do jogo é público:** quem quiser pode mandar só respostas certas. O máximo é 20 XP por dia, então o ganho é pequeno. Confirmar se é aceitável.
13. **Itens por partida e lixeiras:** 10 itens, sorteados para passar pelas 6 lixeiras.

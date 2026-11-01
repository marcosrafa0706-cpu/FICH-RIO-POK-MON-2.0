# Fichário de cartas (versão hospedável)

Pokémon, Magic, Lorcana e One Piece, com busca por nome, número e coleção.
Só funciona hospedado num endereço próprio (GitHub Pages, Netlify...).

## Arquivos (envie todos, na mesma pasta)

- `index.html`: o fichário
- `busca.js`: tela de busca e escolha do jogo
- `catalogo.js`: registro de fontes (permite trocar de fonte depois)
- `infra.js`: cache, limite de requisições e tentativas automáticas
- `util.js`: funções puras (leitura de números e nomes, semelhança), com testes
- `foto.js`: identificação de carta por foto (OCR no navegador)
- `extras.js`: tema, repetidas, desejos, estatísticas, backup em arquivo, tutorial
- `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png`: instalação como aplicativo
- `tcgdex.js` (Pokémon), `scryfall.js` (Magic), `lorcast.js` (Lorcana), `optcg.js` (One Piece): uma fonte por arquivo

Se o seu repositório ainda tem o `busca-tcgdex.js`, pode apagar: não é mais usado.

## Publicar no GitHub Pages
Repositório → **Add file → Upload files** (os arquivos com o mesmo nome são substituídos) → **Commit changes**.
Depois, **Settings → Pages → Deploy from a branch → main / (root)**.

## Limites e termos
- Cada fonte tem seus limites em `busca.js` (tabela `LIM`). Confira as regras no site de cada uma: tcgdex.dev, scryfall.com/docs/api, lorcast.com/docs/api, optcgapi.com/documentation.
- Scryfall: não corte nem distorça as imagens, mantenha o crédito e não cobre acesso aos dados.
- A OPTCG API é um projeto pessoal e não oficial; use com moderação.
- As imagens vêm do endereço informado por cada fonte e não são copiadas para a sua hospedagem.
- Mantenha as atribuições e o aviso de site de fã.

## Trocar ou acrescentar uma fonte
Crie um arquivo no formato descrito no topo de `catalogo.js` e registre-o em `busca.js`.

## Testes automáticos (opcional, para quem desenvolve)
Com o Node 18 ou mais novo, na pasta do projeto: `npm test`. Os testes cobrem a leitura de números e nomes e o mapeamento de cada fonte de cartas, usando respostas de exemplo (sem internet).

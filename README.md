# Fichário Pokémon (versão hospedável)

Esta pasta é o seu fichário com a busca de cartas do TCGdex. Ela só funciona
quando está hospedada num endereço próprio, porque a página precisa acessar a
internet para buscar as cartas.

## Arquivos (envie todos, na mesma pasta)

- `index.html`: o fichário
- `busca-tcgdex.js`: liga o fichário à fonte de cartas
- `tcgdex.js`: conversa com o TCGdex
- `catalogo.js`: registro de fontes (permite trocar de fonte depois)
- `infra.js`: cache, limite de requisições e tentativas automáticas

## Publicar de graça no GitHub Pages

1. Crie uma conta em github.com e clique em **New repository**. Dê um nome (ex.: `ficharios`) e marque **Public**.
2. Em **Add file → Upload files**, arraste os 5 arquivos e clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em **Branch**, escolha `main` e a pasta `/ (root)`, e salve.
4. Espere cerca de 1 minuto. O endereço aparece na mesma tela: `https://SEU-USUARIO.github.io/ficharios/`.

(Alternativa: no netlify.com, use **Add new site → Deploy manually** e arraste a pasta.)

## Testar no seu computador

Na pasta, rode `python3 -m http.server` e abra `http://localhost:8000`.
Abrir o `index.html` com duplo clique não funciona (os módulos JavaScript exigem um servidor).

## Levar o que você já cadastrou

Os dados ficam guardados no navegador, por endereço. O novo endereço começa vazio.
1. No fichário atual, abra um fichário e toque em ⚙️. Copie o texto do **Backup**.
2. No endereço novo, abra um fichário, toque em ⚙️, cole o texto e toque em **Restaurar**.

## Limites e termos

- O código usa por padrão 30 requisições por minuto e 2.000 por dia por navegador, com cache. Ajuste em `busca-tcgdex.js` depois de conferir as regras em https://tcgdex.dev.
- As imagens vêm do endereço que o TCGdex informa e não são copiadas para a sua hospedagem. Confira nos termos do TCGdex o que é permitido para o seu uso.
- O site mostra a atribuição ao TCGdex e o aviso de que é um site de fã. Mantenha esses textos.

## Trocar de fonte no futuro

Crie um arquivo novo no formato descrito no topo de `catalogo.js` e troque a linha
`registrarFonte(...)` em `busca-tcgdex.js`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFonteTcgdex } from '../tcgdex.js';
import { criarFonteScryfall } from '../scryfall.js';
import { criarFonteLorcast } from '../lorcast.js';
import { criarFonteOptcg } from '../optcg.js';

// "http" falso: responde com dados de exemplo e guarda os endereços pedidos.
const falso = (respostas) => {
  const urls = [];
  return { urls, buscar: async (url) => {
    urls.push(url);
    for (const [trecho, resp] of respostas) if (url.includes(trecho)) {
      if (resp instanceof Error) throw resp;
      return { dados: resp, origem: 'rede' };
    }
    throw Object.assign(new Error('HTTP 404 em ' + url), { codigo: 'FATAL' });
  } };
};

test('TCGdex: busca por nome monta miniatura e idioma', async () => {
  const http = falso([['/pt/cards?', [{ id: 'sv01-025', localId: '025', name: 'Pikachu', image: 'https://assets.tcgdex.net/pt/sv/sv01/025' }]]]);
  const f = criarFonteTcgdex({ http });
  const r = await f.buscar({ nome: 'Pikachu', lingua: 'pt' });
  assert.equal(r.itens[0].imagem, 'https://assets.tcgdex.net/pt/sv/sv01/025/low.webp');
  assert.equal(r.itens[0].lingua, 'pt');
  assert.deepEqual(f.linguas, ['pt', 'en']);
});
test('TCGdex: idioma vazio usa o padrão (sem barra dupla)', async () => {
  const http = falso([['/cards?', []]]);
  await criarFonteTcgdex({ http }).buscar({ nome: 'x', lingua: '' });
  assert.ok(!http.urls[0].includes('v2//'));
});
test('TCGdex: código especial XY123 filtra por localId', async () => {
  const http = falso([['localId', [{ id: 'xyp-XY123', localId: 'XY123', name: 'Pikachu', image: '' }]]]);
  const r = await criarFonteTcgdex({ http }).porCodigo('xy123', { lingua: 'en' });
  assert.match(decodeURIComponent(http.urls[0]), /localId=eq:XY123/);
  assert.equal(r.itens[0].numero, 'XY123');
});
test('TCGdex: código com hífen busca a carta direto; texto comum devolve null', async () => {
  const http = falso([['/cards/sv01-001', { id: 'sv01-001', localId: '001', name: 'Sprigatito', image: 'x', rarity: 'Common', set: { id: 'sv01', name: 'Escarlate', cardCount: { official: 198 } } }]]);
  const f = criarFonteTcgdex({ http });
  const r = await f.porCodigo('sv01-001', { lingua: 'pt' });
  assert.equal(r.itens[0].det.totalImpresso, 198);
  assert.equal(await f.porCodigo('pikachu'), null);
});
test('TCGdex: número com zeros e maiúsculas na coleção', async () => {
  const http = falso([['/sets/xyp', { id: 'xyp', name: 'Promos', cards: [{ id: 'xyp-XY123', localId: 'XY123', name: 'A', image: '' }, { id: 'xyp-XY5', localId: 'XY5', name: 'B', image: '' }] }]]);
  const r = await criarFonteTcgdex({ http }).buscar({ colecao: 'xyp', numero: 'xy123', lingua: 'en' });
  assert.deepEqual(r.itens.map(c => c.id), ['xyp-XY123']);
});

test('Scryfall: consulta com coleção e número; 404 vira lista vazia', async () => {
  const http = falso([['/cards/search', Object.assign(new Error('HTTP 404 em /cards/search'), { codigo: 'FATAL' })]]);
  const f = criarFonteScryfall({ http });
  const r = await f.buscar({ nome: 'bolt', colecao: 'mkm', numero: '012' });
  assert.deepEqual(r.itens, []);
  const q = new URL(http.urls[0]).searchParams.get('q');
  assert.equal(q, 'name:"bolt" e:mkm cn:12');
});
test('Scryfall: código "mkm 123"; 005/225 não é código de Magic', async () => {
  const carta = { id: 'u1', name: 'Lightning Bolt', collector_number: '123', set: 'mkm', set_name: 'Murders', rarity: 'common', colors: ['R'], image_uris: { small: 'https://cards.scryfall.io/small/x.jpg' } };
  const http = falso([['/cards/mkm/123', carta]]);
  const f = criarFonteScryfall({ http });
  const r = await f.porCodigo('mkm 123');
  assert.equal(r.itens[0].det.tipos[0], 'Fogo');
  assert.equal(await f.porCodigo('005/225'), null);
});

test('Lorcast: lista por coleção filtra nome e número', async () => {
  const cartas = { results: [
    { id: 'a', name: 'Elsa', version: 'Snow Queen', collector_number: '42', rarity: 'Rare', ink: 'Sapphire', set: { code: '1', name: 'First' }, image_uris: { digital: { small: 's.avif' } } },
    { id: 'b', name: 'Mickey', collector_number: '7', rarity: 'Common', ink: 'Amber', set: { code: '1', name: 'First' }, image_uris: { digital: { small: 't.avif' } } } ] };
  const http = falso([['/sets/1/cards', cartas]]);
  const f = criarFonteLorcast({ http });
  assert.equal((await f.buscar({ colecao: '1', nome: 'elsa' })).itens[0].nome, 'Elsa - Snow Queen');
  assert.equal((await f.buscar({ colecao: '1', numero: '7' })).itens[0].det.tipos[0], 'Elétrico');
});

test('OPTCG: código OP01-001 e formato inesperado', async () => {
  const ok = [{ card_name: 'Luffy', card_set_id: 'OP01-001', card_image_id: 'OP01-001', card_color: 'Red', rarity: 'L', set_name: 'Romance Dawn', set_id: 'OP-01', card_image: 'https://x/y.png' }];
  const f = criarFonteOptcg({ http: falso([['/sets/card/OP01-001', ok]]) });
  const r = await f.porCodigo('op01-001');
  assert.equal(r.itens[0].numero, '001');
  assert.equal(r.itens[0].det.tipos[0], 'Fogo');
  assert.equal(await f.porCodigo('pikachu'), null);
  const ruim = criarFonteOptcg({ http: falso([['/allSetCards', [{ foo: 1 }]]]) });
  await assert.rejects(() => ruim.buscar({ nome: 'x' }), /formato inesperado/);
});

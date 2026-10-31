// Adaptador do TCGdex (https://tcgdex.dev). Só ele conhece a API; o resto do
// site conversa com o formato descrito em catalogo.js.
const BASE = 'https://api.tcgdex.net/v2';
const semZeros = s => String(s ?? '').trim().replace(/^0+(?=\d)/, '');

export function criarFonteTcgdex({ http, lingua = 'pt' }) {
  const U = p => `${BASE}/${lingua}${p}`;
  const norm = c => ({ id: c.id, nome: c.name || '', numero: c.localId || '', imagem: c.image || '', fonte: 'tcgdex' });
  const DIAS7 = 7 * 864e5;

  return {
    id: 'tcgdex',
    nome: 'TCGdex',
    atribuicao: { texto: 'Dados e imagens: TCGdex', url: 'https://tcgdex.dev' },

    async colecoes() {
      const { dados } = await http.buscar(U('/sets'), { ttl: DIAS7 });
      return dados.map(s => ({ id: s.id, nome: s.name, total: s.cardCount?.total ?? s.cardCount?.official ?? null }));
    },

    // Com coleção: lista a coleção inteira (1 requisição, em cache) e filtra aqui.
    // Sem coleção: busca por nome na API, com paginação.
    async buscar({ nome = '', numero = '', colecao = '', pagina = 1, porPagina = 24 } = {}) {
      const num = semZeros(numero), n = nome.trim().toLowerCase();
      if (colecao) {
        const r = await http.buscar(U('/sets/' + encodeURIComponent(colecao)), { ttl: DIAS7 });
        let l = (r.dados.cards || []).map(c => ({ ...norm(c), colecao: { id: r.dados.id, nome: r.dados.name } }));
        if (n) l = l.filter(c => c.nome.toLowerCase().includes(n));
        if (num) l = l.filter(c => semZeros(c.numero) === num);
        return { itens: l.slice((pagina - 1) * porPagina, pagina * porPagina), temMais: l.length > pagina * porPagina, origem: r.origem };
      }
      if (!n) throw new Error('Digite um nome ou escolha uma coleção.');
      const q = new URLSearchParams({ name: nome.trim(), 'pagination:page': pagina, 'pagination:itemsPerPage': porPagina });
      const r = await http.buscar(U('/cards?' + q), { ttl: 864e5 });
      let itens = r.dados.map(norm);
      const temMais = itens.length === porPagina;
      if (num) itens = itens.filter(c => semZeros(c.numero) === num); // filtra só a página atual
      return { itens, temMais, origem: r.origem };
    },

    async detalhe(id) {
      const { dados: d } = await http.buscar(U('/cards/' + encodeURIComponent(id)), { ttl: DIAS7 });
      return { raridade: d.rarity || '', tipos: d.types || [], colecao: { id: d.set?.id, nome: d.set?.name || '' } };
    },
  };
}

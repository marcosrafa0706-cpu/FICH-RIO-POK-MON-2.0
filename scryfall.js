// Adaptador do Scryfall (Magic: The Gathering) — https://scryfall.com/docs/api
// Regras do Scryfall seguidas aqui: sem alterar/cortar as imagens, créditos ao
// Scryfall, intervalo entre requisições (configurado em busca.js) e cache.
const BASE = 'https://api.scryfall.com';
const limpa = s => String(s).replace(/["\\]/g, '').trim();
const COR = { R: 'Fogo', U: 'Água', G: 'Planta', B: 'Sombrio', W: 'Normal' }; // paleta do fichário

export function criarFonteScryfall({ http }) {
  const img = c => c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || '';
  const cores = c => { const cs = c.colors || c.card_faces?.[0]?.colors || []; return cs.length === 1 ? [COR[cs[0]]] : cs.length > 1 ? ['Dragão'] : []; };
  const norm = c => ({
    id: c.id, nome: c.name, numero: c.collector_number || '', imagem: img(c), lingua: '', fonte: 'scryfall',
    colecao: { id: c.set, nome: c.set_name },
    det: { raridade: c.rarity || '', tipos: cores(c), colecao: { id: c.set, nome: c.set_name } }, // já vem na lista: sem 2ª requisição
  });
  const vazio = e => e && /^HTTP 404/.test(e.message); // o Scryfall responde 404 quando não há resultados

  return {
    id: 'scryfall', nome: 'Scryfall (Magic)', linguas: [''],
    atribuicao: { texto: 'Dados e imagens: Scryfall', url: 'https://scryfall.com' },

    async colecoes() {
      const { dados } = await http.buscar(BASE + '/sets', { ttl: 7 * 864e5 });
      return dados.data.filter(s => !s.digital).map(s => ({ id: s.code, nome: s.name, total: s.card_count, oficial: s.printed_size ?? s.card_count, lingua: '' }));
    },
    async buscar({ nome = '', numero = '', colecao = '', pagina = 1 } = {}) {
      if (!nome.trim() && !colecao) throw new Error('Digite um nome ou escolha uma coleção.');
      const p = [];
      if (nome.trim()) p.push(`name:"${limpa(nome)}"`);
      if (colecao) p.push('e:' + colecao);
      if (numero.trim()) p.push('cn:' + limpa(numero).replace(/^0+(?=\d)/, ''));
      const u = `${BASE}/cards/search?` + new URLSearchParams({ q: p.join(' '), unique: 'prints', order: colecao ? 'set' : 'released', page: pagina });
      try {
        const r = await http.buscar(u, { ttl: 864e5 });
        return { itens: r.dados.data.map(norm), temMais: !!r.dados.has_more, origem: r.origem };
      } catch (e) { if (vazio(e)) return { itens: [], temMais: false, origem: 'rede' }; throw e; }
    },
    async nomes({ prefixo = '' } = {}) {
      try {
        const { dados } = await http.buscar(`${BASE}/cards/autocomplete?` + new URLSearchParams({ q: prefixo.trim() }), { ttl: 864e5 });
        return (dados.data || []).slice(0, 10);
      } catch (e) { if (vazio(e)) return []; throw e; }
    },
    async detalhe() { throw new Error('Detalhes já vêm na lista do Scryfall.'); },
  };
}

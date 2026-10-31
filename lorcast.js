// Adaptador do Lorcast (Disney Lorcana) — https://lorcast.com/docs/api
// Endpoints usados (conforme a documentação): /sets, /sets/:id/cards, /cards/search.
const BASE = 'https://api.lorcast.com/v0';
const lista = d => Array.isArray(d) ? d : (d?.results || d?.data || d?.cards || []);
const semZeros = s => String(s ?? '').trim().replace(/^0+(?=\d)/, '');
const TINTA = { amber: 'Elétrico', amethyst: 'Psíquico', emerald: 'Planta', ruby: 'Fogo', sapphire: 'Água', steel: 'Metal' }; // paleta do fichário

export function criarFonteLorcast({ http }) {
  const titulo = c => c.name + (c.version ? ' - ' + c.version : '');
  const img = c => c.image_uris?.digital?.small || c.image_uris?.digital?.normal || '';
  const norm = c => ({
    id: c.id, nome: titulo(c), numero: String(c.collector_number ?? ''), imagem: img(c), lingua: '', fonte: 'lorcast',
    colecao: { id: c.set?.code, nome: c.set?.name || '' },
    det: { raridade: c.rarity || '', tipos: c.ink ? [TINTA[String(c.ink).toLowerCase()] || ''] : [], colecao: { id: c.set?.code, nome: c.set?.name || '' } },
  });
  const filtra = (itens, nome, numero) => {
    const n = nome.trim().toLowerCase(), num = semZeros(numero);
    return itens.filter(c => (!n || c.nome.toLowerCase().includes(n)) && (!num || semZeros(c.numero) === num));
  };

  return {
    id: 'lorcast', nome: 'Lorcast (Lorcana)', linguas: [''],
    atribuicao: { texto: 'Dados e imagens: Lorcast', url: 'https://lorcast.com' },

    async colecoes() {
      const { dados } = await http.buscar(BASE + '/sets', { ttl: 7 * 864e5 });
      return lista(dados).map(s => ({ id: s.code ?? s.id, nome: s.name, total: null, lingua: '' }));
    },
    async buscar({ nome = '', numero = '', colecao = '', pagina = 1, porPagina = 30 } = {}) {
      let r, itens;
      if (colecao) {
        r = await http.buscar(`${BASE}/sets/${encodeURIComponent(colecao)}/cards`, { ttl: 7 * 864e5 });
        itens = lista(r.dados).map(norm);
      } else {
        if (!nome.trim()) throw new Error('Digite um nome ou escolha uma coleção.');
        r = await http.buscar(`${BASE}/cards/search?` + new URLSearchParams({ q: nome.trim(), unique: 'prints' }), { ttl: 864e5 });
        itens = lista(r.dados).map(norm);
      }
      itens = filtra(itens, nome, numero);
      return { itens: itens.slice((pagina - 1) * porPagina, pagina * porPagina), temMais: itens.length > pagina * porPagina, origem: r.origem };
    },
    async nomes({ prefixo = '' } = {}) {
      const { dados } = await http.buscar(`${BASE}/cards/search?` + new URLSearchParams({ q: prefixo.trim() }), { ttl: 864e5 });
      return [...new Set(lista(dados).map(c => c.name))].slice(0, 10);
    },
    // Código do Lorcana: coleção + número, ex.: "1/207" (coleção 1, carta 207).
    async porCodigo(codigo) {
      const m = String(codigo).trim().match(/^(\w{1,6})[\s\/\-]+(\d+)$/);
      if (!m) return null;
      try {
        const r = await http.buscar(`${BASE}/cards/${encodeURIComponent(m[1])}/${m[2]}`, { ttl: 7 * 864e5 });
        const c = Array.isArray(r.dados) || r.dados?.results ? lista(r.dados)[0] : r.dados;
        return { itens: c ? [norm(c)] : [], temMais: false, origem: r.origem };
      } catch (e) { if (/^HTTP 404/.test(e.message)) return { itens: [], temMais: false, origem: 'rede' }; throw e; }
    },
    async detalhe() { throw new Error('Detalhes já vêm na lista do Lorcast.'); },
  };
}

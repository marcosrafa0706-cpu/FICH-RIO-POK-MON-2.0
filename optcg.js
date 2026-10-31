// Adaptador da OPTCG API (One Piece) — https://www.optcgapi.com/documentation
// EXPERIMENTAL: a documentação lista os endpoints, mas não o formato exato das
// respostas. Os nomes dos campos abaixo são tolerantes; se algo vier diferente,
// o site mostra um aviso em vez de quebrar. Ajuste `norm` se for preciso.
const BASE = 'https://optcgapi.com/api';
const lista = d => Array.isArray(d) ? d : (d?.results || d?.data || []);
const semZeros = s => String(s ?? '').trim().replace(/^0+(?=\d)/, '');
const RAR = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Ultra Rare', SEC: 'Secret Rare', L: 'Legendary', SP: 'Special', P: '' };
const COR = { red: 'Fogo', green: 'Planta', blue: 'Água', purple: 'Psíquico', black: 'Sombrio', yellow: 'Elétrico' }; // paleta do fichário

export function criarFonteOptcg({ http }) {
  const norm = c => {
    const id = String(c.card_set_id || c.card_id || c.card_image_id || '');
    const cores = String(c.card_color || '').toLowerCase().split(/[\/,\s]+/).filter(Boolean);
    const tipos = cores.length === 1 ? [COR[cores[0]] || ''] : cores.length > 1 ? ['Dragão'] : [];
    const alt = /_p\d|alt/i.test(String(c.card_image_id || '')) ? ' (alt.)' : '';
    const col = { id: c.set_id || '', nome: c.set_name || '' };
    return {
      id: String(c.card_image_id || id), nome: (c.card_name || c.name || '') + alt, numero: (id.match(/-(\d+)/) || [])[1] || '',
      imagem: c.card_image || '', lingua: '', fonte: 'optcg', colecao: col,
      det: { raridade: RAR[c.rarity] ?? (c.rarity || ''), tipos, colecao: col },
    };
  };
  const cartas = async (colecao) => {
    const r = await http.buscar(colecao ? `${BASE}/sets/${encodeURIComponent(colecao)}/` : `${BASE}/allSetCards/`, { ttl: 7 * 864e5 });
    const l = lista(r.dados);
    if (l.length && !(l[0].card_name || l[0].name)) throw new Error('A OPTCG API respondeu num formato inesperado. Ajuste optcg.js.');
    return { itens: l.map(norm), origem: r.origem };
  };

  return {
    id: 'optcg', nome: 'OPTCG API (One Piece)', linguas: [''],
    atribuicao: { texto: 'Dados e imagens: OPTCG API (não oficial)', url: 'https://www.optcgapi.com' },

    async colecoes() {
      const { dados } = await http.buscar(BASE + '/allSets/', { ttl: 7 * 864e5 });
      return lista(dados).map(s => typeof s === 'string'
        ? { id: s, nome: s, total: null, lingua: '' }
        : { id: s.set_id || s.id, nome: s.set_name || s.name || s.set_id, total: null, lingua: '' }).filter(s => s.id);
    },
    async buscar({ nome = '', numero = '', colecao = '', pagina = 1, porPagina = 30 } = {}) {
      if (!nome.trim() && !colecao) throw new Error('Digite um nome ou escolha uma coleção.');
      const { itens, origem } = await cartas(colecao);
      const n = nome.trim().toLowerCase(), num = semZeros(numero);
      const f = itens.filter(c => (!n || c.nome.toLowerCase().includes(n)) && (!num || semZeros(c.numero) === num));
      return { itens: f.slice((pagina - 1) * porPagina, pagina * porPagina), temMais: f.length > pagina * porPagina, origem };
    },
    async nomes({ prefixo = '', colecao = '' } = {}) {
      if (!colecao) return []; // evita baixar o catálogo inteiro só para sugerir nomes
      const { itens } = await cartas(colecao), p = prefixo.trim().toLowerCase();
      return [...new Set(itens.map(c => c.nome).filter(x => x.toLowerCase().includes(p)))].slice(0, 10);
    },
    // Código do One Piece, ex.: "OP01-001" ou "ST01-005".
    async porCodigo(codigo) {
      const cod = String(codigo).trim().toUpperCase();
      if (!/^[A-Z]{1,3}\d{0,2}-\d{2,3}$/.test(cod)) return null;
      try {
        const r = await http.buscar(`${BASE}/sets/card/${encodeURIComponent(cod)}/`, { ttl: 7 * 864e5 });
        const d = r.dados;
        const l = Array.isArray(d) ? d : (d?.results || d?.data || (d && (d.card_name || d.name) ? [d] : []));
        return { itens: l.map(norm), temMais: false, origem: r.origem };
      } catch (e) { if (/^HTTP 404/.test(e.message)) return { itens: [], temMais: false, origem: 'rede' }; throw e; }
    },
    async detalhe() { throw new Error('Detalhes já vêm na lista da OPTCG API.'); },
  };
}

// Adaptador do TCGdex (https://tcgdex.dev). Só ele conhece a API; o resto do
// site conversa com o formato descrito em catalogo.js.
// Cada carta/coleção existe em vários idiomas; a mesma carta tem o mesmo id em
// todos eles. Por isso o adaptador aceita `lingua` em cada chamada.
const BASE = 'https://api.tcgdex.net/v2';
const semZeros = s => String(s ?? '').trim().replace(/^0+(?=\d)/, '');
const DIAS7 = 7 * 864e5;

export function criarFonteTcgdex({ http, lingua = 'pt', linguas = ['pt', 'en'] }) {
  const U = (p, l) => `${BASE}/${l || lingua}${p}`; // idioma vazio = idioma padrão
  const norm = (c, l) => ({ id: c.id, nome: c.name || '', numero: c.localId || '', imagem: c.image ? c.image + '/low.webp' : '', lingua: l || lingua, fonte: 'tcgdex' });

  return {
    id: 'tcgdex',
    nome: 'TCGdex',
    linguas, // idiomas pesquisados em paralelo (busca.js lê esta lista)
    atribuicao: { texto: 'Dados e imagens: TCGdex', url: 'https://tcgdex.dev' },

    // Une as coleções de todos os idiomas (português primeiro).
    async colecoes() {
      const out = new Map();
      for (const l of linguas) {
        try {
          const { dados } = await http.buscar(U('/sets', l), { ttl: DIAS7 });
          for (const s of dados) if (!out.has(s.id))
            out.set(s.id, { id: s.id, nome: l === lingua ? s.name : `${s.name} (${l.toUpperCase()})`, total: s.cardCount?.total ?? s.cardCount?.official ?? null, oficial: s.cardCount?.official ?? null, lingua: l });
        } catch (e) { if (e.codigo === 'LIMITE_DIARIO') throw e; }
      }
      if (!out.size) throw new Error('Não consegui carregar as coleções agora.');
      return [...out.values()];
    },

    // Com coleção: lista a coleção inteira (1 requisição, em cache) e filtra aqui.
    // Sem coleção: busca por nome na API, com paginação.
    async buscar({ nome = '', numero = '', colecao = '', lingua: l = lingua, pagina = 1, porPagina = 30 } = {}) {
      const num = semZeros(numero), n = nome.trim().toLowerCase();
      if (colecao) {
        const r = await http.buscar(U('/sets/' + encodeURIComponent(colecao), l), { ttl: DIAS7 });
        let lista = (r.dados.cards || []).map(c => ({ ...norm(c, l), colecao: { id: r.dados.id, nome: r.dados.name } }));
        if (n) lista = lista.filter(c => c.nome.toLowerCase().includes(n));
        if (num) lista = lista.filter(c => semZeros(c.numero) === num);
        return { itens: lista.slice((pagina - 1) * porPagina, pagina * porPagina), temMais: lista.length > pagina * porPagina, origem: r.origem };
      }
      if (!n) throw new Error('Digite um nome ou escolha uma coleção.');
      const q = new URLSearchParams({ name: nome.trim(), 'pagination:page': pagina, 'pagination:itemsPerPage': porPagina });
      const r = await http.buscar(U('/cards?' + q, l), { ttl: 864e5 });
      let itens = r.dados.map(c => norm(c, l));
      const temMais = !num && itens.length === porPagina;
      if (num) itens = itens.filter(c => semZeros(c.numero) === num); // com número, a página é grande (250)
      return { itens, temMais, origem: r.origem };
    },

    // Sugestões de nomes enquanto a pessoa digita.
    async nomes({ prefixo = '', colecao = '', lingua: l = lingua } = {}) {
      const p = prefixo.trim().toLowerCase();
      let lista;
      if (colecao) {
        const r = await http.buscar(U('/sets/' + encodeURIComponent(colecao), l), { ttl: DIAS7 });
        lista = (r.dados.cards || []).map(c => c.name);
      } else {
        const q = new URLSearchParams({ name: prefixo.trim(), 'pagination:page': 1, 'pagination:itemsPerPage': 60 });
        const r = await http.buscar(U('/cards?' + q, l), { ttl: 864e5 });
        lista = r.dados.map(c => c.name);
      }
      const vistos = new Set(), out = [];
      for (const nome of lista) {
        const k = (nome || '').toLowerCase();
        if (!k || !k.includes(p) || vistos.has(k)) continue;
        vistos.add(k); out.push(nome);
      }
      const ini = s => s.toLowerCase().startsWith(p) ? 0 : 1;
      return out.sort((a, b) => ini(a) - ini(b) || a.localeCompare(b)).slice(0, 10);
    },

    // Código da carta no TCGdex, ex.: "sv01-001" ou "swsh3-136". Devolve null se o texto não parece um código.
    async porCodigo(codigo, { lingua: l = lingua } = {}) {
      const cod = String(codigo).trim();
      if (!/^[a-z0-9.]*[a-z][a-z0-9.]*-[a-z0-9]+$/i.test(cod)) return null;
      try {
        const r = await http.buscar(U('/cards/' + encodeURIComponent(cod), l), { ttl: DIAS7 });
        const d = r.dados;
        if (!d || !d.id) return { itens: [], temMais: false, origem: r.origem };
        const col = { id: d.set?.id, nome: d.set?.name || '' };
        return { itens: [{ ...norm(d, l), colecao: col, det: { raridade: d.rarity || '', tipos: d.types || [], totalImpresso: d.set?.cardCount?.official ?? null, colecao: col } }], temMais: false, origem: r.origem };
      } catch (e) { if (/^HTTP 404/.test(e.message)) return { itens: [], temMais: false, origem: 'rede' }; throw e; }
    },

    async detalhe(id, l = lingua) {
      const { dados: d } = await http.buscar(U('/cards/' + encodeURIComponent(id), l), { ttl: DIAS7 });
      return { raridade: d.rarity || '', tipos: d.types || [], totalImpresso: d.set?.cardCount?.official ?? null, colecao: { id: d.set?.id, nome: d.set?.name || '' } };
    },
  };
}

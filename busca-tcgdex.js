// Liga o fichário (index.html) ao catálogo. Para usar outra fonte, troque a
// linha registrarFonte(...) por um adaptador novo (veja catalogo.js).
import { criarLimitador, criarHttp } from './infra.js';
import { criarFonteTcgdex } from './tcgdex.js';
import { registrarFonte, buscar, colecoes, fonteAtiva } from './catalogo.js';

// Limites conservadores: ajuste conforme a documentação do TCGdex (tcgdex.dev).
const limitador = criarLimitador({ porMinuto: 30, porDia: 2000, chave: 'tcgdex-uso' });
registrarFonte(criarFonteTcgdex({ http: criarHttp({ limitador }), lingua: 'pt' }));

let SETS = [], res = [], pag = 1;

const TIPOS = [[/fogo|fire/, 'Fogo'], [/[áa]gua|water/, 'Água'], [/planta|grama|grass/, 'Planta'], [/el[ée]tric|raio|lightning/, 'Elétrico'],
  [/ps[íi]quic|psychic/, 'Psíquico'], [/lut|fight/, 'Lutador'], [/sombri|escurid|dark/, 'Sombrio'], [/metal|aço|steel/, 'Metal'],
  [/drag/, 'Dragão'], [/fada|fairy/, 'Fada']];
const tipoDe = ts => { const t = String((ts || [])[0] || '').toLowerCase(); const m = TIPOS.find(([r]) => r.test(t)); return m ? m[1] : ''; };

$('#tbtn').onclick = async () => {
  $('#dt').showModal();
  if (!SETS.length) {
    try {
      SETS = await colecoes();
      $('#tsets').innerHTML = SETS.map(s => `<option value="${esc(s.nome)}">${esc(s.id)}</option>`).join('');
    } catch { $('#tst').textContent = 'Não consegui carregar a lista de coleções agora.'; }
  }
};
$('#tcl').onclick = () => $('#dt').close();
$('#tgo').onclick = () => pesquisar(true);
$('#tmore').onclick = () => { pag++; pesquisar(false); };
['tn', 'tnum', 'tcol'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') pesquisar(true); }));

async function pesquisar(nova) {
  if (nova) { pag = 1; res = []; }
  const nome = $('#tn').value.trim(), numero = $('#tnum').value.trim(), cn = $('#tcol').value.trim().toLowerCase();
  let colecao = '';
  if (cn) {
    const s = SETS.find(x => x.nome.toLowerCase() === cn) || SETS.find(x => x.id.toLowerCase() === cn) || SETS.find(x => x.nome.toLowerCase().includes(cn));
    if (!s) { $('#tst').textContent = 'Coleção não encontrada. Escolha uma da lista.'; return; }
    colecao = s.id;
  }
  $('#tst').textContent = 'Buscando…';
  try {
    const r = await buscar({ nome, numero, colecao, pagina: pag });
    res = res.concat(r.itens);
    $('#tmw').hidden = !r.temMais;
    $('#tst').textContent = `${res.length} carta(s) · ${r.origem === 'rede' ? 'da rede' : 'do cache'} · ${limitador.restante()} requisições restantes hoje`;
    desenhar();
  } catch (e) { $('#tst').textContent = e.message || 'Erro ao buscar. Tente de novo.'; }
}

function desenhar() {
  $('#tg').innerHTML = res.map((c, i) => `<div class="tc">
    ${c.imagem ? `<img src="${esc(c.imagem)}/low.webp" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="ni">sem imagem</div>'}
    <b>${esc(c.nome)}</b><small>nº ${esc(c.numero)}</small>
    <button class="p" data-i="${i}" data-t="1">Tenho ✓</button><button data-i="${i}" data-t="0">Só catálogo</button></div>`).join('');
}
// Imagem que falhar vira o espaço reservado com os dados da carta.
$('#tg').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'ni', textContent: 'sem imagem' })); }, true);
$('#binder').addEventListener('error', e => {
  const sl = e.target.closest && e.target.closest('.slot');
  if (e.target.tagName === 'IMG' && sl) { sl.classList.remove('hi'); e.target.outerHTML = phHTML(set(), +sl.dataset.n); }
}, true);

$('#tg').onclick = async e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const c = res[+b.dataset.i], tenho = b.dataset.t === '1', s = set();
  const n = parseInt(c.numero, 10);
  if (!(n >= 1 && n <= s.total)) { toast(`Número "${c.numero}" fora do fichário (1 a ${s.total}).`); return; }
  b.disabled = true;
  try {
    const d = await fonteAtiva().detalhe(c.id);
    const dados = { name: c.nome, col: d.colecao.nome, type: tipoDe(d.tipos), rare: rareFrom(d.raridade), url: c.imagem };
    if (tenho) s.cards[n] = { ...(s.cards[n] || {}), ...dados };
    else { s.cat = s.cat || {}; s.cat[n] = { name: dados.name, col: dados.col, type: dados.type, rare: dados.rare }; }
    save(); render();
    toast(tenho ? `${c.nome} adicionada ao fichário` : `${c.nome} salva no catálogo`);
  } catch (err) { toast(err.message || 'Não consegui buscar os detalhes agora.'); }
  b.disabled = false;
};

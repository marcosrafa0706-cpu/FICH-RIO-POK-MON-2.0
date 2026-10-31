// Liga o fichário (index.html) ao catálogo. Para usar outra fonte, troque a
// linha registrarFonte(...) por um adaptador novo (veja catalogo.js).
import { criarLimitador, criarHttp } from './infra.js';
import { criarFonteTcgdex } from './tcgdex.js';
import { registrarFonte, buscar, colecoes, nomes, fonteAtiva } from './catalogo.js';

// Limites conservadores: ajuste conforme a documentação do TCGdex (tcgdex.dev).
const limitador = criarLimitador({ porMinuto: 30, porDia: 2000, chave: 'tcgdex-uso' });
registrarFonte(criarFonteTcgdex({ http: criarHttp({ limitador }), lingua: 'pt', linguas: ['pt', 'en'] }));

let SETS = [], res = [], pag = 1, carregando = false, tmr;
const feitas = new Map(); // id da carta -> 't' (tenho) ou 'c' (só catálogo)

const TIPOS = [[/fogo|fire/, 'Fogo'], [/[áa]gua|water/, 'Água'], [/planta|grama|grass/, 'Planta'], [/el[ée]tric|raio|lightning/, 'Elétrico'],
  [/ps[íi]quic|psychic/, 'Psíquico'], [/lut|fight/, 'Lutador'], [/sombri|escurid|dark/, 'Sombrio'], [/metal|aço|steel/, 'Metal'],
  [/drag/, 'Dragão'], [/fada|fairy/, 'Fada']];
const tipoDe = ts => { const t = String((ts || [])[0] || '').toLowerCase(); const m = TIPOS.find(([r]) => r.test(t)); return m ? m[1] : ''; };
const aviso = m => { $('#tst').textContent = m; toast(m); };
const numOk = c => parseInt(c.numero, 10) >= 1;
const colSel = () => {
  const cn = $('#tcol').value.trim().toLowerCase();
  if (!cn) return null;
  return SETS.find(x => x.nome.toLowerCase() === cn) || SETS.find(x => x.id.toLowerCase() === cn) || SETS.find(x => x.nome.toLowerCase().includes(cn)) || null;
};

$('#tbtn').onclick = async () => {
  $('#dt').showModal();
  if (!SETS.length) {
    try {
      SETS = await colecoes();
      $('#tsets').innerHTML = SETS.map(s => `<option value="${esc(s.nome)}">${esc(s.id)}</option>`).join('');
    } catch (e) { $('#tst').textContent = e.message || 'Não consegui carregar a lista de coleções agora.'; }
  }
  // Se o fichário tem uma coleção definida, já deixa preenchida (os números batem com os bolsos).
  const s = set();
  if (!$('#tcol').value && s.colecao) {
    const m = SETS.find(x => x.nome.toLowerCase() === s.colecao.toLowerCase());
    if (m) $('#tcol').value = m.nome;
  }
};
$('#tcl').onclick = () => $('#dt').close();
$('#tgo').onclick = () => { $('#tsug').innerHTML = ''; pesquisar(true); };
$('#tmore').onclick = () => { pag++; pesquisar(false); };
['tn', 'tnum', 'tcol'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { $('#tsug').innerHTML = ''; pesquisar(true); } }));
// Carrega a próxima página sozinho ao chegar no fim da lista.
$('#tg').onscroll = () => {
  const g = $('#tg');
  if (!$('#tmw').hidden && !carregando && g.scrollTop + g.clientHeight >= g.scrollHeight - 80) { pag++; pesquisar(false); }
};

// Sugestões de nomes: aparecem como botões embaixo do campo Nome.
$('#tn').addEventListener('input', () => {
  clearTimeout(tmr);
  const v = $('#tn').value.trim();
  if (v.length < 2) { $('#tsug').innerHTML = ''; return; }
  tmr = setTimeout(() => sugerir(v), 400);
});
async function sugerir(v) {
  const sel = colSel();
  let lista = [];
  try {
    if (sel) lista = await nomes({ prefixo: v, colecao: sel.id, lingua: sel.lingua });
    else {
      lista = await nomes({ prefixo: v, lingua: 'pt' });
      if (lista.length < 4) lista = lista.concat(await nomes({ prefixo: v, lingua: 'en' })); // inglês só se faltar
    }
  } catch { return; }
  if ($('#tn').value.trim() !== v) return; // a pessoa já digitou outra coisa
  const vistos = new Set();
  lista = lista.filter(n => { const k = n.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 8);
  $('#tsug').innerHTML = lista.map(n => `<button type="button" data-n="${esc(n)}">${esc(n)}</button>`).join('');
}
$('#tsug').onclick = e => {
  const b = e.target.closest('[data-n]'); if (!b) return;
  $('#tn').value = b.dataset.n; $('#tsug').innerHTML = ''; pesquisar(true);
};

async function pesquisar(nova) {
  if (carregando) return;
  carregando = true;
  try {
    if (nova) { pag = 1; res = []; $('#tg').scrollTop = 0; }
    const nome = $('#tn').value.trim(), numero = $('#tnum').value.trim(), sel = colSel();
    if ($('#tcol').value.trim() && !sel) { $('#tst').textContent = 'Coleção não encontrada. Escolha uma da lista.'; return; }
    $('#tst').textContent = 'Buscando…';
    const base = { nome, numero, pagina: pag, porPagina: numero && !sel ? 250 : 30 };
    // Sem coleção, busca em português e inglês e junta (a mesma carta tem o mesmo id nos dois).
    const rs = sel
      ? [await buscar({ ...base, colecao: sel.id, lingua: sel.lingua })]
      : await Promise.all(['pt', 'en'].map(l => buscar({ ...base, lingua: l }).catch(erro => ({ itens: [], temMais: false, origem: 'cache', erro }))));
    if (rs.every(r => r.erro)) throw rs[0].erro;
    const vistos = new Set(res.map(c => c.id));
    for (const r of rs) for (const c of r.itens) if (!vistos.has(c.id)) { vistos.add(c.id); res.push(c); }
    $('#tmw').hidden = !rs.some(r => r.temMais);
    const esp = res.filter(c => !numOk(c)).length;
    $('#tst').textContent = `${res.length} carta(s)${$('#tmw').hidden ? '' : ' (role para ver mais)'}`
      + (esp ? ` · ${esp} com número especial (ex.: TG01) não cabem no fichário` : '')
      + ` · ${rs.some(r => r.origem === 'rede') ? 'da rede' : 'do cache'} · ${limitador.restante()} requisições restantes hoje`
      + (sel ? '' : ' · Dica: escolha a coleção para o número da carta bater com o bolso.');
    desenhar();
  } catch (e) { $('#tst').textContent = e.message || 'Erro ao buscar. Tente de novo.'; }
  finally { carregando = false; }
}

function desenhar() {
  $('#tg').innerHTML = res.map((c, i) => {
    const f = feitas.get(c.id), bloq = f || !numOk(c);
    return `<div class="tc">
    ${c.imagem ? `<img src="${esc(c.imagem)}/low.webp" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="ni">sem imagem</div>'}
    <b>${esc(c.nome)}</b><small>nº ${esc(c.numero)}${c.lingua === 'en' ? ' · EN' : ''}</small>
    <button class="p" data-i="${i}" data-t="1" ${bloq ? 'disabled' : ''}>${f === 't' ? '✓ Adicionada' : numOk(c) ? 'Tenho ✓' : 'nº especial'}</button><button data-i="${i}" data-t="0" ${bloq ? 'disabled' : ''}>${f === 'c' ? '✓ No catálogo' : 'Só catálogo'}</button></div>`;
  }).join('');
}
// Imagem que falhar vira o espaço reservado com os dados da carta.
$('#tg').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'ni', textContent: 'sem imagem' })); }, true);
$('#binder').addEventListener('error', e => {
  const sl = e.target.closest && e.target.closest('.slot');
  if (e.target.tagName === 'IMG' && sl) { sl.classList.remove('hi'); e.target.outerHTML = phHTML(set(), +sl.dataset.n); }
}, true);

$('#tg').onclick = async e => {
  const b = e.target.closest('button[data-i]'); if (!b || b.disabled) return;
  const c = res[+b.dataset.i], tenho = b.dataset.t === '1', s = set(), n = parseInt(c.numero, 10);
  if (n > s.total) {
    if (!confirm(`Esta carta é a nº ${n}, mas o fichário "${s.name}" tem ${s.total} cartas. Aumentar o fichário para ${n} cartas?`)) return;
    s.total = n;
  }
  const rotulo = b.textContent;
  b.disabled = true; b.textContent = '…';
  try {
    const d = await fonteAtiva().detalhe(c.id, c.lingua);
    const dados = { name: c.nome, col: d.colecao.nome, type: tipoDe(d.tipos), rare: rareFrom(d.raridade), url: c.imagem };
    if (tenho) s.cards[n] = { ...(s.cards[n] || {}), ...dados };
    else { s.cat = s.cat || {}; s.cat[n] = { name: dados.name, col: dados.col, type: dados.type, rare: dados.rare }; }
    save(); render();
    feitas.set(c.id, tenho ? 't' : 'c');
    b.textContent = tenho ? '✓ Adicionada' : '✓ No catálogo';
    b.parentElement.querySelectorAll('button').forEach(x => { x.disabled = true; });
    aviso(tenho ? `${c.nome} (nº ${n}) adicionada ao fichário.` : `${c.nome} (nº ${n}) salva no catálogo.`);
  } catch (err) {
    b.disabled = false; b.textContent = rotulo;
    aviso('Não consegui buscar os detalhes agora. Tente de novo.');
  }
};

// Liga o fichário (index.html) às fontes de cartas. Para trocar ou acrescentar
// uma fonte, crie um adaptador (formato em catalogo.js) e registre-o aqui.
import { criarLimitador, criarHttp } from './infra.js';
import { criarFonteTcgdex } from './tcgdex.js';
import { criarFonteScryfall } from './scryfall.js';
import { criarFonteLorcast } from './lorcast.js';
import { criarFonteOptcg } from './optcg.js';
import { registrarFonte, usarFonte, buscar, colecoes, nomes, fonteAtiva } from './catalogo.js';

// Limites conservadores por fonte. `intervalo` = espera mínima entre requisições (ms).
// Scryfall: a busca aceita ~2/s e o resto ~10/s; imagens (*.scryfall.io) não têm limite.
const LIM = {
  tcgdex:   { porMinuto: 30, porDia: 2000, intervalo: 0 },
  scryfall: { porMinuto: 60, porDia: 5000, intervalo: 550 },
  lorcast:  { porMinuto: 60, porDia: 3000, intervalo: 200 },
  optcg:    { porMinuto: 20, porDia: 500,  intervalo: 600 },
};
const lim = {};
const http = id => { lim[id] = criarLimitador({ chave: id + '-uso', ...LIM[id] }); return criarHttp({ limitador: lim[id] }); };
registrarFonte(criarFonteTcgdex({ http: http('tcgdex'), lingua: 'pt', linguas: ['pt', 'en'] }));
registrarFonte(criarFonteScryfall({ http: http('scryfall') }));
registrarFonte(criarFonteLorcast({ http: http('lorcast') }));
registrarFonte(criarFonteOptcg({ http: http('optcg') }));

const JOGOS = [
  { id: 'pokemon', nome: 'Pokémon', fonte: 'tcgdex' },
  { id: 'magic', nome: 'Magic: The Gathering', fonte: 'scryfall' },
  { id: 'lorcana', nome: 'Disney Lorcana', fonte: 'lorcast' },
  { id: 'onepiece', nome: 'One Piece', fonte: 'optcg' },
];
$('#tjogo').innerHTML = JOGOS.map(j => `<option value="${j.id}">${j.nome}</option>`).join('');

let SETS = [], res = [], pag = 1, carregando = false, tmr;
const SETS_POR = {};
const feitas = new Map(); // "fonte:id" -> 't' (tenho) ou 'c' (só catálogo)

const TIPOS = [[/fogo|fire/, 'Fogo'], [/[áa]gua|water/, 'Água'], [/planta|grama|grass/, 'Planta'], [/el[ée]tric|raio|lightning/, 'Elétrico'],
  [/ps[íi]quic|psychic/, 'Psíquico'], [/lut|fight/, 'Lutador'], [/sombri|escurid|dark/, 'Sombrio'], [/metal|aço|steel/, 'Metal'],
  [/drag/, 'Dragão'], [/fada|fairy/, 'Fada']];
const tipoDe = ts => { const t = String((ts || [])[0] || '').toLowerCase(); const m = TIPOS.find(([r]) => r.test(t)); return m ? m[1] : ''; };
const aviso = m => { $('#tst').textContent = m; toast(m); };
const numOk = c => parseInt(c.numero, 10) >= 1;
const chave = c => c.fonte + ':' + c.id;
const restante = () => lim[fonteAtiva().id]?.restante() ?? 0;
const colSel = () => {
  const cn = $('#tcol').value.trim().toLowerCase();
  if (!cn) return null;
  return SETS.find(x => x.nome.toLowerCase() === cn) || SETS.find(x => String(x.id).toLowerCase() === cn) || SETS.find(x => x.nome.toLowerCase().includes(cn)) || null;
};

async function carregarColecoes() {
  const id = fonteAtiva().id;
  if (!SETS_POR[id]) {
    $('#tst').textContent = 'Carregando coleções…';
    try { SETS_POR[id] = await colecoes(); }
    catch (e) { SETS = []; $('#tsets').innerHTML = ''; $('#tst').textContent = e.message || 'Não consegui carregar as coleções agora.'; return; }
  }
  SETS = SETS_POR[id];
  $('#tsets').innerHTML = SETS.map(s => `<option value="${esc(s.nome)}">${esc(s.id)}</option>`).join('');
  $('#tst').textContent = '';
}
async function trocarJogo(id, salvar) {
  const j = JOGOS.find(x => x.id === id) || JOGOS[0];
  usarFonte(j.fonte);
  if (salvar) { set().jogo = j.id; save(); }
  $('#tjogo').value = j.id;
  res = []; pag = 1;
  $('#tg').innerHTML = ''; $('#tcol').value = ''; $('#tsug').innerHTML = ''; $('#tmw').hidden = true;
  const a = fonteAtiva().atribuicao;
  $('#tatr').innerHTML = `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.texto)}</a>`;
  await carregarColecoes();
}

$('#tbtn').onclick = async () => {
  $('#dt').showModal();
  await trocarJogo(set().jogo || 'pokemon', false);
  // Se o fichário tem uma coleção definida, já deixa preenchida (os números batem com os bolsos).
  const s = set();
  if (s.colecao) { const m = SETS.find(x => x.nome.toLowerCase() === s.colecao.toLowerCase()); if (m) $('#tcol').value = m.nome; }
};
$('#tjogo').onchange = () => trocarJogo($('#tjogo').value, true);
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
  tmr = setTimeout(() => sugerir(v), 450);
});
async function sugerir(v) {
  const sel = colSel(), ls = fonteAtiva().linguas || [''];
  let lista = [];
  try {
    if (sel) lista = await nomes({ prefixo: v, colecao: sel.id, lingua: sel.lingua });
    else {
      lista = await nomes({ prefixo: v, lingua: ls[0] });
      if (lista.length < 4 && ls.length > 1) lista = lista.concat(await nomes({ prefixo: v, lingua: ls[1] })); // 2º idioma só se faltar
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
    const ls = fonteAtiva().linguas || [''];
    // Pokémon sem coleção: busca em português e inglês e junta (a mesma carta tem o mesmo id nos dois).
    const rs = sel
      ? [await buscar({ ...base, colecao: sel.id, lingua: sel.lingua })]
      : await Promise.all(ls.map(l => buscar({ ...base, lingua: l }).catch(erro => ({ itens: [], temMais: false, origem: 'cache', erro }))));
    if (rs.every(r => r.erro)) throw rs[0].erro;
    const vistos = new Set(res.map(chave));
    for (const r of rs) for (const c of r.itens) if (!vistos.has(chave(c))) { vistos.add(chave(c)); res.push(c); }
    $('#tmw').hidden = !rs.some(r => r.temMais);
    const esp = res.filter(c => !numOk(c)).length;
    $('#tst').textContent = `${res.length} carta(s)${$('#tmw').hidden ? '' : ' (role para ver mais)'}`
      + (esp ? ` · ${esp} com número especial (ex.: TG01) não cabem no fichário` : '')
      + ` · ${rs.some(r => r.origem === 'rede') ? 'da rede' : 'do cache'} · ${restante()} requisições restantes hoje`
      + (sel ? '' : ' · Dica: escolha a coleção para o número da carta bater com o bolso.');
    desenhar();
  } catch (e) { $('#tst').textContent = e.message || 'Erro ao buscar. Tente de novo.'; }
  finally { carregando = false; }
}

function desenhar() {
  $('#tg').innerHTML = res.map((c, i) => {
    const f = feitas.get(chave(c)), bloq = f || !numOk(c);
    return `<div class="tc">
    ${c.imagem ? `<img src="${esc(c.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="ni">sem imagem</div>'}
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
    const d = c.det || await fonteAtiva().detalhe(c.id, c.lingua); // Scryfall/Lorcast/OPTCG já trazem os detalhes na lista
    const dados = { name: c.nome, col: d.colecao.nome, type: tipoDe(d.tipos), rare: rareFrom(d.raridade), url: c.imagem };
    if (tenho) s.cards[n] = { ...(s.cards[n] || {}), ...dados };
    else { s.cat = s.cat || {}; s.cat[n] = { name: dados.name, col: dados.col, type: dados.type, rare: dados.rare }; }
    s.jogo = s.jogo || JOGOS.find(j => j.fonte === c.fonte)?.id;
    save(); render();
    feitas.set(chave(c), tenho ? 't' : 'c');
    b.textContent = tenho ? '✓ Adicionada' : '✓ No catálogo';
    b.parentElement.querySelectorAll('button').forEach(x => { x.disabled = true; });
    aviso(tenho ? `${c.nome} (nº ${n}) adicionada ao fichário.` : `${c.nome} (nº ${n}) salva no catálogo.`);
  } catch (err) {
    b.disabled = false; b.textContent = rotulo;
    aviso('Não consegui buscar os detalhes agora. Tente de novo.');
  }
};

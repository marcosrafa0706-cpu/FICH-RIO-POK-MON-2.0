// Liga o fichário (index.html) às fontes de cartas. Para trocar ou acrescentar
// uma fonte, crie um adaptador (formato em catalogo.js) e registre-o aqui.
import { criarLimitador, criarHttp } from './infra.js?v=9';
import { criarFonteTcgdex } from './tcgdex.js?v=9';
import { criarFonteScryfall } from './scryfall.js?v=9';
import { criarFonteLorcast } from './lorcast.js?v=9';
import { criarFonteOptcg } from './optcg.js?v=9';
import { registrarFonte, usarFonte, buscar, colecoes, nomes, fonteAtiva } from './catalogo.js?v=9';
import { iniciarFoto } from './foto.js?v=9';
import { sim } from './util.js?v=9';

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
  $('#tatr').innerHTML = `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.texto)}</a> · v9`; // número da versão: confirma que os arquivos novos carregaram
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

// "005/225" -> número 005 e total impresso 225 (a mesma numeração que está na carta).
function lerNumero(txt) {
  const m = String(txt).trim().match(/^([^\/\s]+)\s*\/\s*(\d+)$/);
  return m ? { num: m[1], tot: +m[2] } : { num: String(txt).trim(), tot: null };
}
// Junta resultados sem repetir; se a mesma carta vier com e sem foto, fica a que tem foto.
function mesclar(rs) {
  const mapa = new Map(res.map(c => [chave(c), c]));
  for (const r of rs) for (const c of r.itens) {
    const k = chave(c), a = mapa.get(k);
    if (!a) mapa.set(k, c);
    else if (!a.imagem && c.imagem) mapa.set(k, { ...c, nome: a.lingua === 'pt' ? a.nome : c.nome });
  }
  res = [...mapa.values()];
}
const mostrarSemFoto = () => $('#tsf').checked;
const visiveis = () => res.filter(c => mostrarSemFoto() || c.imagem).length;
let auto = 0, rank = false;
// Ordena os resultados pela semelhança com o nome lido na foto (tolera 1 ou 2 letras erradas).
function ranquear(nome) {
  if (res.length < 2) return;
  res.forEach(c => { c.sim = sim(nome, c.nome) + (c.imagem ? .05 : 0); });
  res.sort((a, b) => b.sim - a.sim);
  rank = true; desenhar(); $('#tg').scrollTop = 0;
}

async function pesquisar(nova) {
  if (carregando) return;
  carregando = true;
  let mais = false;
  try {
    if (nova) { pag = 1; res = []; auto = 0; rank = false; $('#tg').scrollTop = 0; }
    const nome = $('#tn').value.trim(), { num, tot } = lerNumero($('#tnum').value), sel = colSel();
    if ($('#tcol').value.trim() && !sel) { $('#tst').textContent = 'Coleção não encontrada. Escolha uma da lista.'; return; }
    $('#tst').textContent = 'Buscando…';
    const base = { nome, numero: num, pagina: pag, porPagina: num && !sel ? 250 : 30 };
    const ls = fonteAtiva().linguas || [''];
    const falha = erro => ({ itens: [], temMais: false, origem: 'cache', erro });
    let rs, nota = '';
    // Pesquisa só pelo código: Nome vazio + código da carta no campo Número (ex.: sv01-001, OP01-001, mkm 123).
    const cod = $('#tnum').value.trim(), fa = fonteAtiva();
    const rc = !nome && !sel && cod && fa.porCodigo ? await Promise.all(ls.map(l => fa.porCodigo(cod, { lingua: l }).catch(falha))) : [];
    if (rc.length && rc.every(r => r !== null)) {
      rs = rc; nota = ` · código ${cod}`;
    } else if (sel) {
      rs = [await buscar({ ...base, colecao: sel.id, lingua: sel.lingua })];
      if (tot && sel.oficial && sel.oficial !== tot) nota = ` · aviso: esta coleção tem ${sel.oficial} cartas impressas, não ${tot}`;
    } else {
      if (!nome && !tot) { $('#tst').textContent = 'Para pesquisar só pelo código, digite o número completo (ex.: 005/225) ou o código da carta (ex.: sv01-001).'; return; }
      const cand = tot ? SETS.filter(s => s.oficial === tot).slice(0, 8) : [];
      if (cand.length) { // número completo: procura só nas coleções com esse total impresso
        rs = await Promise.all(cand.map(s => buscar({ ...base, colecao: s.id, lingua: s.lingua }).catch(falha)));
        nota = ` · procurando em ${cand.length} coleção(ões) com ${tot} cartas`;
      } else {
        rs = await Promise.all(ls.map(l => buscar({ ...base, lingua: l }).catch(falha)));
        if (tot) nota = ` · nenhuma coleção com total ${tot}; usei só o número`;
      }
    }
    if (rs.every(r => r.erro)) throw rs[0].erro;
    mesclar(rs);
    $('#tmw').hidden = !rs.some(r => r.temMais);
    const v = visiveis(), ocultas = res.length - v;
    $('#tst').textContent = `${v} carta(s)${$('#tmw').hidden ? '' : ' (role para ver mais)'}`
      + (ocultas ? ` · ${ocultas} sem foto ocultas` : '') + nota
      + ` · ${rs.some(r => r.origem === 'rede') ? 'da rede' : 'do cache'} · ${restante()} requisições restantes hoje`
      + (sel || tot ? '' : ' · Dica: escolha a coleção ou digite o número completo (ex.: 005/225).');
    desenhar();
    mais = !$('#tmw').hidden && v < 12 && auto < 4; // poucas cartas com foto: busca a próxima página sozinho
  } catch (e) { $('#tst').textContent = e.message || 'Erro ao buscar. Tente de novo.'; }
  finally { carregando = false; }
  if (mais) { auto++; pag++; pesquisar(false); }
}
$('#tsf').onchange = () => desenhar();

function desenhar() {
  $('#tg').innerHTML = res.map((c, i) => ({ c, i })).filter(x => mostrarSemFoto() || x.c.imagem).map(({ c, i }) => `<div class="tc">
    ${c.imagem ? `<img src="${esc(c.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="ni">sem imagem</div>'}
    ${rank && i === 0 && c.sim >= .55 ? '<small style="color:var(--ok)">Mais provável</small>' : ''}<b>${esc(c.nome)}</b><small>nº ${esc(c.numero)}${c.lingua === 'en' ? ' · EN' : ''}</small>${c.fonte === 'tcgdex' || c.fonte === 'optcg' ? `<small style="color:var(--mut)">${esc(c.id)}</small>` : ''}
    <button class="p" data-i="${i}" data-t="1">Tenho ✓</button><button data-i="${i}" data-t="0">Só catálogo</button><button data-i="${i}" data-t="2" aria-label="Adicionar à lista de desejos">♡</button></div>`).join('');
}
// Imagem que falhar vira o espaço reservado com os dados da carta.
$('#tg').addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'ni', textContent: 'sem imagem' })); }, true);
$('#binder').addEventListener('error', e => {
  const sl = e.target.closest && e.target.closest('.slot');
  if (e.target.tagName === 'IMG' && sl) { sl.classList.remove('hi'); e.target.outerHTML = phHTML(set(), +sl.dataset.n); }
}, true);

const livre = s => { for (let i = 1; i <= s.total; i++) if (!s.cards[i]) return i; return s.total + 1; };

function addDesejo(c) {
  S.wish = S.wish || [];
  if (S.wish.some(w => w.chave === chave(c))) { aviso('Já está na lista de desejos.'); return; }
  S.wish.push({ chave: chave(c), nome: c.nome, numero: c.numero, col: c.colecao?.nome || '', url: c.imagem, fonte: c.fonte });
  save(); aviso(`${c.nome} entrou na lista de desejos ♡`);
}
// A carta vai para o slot que VOCÊ escolher (campo "Colocar no slot"); vazio = próximo slot livre.
// O número impresso na carta (ex.: 005/225) fica guardado só como informação.
$('#tg').onclick = async e => {
  const b = e.target.closest('button[data-i]'); if (!b || b.disabled) return;
  const c = res[+b.dataset.i], tenho = b.dataset.t === '1', s = set();
  if (b.dataset.t === '2') { addDesejo(c); return; }
  let n = parseInt($('#tslot').value, 10);
  const manual = n >= 1;
  if (!manual) n = livre(s);
  if (n > s.total && !confirm(`O slot ${n} não existe: o fichário "${s.name}" tem ${s.total} slots. Aumentar para ${n}?`)) return;
  if (tenho && s.cards[n] && !confirm(`O slot ${n} já tem ${s.cards[n].name || 'uma carta'}. Substituir?`)) return;
  const rotulo = b.textContent;
  b.disabled = true; b.textContent = '…';
  try {
    const d = c.det || await fonteAtiva().detalhe(c.id, c.lingua); // Scryfall/Lorcast/OPTCG já trazem os detalhes na lista
    const tot = d.totalImpresso ?? SETS.find(x => String(x.id) === String(d.colecao.id))?.oficial ?? null;
    const dados = { name: c.nome, col: d.colecao.nome, type: tipoDe(d.tipos), rare: rareFrom(d.raridade), url: c.imagem, num: /^\d+$/.test(c.numero) && tot ? c.numero + '/' + tot : c.numero }; // número especial (XY123) não leva total
    if (n > s.total) s.total = n;
    if (tenho) s.cards[n] = dados;
    else { s.cat = s.cat || {}; s.cat[n] = { name: dados.name, col: dados.col, type: dados.type, rare: dados.rare, num: dados.num }; }
    s.jogo = s.jogo || JOGOS.find(j => j.fonte === c.fonte)?.id;
    save(); render();
    if (manual) $('#tslot').value = n + 1; // facilita preencher em sequência
    b.textContent = `✓ Slot ${n}`;
    setTimeout(() => { b.textContent = rotulo; }, 2000);
    aviso(tenho ? `${c.nome} colocada no slot ${n}.` : `${c.nome} salva no catálogo do slot ${n}.`);
  } catch (err) {
    b.textContent = rotulo;
    aviso('Não consegui buscar os detalhes agora. Tente de novo.');
  }
  b.disabled = false;
};

// Identificar carta por foto (botões na busca e no quadro da carta).
iniciarFoto({ pesquisar: () => pesquisar(true), abrirBusca: () => $('#tbtn').onclick(), ranquear });

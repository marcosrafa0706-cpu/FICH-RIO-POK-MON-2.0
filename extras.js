// Recursos extras do fichário (v8): tema, cartas repetidas, lista de desejos, estatísticas,
// compartilhar, backup em arquivo, tutorial, relatório de erros e instalação como aplicativo.
// Usa as funções da tela principal (index.html): S, set(), save(), render(), toast(), esc().

const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} return null; };
const W = () => (S.wish = S.wish || []);
const RAR = ['Sem raridade', '★ Comum/Incomum', '★★ Rara/Holo', '★★★ Ultra/Secreta'];

// ---------- tema (automático, claro, escuro)
const TEMAS = ['', 'light', 'dark'];
function aplicarTema(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  $('#btema').textContent = t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌓';
}
$('#btema').onclick = () => {
  const n = TEMAS[(TEMAS.indexOf(LS('fichario-tema') || '') + 1) % 3];
  LS('fichario-tema', n); aplicarTema(n);
  toast(n === 'light' ? 'Tema claro' : n === 'dark' ? 'Tema escuro' : 'Tema automático (segue o aparelho)');
};
aplicarTema(LS('fichario-tema') || '');

// ---------- cartas repetidas (quantidade)
const render0 = render;
render = function () { render0(); decorar(); };
function decorar() {
  if (document.body.classList.contains('sh')) return;
  const s = set();
  document.querySelectorAll('#binder .slot.have').forEach(el => {
    const c = s.cards[el.dataset.n]; if (!c) return;
    const q = c.qtd || 1;
    if (q > 1) el.insertAdjacentHTML('beforeend', `<span class="qtd">×${q}</span>`);
    if (filt === 'dup') el.classList.toggle('dim', q < 2);
  });
  if (filt === 'dup') document.querySelectorAll('#binder .slot:not(.have)').forEach(el => el.classList.add('dim'));
}
const openCard0 = openCard;
openCard = function (n) { openCard0(n); $('#dcq').value = (set().cards[n] || {}).qtd || 1; };
const dcy0 = $('#dcy').onclick;
$('#dcy').onclick = () => {
  const n = cur, antes = set().cards[n];
  dcy0();
  const c = set().cards[n];
  if (c) { // o salvar original não conhece estes campos: mantém o número impresso e grava a quantidade
    if (antes && antes.num) c.num = antes.num;
    c.qtd = Math.max(1, Math.min(999, +$('#dcq').value || 1));
    save(); render();
  }
};

// ---------- lista de desejos
function abrirDesejos() {
  const l = W();
  $('#dwl').innerHTML = l.length ? l.map((w, i) => `<div class="wi">${w.url ? `<img src="${esc(w.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="wp"></div>'}
    <div class="wt"><b>${esc(w.nome)}</b><small>nº ${esc(w.numero || '?')}${w.col ? ' · ' + esc(w.col) : ''}</small></div>
    <button data-b="${i}" aria-label="Procurar esta carta">🔎</button><button data-x="${i}" aria-label="Remover">✕</button></div>`).join('')
    : '<p class="mut">Nada por aqui ainda. Na busca de cartas, toque em ♡ para guardar as cartas que você quer ter.</p>';
  $('#dw').showModal();
}
$('#bdes').onclick = abrirDesejos;
$('#dwx').onclick = () => $('#dw').close();
$('#dwl').onclick = async e => {
  const x = e.target.closest('[data-x]'), b = e.target.closest('[data-b]');
  if (x) { W().splice(+x.dataset.x, 1); save(); abrirDesejos(); return; }
  if (b) {
    if (document.body.classList.contains('sh')) { toast('Abra um fichário primeiro para procurar.'); return; }
    const w = W()[+b.dataset.b];
    $('#dw').close(); await $('#tbtn').onclick();
    $('#tn').value = w.nome; $('#tnum').value = ''; $('#tcol').value = ''; $('#tgo').click();
  }
};
const copiar = async (txt, ok) => { try { await navigator.clipboard.writeText(txt); toast(ok); } catch { toast('Não consegui copiar. Selecione o texto manualmente.'); } };
$('#dwc').onclick = () => copiar(W().map(w => `• ${w.nome}${w.numero ? ' — nº ' + w.numero : ''}${w.col ? ' — ' + w.col : ''}`).join('\n') || 'Lista vazia', 'Lista copiada');

// ---------- estatísticas
function resumo() {
  let uni = 0, tot = 0, rep = 0; const raros = [0, 0, 0, 0], tipos = {}, cols = {};
  const binders = S.sets.map(s => {
    const ks = Object.keys(s.cards).filter(k => +k <= s.total);
    for (const k of ks) {
      const c = s.cards[k], q = c.qtd || 1;
      uni++; tot += q; if (q > 1) rep += q - 1; raros[c.rare || 0]++;
      if (c.type) tipos[c.type] = (tipos[c.type] || 0) + 1;
      const col = c.col || s.colecao || s.name; cols[col] = (cols[col] || 0) + 1;
    }
    const miss = []; for (let i = 1; i <= s.total; i++) if (!s.cards[i]) miss.push(i);
    const dups = ks.filter(k => (s.cards[k].qtd || 1) > 1).map(k => `${k}(×${s.cards[k].qtd})`);
    return { nome: s.name, tem: ks.length, total: s.total, miss, dups };
  });
  return { uni, tot, rep, raros, tipos, cols, binders };
}
const barra = (rot, n, max) => `<div class="sb"><span>${esc(rot)}</span><div class="sbar"><i style="width:${max ? Math.round(n / max * 100) : 0}%"></i></div><small>${n}</small></div>`;
function abrirStats() {
  const r = resumo(), pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const maxR = Math.max(1, ...r.raros), tp = Object.entries(r.tipos).sort((a, b) => b[1] - a[1]), maxT = tp[0] ? tp[0][1] : 1;
  const cs = Object.entries(r.cols).sort((a, b) => b[1] - a[1]).slice(0, 8), maxC = cs[0] ? cs[0][1] : 1;
  $('#stb').innerHTML = `
    <div class="sg"><div><b>${S.sets.length}</b><small>fichários</small></div><div><b>${r.uni}</b><small>cartas diferentes</small></div><div><b>${r.tot}</b><small>com repetidas</small></div><div><b>${W().length}</b><small>desejos</small></div></div>
    <h4>Progresso por fichário</h4>
    ${r.binders.map(b => `<div class="sb"><span>${esc(b.nome)}</span><div class="sbar"><i style="width:${pct(b.tem, b.total)}%"></i></div><small>${b.tem}/${b.total} · ${pct(b.tem, b.total)}%</small></div>`).join('') || '<p class="mut">Nenhum fichário ainda.</p>'}
    <h4>Por raridade</h4>${r.raros.map((n, i) => barra(RAR[i], n, maxR)).join('')}
    ${tp.length ? '<h4>Por tipo/cor</h4>' + tp.map(([t, n]) => barra(t, n, maxT)).join('') : ''}
    ${cs.length ? '<h4>Por coleção</h4>' + cs.map(([t, n]) => barra(t, n, maxC)).join('') : ''}`;
  $('#dst').showModal();
}
$('#bst').onclick = abrirStats;
$('#stcl').onclick = () => $('#dst').close();
// Compartilhar: só gera um texto; nada sai do aparelho até você escolher para quem enviar.
$('#stsh').onclick = async () => {
  const r = resumo(), partes = ['📒 Meu fichário de cartas'];
  for (const b of r.binders) {
    partes.push(`\n${b.nome}: ${b.tem}/${b.total}`);
    if (b.miss.length && b.miss.length <= 60) partes.push('Faltam: ' + b.miss.join(', '));
    if (b.dups.length) partes.push('Repetidas: ' + b.dups.join(', '));
  }
  if (W().length) partes.push('\nDesejos: ' + W().map(w => w.nome).join(', '));
  const texto = partes.join('\n');
  try { if (navigator.share) { await navigator.share({ title: 'Meu fichário', text: texto }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  copiar(texto, 'Resumo copiado');
};

// ---------- backup em arquivo, relatório de erros
function atualizarDados() {
  const sh = document.body.classList.contains('sh');
  ['#faltam', 'label[for="faltam"]', '#del'].forEach(q => { const e = $(q); if (e) e.hidden = sh; });
  const u = (S.meta || {}).ultimoBackup;
  $('#ultbk').textContent = u ? `Último backup em arquivo: ${new Date(u).toLocaleString('pt-BR')}` : 'Você ainda não baixou um backup em arquivo.';
  let l = []; try { l = JSON.parse(LS('fichario-erros') || '[]'); } catch {}
  $('#erros').value = l.length ? l.map(x => `${x.t} ${x.m}`).join('\n') : 'Nenhum erro registrado.';
}
const data0 = $('#data').onclick;
$('#data').onclick = () => { data0(); atualizarDados(); };
$('#bkf').onclick = () => {
  S.meta = { ...(S.meta || {}), ultimoBackup: new Date().toISOString() }; save();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = `fichario-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  atualizarDados(); toast('Backup baixado. Guarde o arquivo em um lugar seguro.');
};
$('#rkf').onclick = () => $('#rkfi').click();
$('#rkfi').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    let d = JSON.parse(await f.text());
    if (d && !d.sets && typeof d.total === 'number') d = { cur: 0, sets: [d] };
    if (!d || !Array.isArray(d.sets) || !d.sets.length) throw 0;
    if (!confirm('Substituir tudo o que está neste aparelho pelo conteúdo do arquivo?')) return;
    S = norm(d); S.cur = 0; view = 'shelf'; save(); $('#dd').close(); render(); toast('Backup restaurado');
  } catch { toast('Arquivo de backup inválido'); }
};
$('#cerr').onclick = () => copiar($('#erros').value, 'Relatório copiado');
$('#lerr').onclick = () => { LS('fichario-erros', '[]'); atualizarDados(); };

// ---------- tutorial
const PASSOS = [
  ['📒 Crie seu fichário', 'Na estante, toque em “+ Fichário” e escolha nome, quantidade de cartas e cor da capa. Você pode ter quantos fichários quiser, um para cada coleção ou jogo.'],
  ['🔎 Encontre as cartas', 'Dentro do fichário, toque em “Buscar cartas”. Procure por nome, número (005/225) ou código (XY123), ou tire uma foto da carta para identificá-la.'],
  ['📍 Escolha o slot', 'Antes de tocar em “Tenho ✓”, digite o número do slot onde a carta vai ficar. Vazio = próximo slot livre. Toque num bolso para editar a carta, a quantidade ou pôr a sua foto.'],
  ['♡ Desejos, repetidas e progresso', 'O ♡ guarda as cartas que você quer. Em cada carta você marca quantas tem. O 📊 mostra seu progresso por fichário, raridade e coleção.'],
  ['💾 Proteja suas cartas', 'Seus dados ficam neste aparelho. Em ⚙️ baixe um backup em arquivo de vez em quando e guarde em um lugar seguro. Instale o site na tela inicial para usar como aplicativo.'],
];
let passo = 0;
function mostrarPasso() {
  $('#tuti').textContent = PASSOS[passo][0]; $('#tutx').textContent = PASSOS[passo][1];
  $('#tutd').textContent = PASSOS.map((_, i) => i === passo ? '●' : '○').join(' ');
  $('#tutp').hidden = passo === 0; $('#tutn').textContent = passo === PASSOS.length - 1 ? 'Começar' : 'Próximo';
}
function abrirTutorial() { passo = 0; mostrarPasso(); $('#dtut').showModal(); }
const fimTutorial = () => { LS('fichario-tutorial', '1'); $('#dtut').close(); };
$('#bajuda').onclick = abrirTutorial;
$('#tutp').onclick = () => { passo = Math.max(0, passo - 1); mostrarPasso(); };
$('#tutn').onclick = () => { if (passo >= PASSOS.length - 1) fimTutorial(); else { passo++; mostrarPasso(); } };
$('#tuts').onclick = fimTutorial;

// ---------- início: lembrete de backup, tutorial na primeira visita, instalação como app
setTimeout(() => {
  if (!LS('fichario-tutorial')) { abrirTutorial(); return; }
  const tem = S.sets.some(s => Object.keys(s.cards).length), u = (S.meta || {}).ultimoBackup;
  if (tem && (!u || Date.now() - new Date(u) > 14 * 864e5) && !sessionStorage.getItem('lembrou'))
    { sessionStorage.setItem('lembrou', '1'); toast('Dica: baixe um backup em ⚙️ para não perder suas cartas.'); }
}, 2500);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();

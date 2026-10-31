// Identifica uma carta pela foto e procura no catálogo (TCGdex, Scryfall...).
// A leitura do texto (OCR) roda no próprio navegador com o Tesseract.js: a foto
// não é enviada a nenhum servidor. Só o leitor e o dicionário são baixados na 1ª vez.
const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let lib, worker, pesquisar, abrirBusca, destino = null;

const carregarLib = () => lib ??= new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = CDN;
  s.onload = () => ok(window.Tesseract);
  s.onerror = () => { lib = null; no(new Error('Não consegui baixar o leitor de texto. Verifique a internet e tente de novo.')); };
  document.head.appendChild(s);
});
const leitor = async () => worker ??= await (await carregarLib()).createWorker('eng');

// Recorta uma faixa da foto (frações de 0 a 1), amplia e aumenta o contraste.
function faixa(c, x, y, w, h) {
  const W = 1400, sw = c.width * w, sh = c.height * h, H = Math.max(1, Math.round(W * sh / sw));
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(c, c.width * x, c.height * y, sw, sh, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((.299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]) - 128) * 1.6 + 128));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  return o;
}
async function texto(w, c, lista) {
  try { await w.setParameters({ tessedit_char_whitelist: lista, tessedit_pageseg_mode: '6' }); } catch {}
  const { data } = await w.recognize(c);
  return data.text || '';
}
// "005/225" -> número e total; "XY123" -> só o código especial.
function lerNumeroTxt(t) {
  t = t.toUpperCase().replace(/\s+/g, ' ');
  let m = t.match(/([A-Z]{0,6}\d{1,4}[A-Z]?)\s*\/\s*(\d{2,4})/);
  if (m) return { num: m[1], tot: m[2] };
  m = t.match(/\b([A-Z]{1,6}\d{1,4})\b/);
  return m ? { num: m[1], tot: '' } : null;
}
const RUIDO = /^(BASIC|BASICO|BÁSICO|STAGE|FASE|HP|PS|TRAINER|TREINADOR|ITEM|SUPPORTER|APOIADOR|POKEMON|POKÉMON|EVOLVES|EVOLUI|FROM|DE)$/i;
function lerNome(t) {
  for (const linha of t.split('\n')) {
    const p = linha.replace(/[^A-Za-zÀ-ÿ'’\-. ]/g, ' ').split(/\s+/).filter(x => x.length > 1 && !RUIDO.test(x));
    if (p.join('').length >= 3) return p.slice(0, 3).join(' ');
  }
  return '';
}
const doDataUrl = u => new Promise((ok, no) => {
  const im = new Image();
  im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); ok(c); };
  im.onerror = no; im.src = u;
});

async function processar(canvas, slot) {
  const st = m => { $('#tst').textContent = m; };
  if (!$('#dt').open) await abrirBusca();
  if (slot) $('#tslot').value = slot;
  st('📷 Lendo a carta… na primeira vez o leitor leva uns 15 segundos para baixar.');
  try {
    const w = await leitor();
    const num = lerNumeroTxt(await texto(w, faixa(canvas, .02, .88, .96, .11), '0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ '));
    const nome = lerNome(await texto(w, faixa(canvas, .03, .02, .74, .12), ''));
    $('#tsug').innerHTML = '';
    if (!num && !nome) { st('Não consegui ler a carta. Tire a foto de frente, só com a carta ocupando a tela e com boa luz, ou digite o nome ou o número.'); return; }
    const numTxt = num ? (num.tot ? `${num.num}/${num.tot}` : num.num) : '';
    if (num) { $('#tnum').value = numTxt; $('#tn').value = ''; } else { $('#tn').value = nome; $('#tnum').value = ''; }
    st(`Li ${num ? 'o número ' + numTxt : 'o nome "' + nome + '"'}${num && nome ? ` (nome: "${nome}")` : ''}. Procurando…`);
    await pesquisar();
    // Se o número não achou nada, tenta pelo nome lido.
    if (num && nome && !$('#tg').querySelector('.tc')) { $('#tn').value = nome; $('#tnum').value = ''; await pesquisar(); }
  } catch (e) { st(e.message || 'Erro ao ler a carta. Tente de novo.'); }
}

export function iniciarFoto(cfg) {
  pesquisar = cfg.pesquisar; abrirBusca = cfg.abrirBusca;
  $('#tfoto').onclick = () => { destino = null; $('#tff').click(); };
  $('#tff').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const { c } = await prep(f); await processar(c, destino); }
    catch { toast('Não consegui abrir esta imagem.'); }
  };
  // No quadro da carta: "Achar no catálogo" usa a foto que você já pôs; sem foto, pede uma.
  $('#dcf').onclick = async () => {
    const slot = cur;
    $('#dc').close();
    if (img) { try { await processar(await doDataUrl(img), slot); } catch { toast('Não consegui abrir esta imagem.'); } }
    else { destino = slot; $('#tff').click(); }
  };
}

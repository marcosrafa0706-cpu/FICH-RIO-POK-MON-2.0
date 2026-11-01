// Identifica uma carta pela foto e procura no catálogo (TCGdex, Scryfall...).
// A leitura do texto (OCR) roda no próprio navegador com o Tesseract.js: a foto
// não é enviada a nenhum servidor. Só o leitor e o dicionário são baixados na 1ª vez.
//
// Como a leitura fica mais precisa (v7):
//  - endireita fotos deitadas e tenta 4 orientações se não achar nada;
//  - tenta a carta ocupando a foto toda e também com margem em volta;
//  - lê o número em 4 faixas (rodapé inteiro, canto esquerdo, canto direito, mais alto),
//    com texto escuro e claro, binarização local (Otsu) e votação entre as leituras;
//  - corrige confusões comuns (O→0, I→1, S→5, B→8) e valida o formato 005/225 ou XY123;
//  - se o nome vier errado, tenta variações e ordena os resultados por semelhança de nome.
import { lerNumeroTxt, lerNome, variantes } from './util.js?v=9';
const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let lib, worker, pesquisar, abrirBusca, ranquear, destino = null, rodadas = 0;

const carregarLib = () => lib ??= new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = CDN;
  s.onload = () => ok(window.Tesseract);
  s.onerror = () => { lib = null; no(new Error('Não consegui baixar o leitor de texto. Verifique a internet e tente de novo.')); };
  document.head.appendChild(s);
});
const leitor = async () => worker ??= await (await carregarLib()).createWorker('eng');

// ---------- imagem
function girar(c, graus) {
  const q = graus % 180 !== 0, o = document.createElement('canvas');
  o.width = q ? c.height : c.width; o.height = q ? c.width : c.height;
  const g = o.getContext('2d'); g.translate(o.width / 2, o.height / 2); g.rotate(graus * Math.PI / 180);
  g.drawImage(c, -c.width / 2, -c.height / 2);
  return o;
}
// Binarização de Otsu por blocos (aguenta brilho e degradê da carta).
function binarizar(o, inv) {
  const g = o.getContext('2d'), W = o.width, H = o.height, d = g.getImageData(0, 0, W, H), p = d.data, gr = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) gr[j] = (.299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]) | 0;
  const B = Math.max(1, Math.round(W / 5));
  for (let x0 = 0; x0 < W; x0 += B) {
    const x1 = Math.min(W, x0 + B), h = new Uint32Array(256); let n = 0;
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { h[gr[y * W + x]]++; n++; }
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
    let sb = 0, wb = 0, mx = -1, t = 128;
    for (let i = 0; i < 256; i++) {
      wb += h[i]; if (!wb) continue;
      const wf = n - wb; if (!wf) break;
      sb += i * h[i];
      const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) * (mb - mf);
      if (v > mx) { mx = v; t = i; }
    }
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) {
      const k = y * W + x, v = gr[k] > t ? 255 : 0, q = k * 4;
      p[q] = p[q + 1] = p[q + 2] = inv ? 255 - v : v;
    }
  }
  g.putImageData(d, 0, 0);
  return o;
}
function faixa(c, [x, y, w, h], inv) {
  const W = 1400, sw = c.width * w, sh = c.height * h, H = Math.max(1, Math.round(W * sh / sw));
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(c, c.width * x, c.height * y, sw, sh, 0, 0, W, H);
  return binarizar(o, inv);
}
const sub = (r, i) => [i + r[0] * (1 - 2 * i), i + r[1] * (1 - 2 * i), r[2] * (1 - 2 * i), r[3] * (1 - 2 * i)];

// ---------- leitura de texto
async function ocr(w, c, reg, inv, lista) {
  if (++rodadas > 28) throw Object.assign(new Error('limite'), { codigo: 'LIMITE' });
  const f = faixa(c, reg, inv);
  try { await w.setParameters({ tessedit_char_whitelist: lista, tessedit_pageseg_mode: '7' }); } catch {}
  const { data } = await w.recognize(f);
  return { texto: data.text || '', conf: data.confidence || 0 };
}
const REG_NUM = [[.02, .885, .96, .105], [.02, .90, .46, .09], [.52, .90, .46, .09], [.02, .86, .96, .10]];
const REG_NOME = [[.03, .02, .74, .12], [.03, .045, .62, .095]];
const LNUM = '0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ|';

async function tentar(w, c, inset) {
  const votos = new Map();
  for (const reg of REG_NUM) {
    for (const inv of [false, true]) {
      const r = await ocr(w, c, sub(reg, inset), inv, LNUM), n = lerNumeroTxt(r.texto);
      if (n) { const k = n.num + '/' + n.tot, v = votos.get(k) || { ...n, pts: 0, n: 0 }; v.pts += r.conf + (n.tot ? 25 : 0); v.n++; votos.set(k, v); }
      if ([...votos.values()].some(v => v.n >= 2)) break;
    }
    if ([...votos.values()].some(v => v.n >= 2 || (v.tot && v.pts >= 110))) break;
  }
  const top = [...votos.values()].sort((a, b) => b.pts - a.pts)[0];
  let nome = '', nc = 0;
  for (const reg of REG_NOME) {
    for (const inv of [false, true]) {
      const r = await ocr(w, c, sub(reg, inset), inv, ''), nm = lerNome(r.texto);
      if (nm && r.conf > nc) { nome = nm; nc = r.conf; }
      if (nc >= 75) break;
    }
    if (nc >= 75) break;
  }
  return { num: top?.num || '', tot: top?.tot || '', nome, conf: Math.max(top ? top.pts / top.n : 0, nc) };
}
async function lerCarta(w, c, st) {
  rodadas = 0;
  const ordem = c.width > c.height * 1.15 ? [90, 270, 0, 180] : [0, 180, 90, 270];
  let melhor = null;
  try {
    for (const rot of ordem) {
      const base = rot ? girar(c, rot) : c;
      for (const inset of [0, .05]) {
        st(`Lendo a carta… (tentativa ${rodadas ? Math.ceil(rodadas / 6) : 1})`);
        const r = await tentar(w, base, inset);
        if (r.num) return r;                    // o número é o dado mais confiável
        if (r.nome && (!melhor || r.conf > melhor.conf)) melhor = r;
      }
      if (melhor && melhor.conf >= 70) break;   // nome bem lido: não gira mais
    }
  } catch (e) { if (e.codigo !== 'LIMITE') throw e; }
  return melhor || { num: '', tot: '', nome: '' };
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
  st('Preparando o leitor… na primeira vez leva uns 15 segundos para baixar.');
  try {
    const w = await leitor();
    const { num, tot, nome } = await lerCarta(w, canvas, st);
    $('#tsug').innerHTML = '';
    if (!num && !nome) { st('Não consegui ler a carta. Tire a foto de frente, só com a carta ocupando a tela, bem iluminada e sem reflexo, ou digite o nome ou o número.'); return; }
    const numTxt = num ? (tot ? `${num}/${tot}` : num) : '';
    if (num) { $('#tnum').value = numTxt; $('#tn').value = ''; } else { $('#tn').value = nome; $('#tnum').value = ''; }
    st(`Li ${num ? 'o número ' + numTxt : 'o nome "' + nome + '"'}${num && nome ? ` (nome: "${nome}")` : ''}. Procurando…`);
    await pesquisar();
    const vazio = () => !$('#tg').querySelector('.tc');
    // Nada achado: tenta o nome (inteiro, primeira palavra, prefixo) para tolerar letras erradas.
    if (vazio() && nome) {
      $('#tnum').value = '';
      for (const termo of variantes(nome)) { $('#tn').value = termo; await pesquisar(); if (!vazio()) break; }
    }
    if (nome && ranquear) ranquear(nome); // deixa no topo a carta de nome mais parecido
  } catch (e) { st(e.message || 'Erro ao ler a carta. Tente de novo.'); }
}

export function iniciarFoto(cfg) {
  pesquisar = cfg.pesquisar; abrirBusca = cfg.abrirBusca; ranquear = cfg.ranquear;
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

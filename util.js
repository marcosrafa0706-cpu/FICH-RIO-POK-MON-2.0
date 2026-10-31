// Funções puras (sem tela): leitura de números e nomes de cartas, semelhança de textos.
// Ficam num arquivo próprio para poderem ser testadas automaticamente (veja tests/).

const DIG = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', S: '5', B: '8', Z: '2' };
export const fixDig = s => s.replace(/[OQDIL|SBZ]/g, c => DIG[c]);

// "005/225" -> { num:'005', tot:'225' }; "XY123" (código especial) -> { num:'XY123', tot:'' }; senão null.
export function lerNumeroTxt(t) {
  t = String(t).toUpperCase().replace(/[^A-Z0-9\/| ]/g, ' ').replace(/\s+/g, ' ');
  for (const x of t.matchAll(/([A-Z0-9|]{1,7})\s*\/\s*([A-Z0-9|]{2,4})/g)) {
    if (!/^[0-9OQDIL|SBZ]{2,4}$/.test(x[2])) continue;
    const pre = x[1].match(/^([A-Z]{0,6}?)([0-9OQDIL|SBZ]{1,4})$/);
    if (!pre) continue;
    const num = pre[1] + fixDig(pre[2]);
    if (/\d/.test(num)) return { num, tot: fixDig(x[2]) };
  }
  const m = t.match(/\b(XY|SM|SWSH|SVP|SV|TG|GG|BW|DP|HGSS|NP|PR|RC|SMP|BWP|DPP)\s?([0-9OIL]{1,4})\b/);
  return m ? { num: m[1] + fixDig(m[2]), tot: '' } : null;
}

const RUIDO = /^(BASIC|BASICO|BÁSICO|STAGE|FASE|HP|PS|TRAINER|TREINADOR|ITEM|SUPPORTER|APOIADOR|POKEMON|POKÉMON|EVOLVES|EVOLUI|FROM|DE)$/i;
export function lerNome(t) {
  for (const linha of String(t).split('\n')) {
    const p = linha.replace(/[^A-Za-zÀ-ÿ'’\-. ]/g, ' ').split(/\s+/).filter(x => x.length > 1 && !RUIDO.test(x));
    if (p.join('').length >= 3) return p.slice(0, 3).join(' ');
  }
  return '';
}

// Variações do nome para tentar de novo quando a leitura tem letras erradas.
export const variantes = n => { const p = n.split(' '); return [...new Set([n, p[0], p[0].slice(0, 5), p[0].slice(0, 4)])].filter(x => x.length >= 3); };

// Texto sem acento, minúsculo e só letras/números (para comparar nomes).
export const limpo = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 0 a 1: quanto dois nomes se parecem (0,9 se um contém o outro).
export const sim = (a, b) => { a = limpo(a); b = limpo(b); if (!a || !b) return 0; if (a.includes(b) || b.includes(a)) return .9; return 1 - lev(a, b) / Math.max(a.length, b.length); };

// Raridade em texto (qualquer idioma/fonte) -> 0 a 3. Mesma regra usada na tela.
export function rareFrom(v) {
  if (typeof v === 'number') return v >= 1 && v <= 3 ? v : 0;
  const t = String(v || '').toLowerCase();
  if (/ultra|secret|completa|full|legendary|enchanted|mythic|m[ií]tic|lend[aá]ri|encantad|special|especial/.test(t)) return 3;
  if (/rara|rare|holo/.test(t)) return 2;
  if (/comum|common/.test(t)) return 1;
  return +t >= 1 && +t <= 3 ? +t : 0;
}

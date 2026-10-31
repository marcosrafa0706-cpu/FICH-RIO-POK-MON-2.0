// Infraestrutura independente da fonte de dados: cache (IndexedDB + TTL),
// limitador de requisições (por minuto e por dia) e http com retry/backoff.

const DB = 'catalogo-cache', ST = 'r';
let dbp;
const abrir = () => dbp ??= new Promise(r => {
  try {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(ST);
    q.onsuccess = () => r(q.result);
    q.onerror = () => r(null);
  } catch { r(null); }
});
const mem = new Map(); // plano B se o IndexedDB não estiver disponível
const fresco = e => e && Date.now() - e.t < e.ttl;

export const cache = {
  async get(k) {
    const db = await abrir();
    if (!db) return mem.get(k) ?? null;
    return new Promise(r => {
      const q = db.transaction(ST).objectStore(ST).get(k);
      q.onsuccess = () => r(q.result ?? null);
      q.onerror = () => r(null);
    });
  },
  async set(k, v, ttl) {
    const e = { v, t: Date.now(), ttl };
    const db = await abrir();
    if (!db) { mem.set(k, e); return; }
    db.transaction(ST, 'readwrite').objectStore(ST).put(e, k);
  },
  async limpar() {
    mem.clear();
    const db = await abrir();
    if (db) db.transaction(ST, 'readwrite').objectStore(ST).clear();
  },
};

// Use valores abaixo do limite oficial (margem de segurança).
// `intervalo` = espera mínima (ms) entre requisições (ex.: Scryfall pede 50–100 ms; a busca dele, 500 ms).
export function criarLimitador({ porMinuto = 25, porDia = 900, chave = 'catalogo-uso', intervalo = 0 } = {}) {
  const janela = [];
  let ultimo = 0;
  const hoje = () => new Date().toISOString().slice(0, 10);
  const ler = () => {
    try { const u = JSON.parse(localStorage.getItem(chave)); if (u && u.dia === hoje()) return u; } catch {}
    return { dia: hoje(), n: 0 };
  };
  const gravar = u => { try { localStorage.setItem(chave, JSON.stringify(u)); } catch {} };
  return {
    restante: () => Math.max(0, porDia - ler().n),
    async aguardar() {
      if (ler().n >= porDia)
        throw Object.assign(new Error('Limite diário de requisições atingido. Tente amanhã ou use uma chave de API.'), { codigo: 'LIMITE_DIARIO' });
      for (;;) {
        const agora = Date.now();
        while (janela.length && agora - janela[0] >= 60000) janela.shift();
        if (janela.length < porMinuto) break;
        await new Promise(r => setTimeout(r, 60000 - (agora - janela[0]) + 50));
      }
      const alvo = Math.max(Date.now(), ultimo + intervalo); ultimo = alvo; // reserva o horário na fila
      janela.push(alvo);
      const u = ler(); u.n++; gravar(u);
      if (alvo > Date.now()) await new Promise(r => setTimeout(r, alvo - Date.now()));
    },
  };
}

export function criarHttp({ limitador, ttlPadrao = 24 * 3600e3, tentativas = 3 } = {}) {
  const voo = new Map(); // junta pedidos idênticos simultâneos em uma só requisição
  async function buscar(url, { headers = {}, ttl = ttlPadrao } = {}) {
    const e = await cache.get(url);
    if (fresco(e)) return { dados: e.v, origem: 'cache' };
    if (voo.has(url)) return voo.get(url);
    const p = (async () => {
      let ultimo;
      for (let i = 0; i < tentativas; i++) {
        try {
          await limitador.aguardar();
          const r = await fetch(url, { headers });
          if (r.status === 429 || r.status >= 500) {
            ultimo = new Error('HTTP ' + r.status);
            const ra = +r.headers.get('Retry-After');
            const espera = (ra ? ra * 1000 : Math.min(30000, (r.status === 429 ? 5000 : 1000) * 2 ** i)) + Math.random() * 500;
            await new Promise(s => setTimeout(s, espera));
            continue;
          }
          if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { codigo: 'FATAL' });
          const dados = await r.json();
          await cache.set(url, dados, ttl);
          return { dados, origem: 'rede' };
        } catch (err) {
          if (err.codigo === 'LIMITE_DIARIO' || err.codigo === 'FATAL') throw err;
          ultimo = err;
        }
      }
      if (e) return { dados: e.v, origem: 'cache-antigo' }; // melhor dado antigo do que nenhum
      throw ultimo;
    })().finally(() => voo.delete(url));
    voo.set(url, p);
    return p;
  }
  return { buscar };
}

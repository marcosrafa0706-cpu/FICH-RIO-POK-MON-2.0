// Registro de fontes de dados. Para trocar de fonte, crie outro arquivo que
// devolva um objeto com este formato e registre-o (veja busca-tcgdex.js):
//
//   {
//     id, nome,
//     atribuicao: { texto, url },
//     colecoes(): Promise<[{ id, nome, total }]>,
//     buscar({ nome, numero, colecao, pagina, porPagina }):
//         Promise<{ itens:[Carta], temMais, origem }>,
//     detalhe(id, lingua): Promise<{ raridade, tipos, colecao:{id,nome} }>,
//     nomes({ prefixo, colecao, lingua })?: Promise<[string]>   (opcional)
//   }
//   Carta = { id, nome, numero, imagem, colecao?, fonte }
//   `imagem` é a URL base devolvida pela própria fonte (nada é baixado ou copiado).

const fontes = new Map();
let ativa = null;

export function registrarFonte(f) {
  for (const m of ['colecoes', 'buscar', 'detalhe'])
    if (typeof f[m] !== 'function') throw new Error(`Fonte "${f.id}" precisa implementar ${m}()`);
  fontes.set(f.id, f);
  ativa ??= f.id;
}
export function usarFonte(id) {
  if (!fontes.has(id)) throw new Error('Fonte desconhecida: ' + id);
  ativa = id;
}
export const fonteAtiva = () => fontes.get(ativa);
export const listarFontes = () => [...fontes.values()].map(f => ({ id: f.id, nome: f.nome }));
export const buscar = filtro => fonteAtiva().buscar(filtro);
export const colecoes = () => fonteAtiva().colecoes();
// Opcional: fontes sem sugestão de nomes simplesmente devolvem lista vazia.
export const nomes = a => (fonteAtiva().nomes ? fonteAtiva().nomes(a) : Promise.resolve([]));

import test from 'node:test';
import assert from 'node:assert/strict';
import { lerNumeroTxt, lerNome, variantes, sim, rareFrom } from '../util.js';

test('lê número com total impresso', () => {
  assert.deepEqual(lerNumeroTxt('005/225'), { num: '005', tot: '225' });
  assert.deepEqual(lerNumeroTxt(' 25 / 165 MEW'), { num: '25', tot: '165' });
});
test('corrige letras confundidas com dígitos', () => {
  assert.deepEqual(lerNumeroTxt('OO5/225'), { num: '005', tot: '225' });
  assert.deepEqual(lerNumeroTxt('1O2/I65'), { num: '102', tot: '165' });
});
test('lê códigos especiais', () => {
  // total impresso com letras (SM214, TG30): vale só o código da carta
  assert.deepEqual(lerNumeroTxt('SM05/SM214'), { num: 'SM05', tot: '' });
  assert.deepEqual(lerNumeroTxt('XY123'), { num: 'XY123', tot: '' });
  assert.deepEqual(lerNumeroTxt('SWSH001'), { num: 'SWSH001', tot: '' });
  assert.deepEqual(lerNumeroTxt('TG01/TG30'), { num: 'TG01', tot: '' });
});
test('texto sem número devolve null', () => {
  assert.equal(lerNumeroTxt('POKEMON ILLUSTRATOR'), null);
  assert.equal(lerNumeroTxt(''), null);
});
test('lê o nome ignorando ruído', () => {
  assert.equal(lerNome('BASIC Pikachu HP 60'), 'Pikachu');
  assert.equal(lerNome('\n\nCharizard ex\n'), 'Charizard ex');
  assert.equal(lerNome('12 34'), '');
});
test('variantes do nome', () => {
  assert.deepEqual(variantes('Charizard ex'), ['Charizard ex', 'Charizard', 'Chari', 'Char']);
});
test('semelhança tolera letras erradas', () => {
  assert.ok(sim('Charizrd', 'Charizard') >= .8);
  assert.ok(sim('Pikachu', 'Pikachu ex') >= .9);
  assert.ok(sim('Pikachu', 'Bulbasaur') < .4);
  assert.equal(sim('', 'x'), 0);
});
test('raridade em vários idiomas', () => {
  assert.equal(rareFrom('Common'), 1);
  assert.equal(rareFrom('Uncommon'), 1);
  assert.equal(rareFrom('Rare Holo'), 2);
  assert.equal(rareFrom('Ultra Rare'), 3);
  assert.equal(rareFrom('Enchanted'), 3);
  assert.equal(rareFrom('mythic'), 3);
  assert.equal(rareFrom(''), 0);
});

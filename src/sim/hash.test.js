import { suite, test, assert, assertEqual } from '../../tools/test/runner.js';
import { hashState, hashHex } from './hash.js';

suite('hash');

test('identical state hashes equal', () => {
  assertEqual(hashState({ a: 1, b: [2, 3] }), hashState({ a: 1, b: [2, 3] }));
  assertEqual(hashState({}), hashState({}));                 // empty objects hash equal
  assert(hashState({}) !== hashState([]), 'empty {} and [] must differ');
});

test('key order does not matter', () => {
  assertEqual(hashState({ a: 1, b: 2, c: 3 }), hashState({ c: 3, b: 2, a: 1 }));
});

test('nested key order does not matter', () => {
  assertEqual(
    hashState({ outer: { x: 1, y: 2 }, list: [{ p: 1, q: 2 }] }),
    hashState({ list: [{ q: 2, p: 1 }], outer: { y: 2, x: 1 } }),
  );
});

test('a changed value changes the hash', () => {
  assert(hashState({ a: 1 }) !== hashState({ a: 2 }), 'value change should alter hash');
});

test('array order is significant', () => {
  assert(hashState([1, 2, 3]) !== hashState([3, 2, 1]), 'array order matters');
});

test('distinguishes types', () => {
  assert(hashState({ a: 1 }) !== hashState({ a: '1' }), 'number vs string');
  assert(hashState({ a: true }) !== hashState({ a: 1 }), 'bool vs number');
  assert(hashState({ a: null }) !== hashState({ a: 0 }), 'null vs zero');
});

test('hashHex is 8 lowercase hex chars', () => {
  const h = hashHex({ a: 1, b: 2 });
  assert(/^[0-9a-f]{8}$/.test(h), 'bad hex: ' + h);
});

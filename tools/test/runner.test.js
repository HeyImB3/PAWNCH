import { suite, test, assert, assertEqual, assertDeepEqual, assertThrows } from './runner.js';

suite('runner');

test('assert passes on truthy', () => { assert(true); });
test('assertEqual passes on equal', () => { assertEqual(2 + 2, 4); });
test('assertEqual reports on unequal', () => {
  assertThrows(() => assertEqual(1, 2));
});
test('assertDeepEqual passes on matching objects', () => {
  assertDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 });
});
test('assertThrows passes when fn throws', () => {
  assertThrows(() => { throw new Error('x'); });
});

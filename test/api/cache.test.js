import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedCache } from '../../dados/src/funcs/api/cache.js';

test('BoundedCache respeita TTL', () => {
    let now = 0;
    const cache = new BoundedCache({ ttlMs: 100, now: () => now });

    cache.set('a', { value: 1 });
    assert.deepEqual(cache.get('a'), { value: 1 });

    now = 99;
    assert.deepEqual(cache.get('a'), { value: 1 });

    now = 100;
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.getStats().misses, 1);
});

test('BoundedCache limita quantidade de entradas', () => {
    const cache = new BoundedCache({ maxEntries: 2, maxBytes: 1024 });

    cache.set('a', 'a');
    cache.set('b', 'b');
    cache.set('c', 'c');

    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 'b');
    assert.equal(cache.get('c'), 'c');
    assert.ok(cache.getStats().evictions >= 1);
});

test('BoundedCache limita bytes e ignora item grande', () => {
    const cache = new BoundedCache({
        maxEntries: 10,
        maxBytes: 90,
        maxItemBytes: 80
    });

    assert.equal(cache.set('a', 'a'.repeat(40)), true);
    assert.equal(cache.set('b', 'b'.repeat(40)), true);
    assert.equal(cache.set('c', 'c'.repeat(40)), true);
    assert.equal(cache.size, 2);
    assert.equal(cache.set('big', 'x'.repeat(81)), false);
    assert.equal(cache.get('big'), undefined);
});

test('BoundedCache calcula buffers aninhados', () => {
    const cache = new BoundedCache({
        maxEntries: 10,
        maxBytes: 1024,
        maxItemBytes: 80
    });

    assert.equal(cache.set('image', { buffer: Buffer.alloc(20) }), false);
    assert.equal(cache.get('image'), undefined);
});

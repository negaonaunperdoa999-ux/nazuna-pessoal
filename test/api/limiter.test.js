import test from 'node:test';
import assert from 'node:assert/strict';
import { ConcurrencyLimiter } from '../../dados/src/funcs/api/limiter.js';

function makeTask(state) {
    return () => new Promise((resolve) => {
        state.active++;
        state.peak = Math.max(state.peak, state.active);
        setTimeout(() => {
            state.active--;
            resolve(state.active);
        }, 10);
    });
}

test('ConcurrencyLimiter respeita o máximo e drena a fila', async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 1 });
    const state = { active: 0, peak: 0 };

    const first = limiter.run(makeTask(state));
    const second = limiter.run(makeTask(state));
    const third = limiter.run(makeTask(state));

    await assert.rejects(
        limiter.run(makeTask(state)),
        (error) => error.code === 'OVERLOADED'
    );

    await Promise.all([first, second, third]);
    assert.equal(state.peak, 2);
    assert.equal(limiter.getStats().active, 0);
    assert.equal(limiter.getStats().queued, 0);
});

test('ConcurrencyLimiter rejeita task inválida', async () => {
    const limiter = new ConcurrencyLimiter();
    await assert.rejects(limiter.run('não é função'), TypeError);
});

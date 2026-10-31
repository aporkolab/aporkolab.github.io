import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, start, tick, hit, assist, pause, resume } from '../dist/engine.js';

function playing(options) {
  const game = createGame(options);
  start(game);
  return game;
}

function expose(game, index, type = 'bug', expires = game.elapsed + 3) {
  game.slots[index] = { id: 1000 + game.hits + index, type, born: game.elapsed, expires };
}

function chargeAssist(game) {
  game.slots.fill(null);
  for (let i = 0; i < 6; i += 1) {
    expose(game, i);
    hit(game, i);
  }
}

test('starting is instantly playable, deterministic and idempotent', () => {
  const game = createGame({ seed: 41 });
  assert.equal(game.status, 'ready');
  assert.equal(game.slots.length, 9);
  assert.ok(game.slots.every(slot => slot === null));
  start(game);
  assert.equal(game.status, 'playing');
  assert.equal(game.slots.filter(Boolean).length, 1);
  assert.equal(game.slots.find(Boolean).type, 'bug');
  const before = structuredClone(game);
  start(game);
  assert.deepEqual(game, before);
  assert.deepEqual(game, playing({ seed: 41 }));
});

test('same seed and actions produce the same game; different seeds change targets', () => {
  const run = seed => {
    const game = playing({ seed });
    for (let second = 0; second < 30; second += 1) {
      tick(game, 0.5);
      const target = game.slots.findIndex(slot => slot && slot.type !== 'bot');
      if (target !== -1) hit(game, target);
      tick(game, 0.5);
    }
    return game;
  };
  assert.deepEqual(run(19), run(19));
  assert.notDeepEqual(run(19).events, run(20).events);
  assert.deepEqual(JSON.parse(JSON.stringify(run(19))), run(19));
});

test('normal and chill runs finish at their exact durations with bounded ordered events', () => {
  for (const [mode, duration] of [['normal', 45], ['chill', 60]]) {
    const game = playing({ mode, seed: 7 });
    tick(game, duration - 0.01);
    assert.equal(game.status, 'playing');
    assert.ok(game.remaining > 0);
    tick(game, 10000);
    assert.equal(game.status, 'over');
    assert.equal(game.elapsed, duration);
    assert.equal(game.remaining, 0);
    assert.ok(game.slots.every(slot => slot === null));
    assert.ok(game.events.length <= 80);
    assert.equal(game.events.at(-1).type, 'over');
    assert.equal(game.events.filter(event => event.type === 'over').length, 1);
    for (let i = 1; i < game.events.length; i += 1) {
      assert.ok(game.events[i].id > game.events[i - 1].id);
      assert.ok(game.events[i].time >= game.events[i - 1].time);
    }
  }
});

test('large and small ticks process the same chronological spawn and expiration sequence', () => {
  const large = playing({ seed: 1337 });
  const small = playing({ seed: 1337 });
  tick(large, 30);
  for (let i = 0; i < 3000; i += 1) tick(small, 0.01);
  assert.deepEqual(small, large);
});

test('a target scores once; repeat clicking an empty hole is penalized', () => {
  const game = playing();
  const index = game.slots.findIndex(Boolean);
  const successful = hit(game, index);
  assert.equal(successful.type, 'hit');
  assert.equal(successful.points, 10);
  assert.equal(game.score, 10);
  assert.equal(game.hits, 1);
  const repeated = hit(game, index);
  assert.equal(repeated.type, 'empty');
  assert.equal(game.score, 5);
  assert.equal(game.hits, 1);
  assert.equal(game.misses, 1);
  assert.equal(game.combo, 0);
  for (let i = 0; i < 20; i += 1) hit(game, index);
  assert.equal(game.score, 0);
});

test('friendly bots cost 20, reset the combo and do not grant charge', () => {
  const game = playing();
  chargeAssist(game);
  expose(game, 0, 'bot');
  const before = game.score;
  const event = hit(game, 0);
  assert.equal(event.type, 'bot-hit');
  assert.equal(event.points, -20);
  assert.equal(game.score, before - 20);
  assert.equal(game.botHits, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.multiplier, 1);
  assert.equal(game.charge, 6);
  assert.equal(game.slots[0], null);
});

test('combo multipliers grow at five-hit steps, cap at five, and reward bonuses', () => {
  const game = playing();
  game.slots.fill(null);
  for (let i = 1; i <= 25; i += 1) {
    expose(game, 0);
    const event = hit(game, 0);
    assert.equal(event.points, 10 * Math.min(5, 1 + Math.floor(i / 5)));
  }
  assert.equal(game.multiplier, 5);
  assert.equal(game.combo, 25);
  assert.equal(game.bestCombo, 25);
  assert.equal(game.charge, 6);
  expose(game, 0, 'bonus');
  assert.equal(hit(game, 0).points, 125);
  hit(game, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.multiplier, 1);
  assert.equal(game.bestCombo, 26);
});

test('expired bugs reset combo without score penalties; untouched bots are safe', () => {
  const game = playing();
  chargeAssist(game);
  const before = game.score;
  expose(game, 0, 'bug', 0.2);
  expose(game, 1, 'bot', 0.1);
  tick(game, 0.1);
  assert.equal(game.botHits, 0);
  assert.equal(game.misses, 0);
  assert.equal(game.combo, 6);
  tick(game, 0.1);
  assert.equal(game.misses, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.score, before);
  assert.equal(game.slots[0], null);
  assert.equal(game.slots[1], null);
});

test('paused/background games consume no time and accept no hits or assists', () => {
  const game = playing();
  chargeAssist(game);
  expose(game, 0);
  tick(game, 0.15);
  pause(game);
  const before = structuredClone(game);
  tick(game, 1000);
  assert.equal(hit(game, 0), null);
  assert.deepEqual(assist(game), { used: false, hits: [] });
  assert.deepEqual(game, before);
  resume(game);
  assert.equal(game.status, 'playing');
  tick(game, 0.1);
  assert.equal(game.elapsed, 0.25);
  assert.equal(hit(game, 0).type, 'hit');
});

test('assist requires charge and exposed targets, clears bugs/bonuses, and preserves bots', () => {
  const game = playing();
  assert.deepEqual(assist(game), { used: false, hits: [] });
  chargeAssist(game);
  assert.equal(game.charge, 6);
  expose(game, 2, 'bot');
  const before = structuredClone(game);
  assert.deepEqual(assist(game), { used: false, hits: [] });
  assert.deepEqual(game, before);
  expose(game, 0, 'bug');
  expose(game, 1, 'bonus');
  const outcome = assist(game);
  assert.equal(outcome.used, true);
  assert.equal(outcome.hits.length, 2);
  assert.ok(outcome.hits.every(event => event.type === 'hit' && event.assisted));
  assert.equal(game.charge, 0);
  assert.equal(game.assistUsed, 1);
  assert.equal(game.hits, 8);
  assert.equal(game.botHits, 0);
  assert.equal(game.slots[0], null);
  assert.equal(game.slots[1], null);
  assert.equal(game.slots[2].type, 'bot');
  assert.deepEqual(game.events.slice(-3).map(event => event.type), ['assist', 'hit', 'hit']);
  assert.deepEqual(assist(game), { used: false, hits: [] });
});

test('finished games cannot be restarted or scored by delayed inputs', () => {
  const game = playing();
  chargeAssist(game);
  tick(game, game.duration);
  const before = structuredClone(game);
  assert.equal(hit(game, 0), null);
  assert.equal(assist(game).used, false);
  pause(game);
  resume(game);
  start(game);
  tick(game, 10);
  assert.deepEqual(game, before);
});

test('invalid times, seeds, modes and hole indices cannot corrupt state', () => {
  assert.throws(() => createGame({ seed: NaN }), TypeError);
  assert.throws(() => createGame({ seed: Infinity }), TypeError);
  assert.throws(() => createGame({ mode: 'unknown' }), RangeError);
  const game = playing();
  const before = structuredClone(game);
  for (const dt of [NaN, Infinity, -1, 0]) tick(game, dt);
  for (const index of [NaN, Infinity, -1, 9, 0.5, '0', undefined]) assert.equal(hit(game, index), null);
  assert.deepEqual(game, before);
});

test('unknown slot occupants are inert and keep the combo intact', () => {
  const game = playing({ seed: 9 });
  game.slots.fill(null);
  expose(game, 0);
  hit(game, 0);
  game.slots[1] = { id: 999, type: 'mystery', born: game.elapsed, expires: game.elapsed + 3 };
  const before = { score: game.score, combo: game.combo, misses: game.misses, events: game.events.length };
  assert.equal(hit(game, 1), null);
  assert.deepEqual({ score: game.score, combo: game.combo, misses: game.misses, events: game.events.length }, before);
  assert.equal(game.slots[1].type, 'mystery');
});

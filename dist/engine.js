/** Whack-a-Bug: deterministic, browser-local arcade simulation. No model calls. */
const MODES = {
  normal: { duration: 45, firstInterval: 0.8, lastInterval: 0.4, firstTTL: 1.6, lastTTL: 0.9 },
  chill: { duration: 60, firstInterval: 1.05, lastInterval: 0.7, firstTTL: 2.2, lastTTL: 2.2 },
};
const TYPES = new Set(['bug', 'bonus', 'bot']);
const EPSILON = 1e-8;
const round = value => Math.round(value * 1e9) / 1e9;
const isTarget = occupant => occupant && (occupant.type === 'bug' || occupant.type === 'bonus');

export function createGame({ seed = 1337, mode = 'normal' } = {}) {
  if (!Object.hasOwn(MODES, mode)) throw new RangeError(`Unknown game mode: ${mode}`);
  if (!Number.isFinite(seed)) throw new TypeError('Seed must be a finite number.');
  const normalizedSeed = Math.trunc(seed) >>> 0;
  return {
    status: 'ready',
    mode,
    elapsed: 0,
    duration: MODES[mode].duration,
    remaining: MODES[mode].duration,
    score: 0,
    combo: 0,
    bestCombo: 0,
    multiplier: 1,
    hits: 0,
    botHits: 0,
    misses: 0,
    charge: 0,
    assistUsed: 0,
    slots: Array(9).fill(null),
    events: [],
    seed: normalizedSeed,
    _random: normalizedSeed,
    _nextTargetId: 1,
    _nextEventId: 1,
    _nextSpawn: MODES[mode].firstInterval,
  };
}

function random(game) {
  game._random = (game._random + 0x6d2b79f5) >>> 0;
  let value = Math.imul(game._random ^ (game._random >>> 15), game._random | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function emit(game, type, fields = {}) {
  const event = { id: game._nextEventId++, type, time: game.elapsed, ...fields };
  game.events.push(event);
  if (game.events.length > 80) game.events.splice(0, game.events.length - 80);
  return event;
}

function resetCombo(game) {
  game.combo = 0;
  game.multiplier = 1;
}

function spawn(game, forcedType) {
  const vacant = game.slots.flatMap((occupant, index) => occupant ? [] : [index]);
  if (!vacant.length) return;
  const index = vacant[Math.floor(random(game) * vacant.length)];
  const roll = forcedType ? 0 : random(game);
  const type = forcedType ?? (roll < 0.7 ? 'bug' : roll < 0.8 ? 'bonus' : 'bot');
  const config = MODES[game.mode];
  const fraction = game.elapsed / game.duration;
  const ttl = config.firstTTL + (config.lastTTL - config.firstTTL) * fraction;
  const target = { id: game._nextTargetId++, type, born: game.elapsed, expires: round(game.elapsed + ttl) };
  game.slots[index] = target;
  emit(game, 'spawn', { slot: index, targetType: type, targetId: target.id });
}

export function start(game) {
  if (game.status !== 'ready') return game;
  game.status = 'playing';
  spawn(game, 'bug');
  return game;
}

function expire(game) {
  game.slots.forEach((occupant, index) => {
    if (!occupant || occupant.expires > game.elapsed + EPSILON) return;
    game.slots[index] = null;
    // Letting a friendly bot leave is correct play, so it is not a miss.
    if (isTarget(occupant)) {
      game.misses += 1;
      resetCombo(game);
      emit(game, 'miss', { slot: index, targetType: occupant.type, targetId: occupant.id, points: 0, combo: 0, text: 'Bug escaped.' });
    }
  });
}

function finish(game) {
  game.status = 'over';
  game.elapsed = game.duration;
  game.remaining = 0;
  game.slots.fill(null);
  emit(game, 'over', { score: game.score, text: 'Time up.' });
}

/** Advance seconds in chronological order, including expirations between frames. */
export function tick(game, dt) {
  if (game.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
  const targetTime = round(Math.min(game.duration, game.elapsed + dt));
  while (game.elapsed < targetTime - EPSILON && game.status === 'playing') {
    const expiration = Math.min(...game.slots.filter(Boolean).map(occupant => occupant.expires), Infinity);
    const nextTime = Math.min(targetTime, game._nextSpawn, expiration, game.duration);
    game.elapsed = round(Math.max(game.elapsed, nextTime));
    game.remaining = round(Math.max(0, game.duration - game.elapsed));
    // Expire old targets before spawning at the same timestamp.
    expire(game);
    if (game.elapsed >= game.duration - EPSILON) {
      finish(game);
      break;
    }
    if (game._nextSpawn <= game.elapsed + EPSILON) {
      spawn(game);
      const config = MODES[game.mode];
      const interval = config.firstInterval + (config.lastInterval - config.firstInterval) * game.elapsed / game.duration;
      game._nextSpawn = round(game.elapsed + interval);
    }
  }
  return game;
}

function successfulHit(game, index, assisted) {
  const target = game.slots[index];
  game.slots[index] = null;
  game.combo += 1;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.multiplier = Math.min(5, 1 + Math.floor(game.combo / 5));
  const points = (target.type === 'bonus' ? 25 : 10) * game.multiplier;
  game.score += points;
  game.hits += 1;
  if (!assisted) game.charge = Math.min(6, game.charge + 1);
  return emit(game, 'hit', { slot: index, targetType: target.type, targetId: target.id, points, combo: game.combo, assisted, text: target.type === 'bonus' ? 'Bonus squashed.' : 'Bug squashed.' });
}

/** A valid click returns an event. Paused/finished runs and invalid slots are inert. */
export function hit(game, index) {
  if (game.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= game.slots.length) return null;
  const target = game.slots[index];
  if (isTarget(target)) return successfulHit(game, index, false);
  // Unknown occupants are inert: they must not break the combo either.
  if (target && !TYPES.has(target.type)) return null;
  resetCombo(game);
  if (target?.type === 'bot') {
    game.slots[index] = null;
    game.botHits += 1;
    game.score = Math.max(0, game.score - 20);
    return emit(game, 'bot-hit', { slot: index, targetType: 'bot', targetId: target.id, points: -20, combo: 0, text: 'Friendly bot! −20' });
  }
  game.misses += 1;
  game.score = Math.max(0, game.score - 5);
  return emit(game, 'empty', { slot: index, points: -5, combo: 0, text: 'Empty slot. −5' });
}

/** Clear exposed bugs and bonuses, leaving friendly bots untouched. */
export function assist(game) {
  const targets = game.slots.flatMap((occupant, index) => isTarget(occupant) ? [index] : []);
  if (game.status !== 'playing' || game.charge < 6 || !targets.length) return { used: false, hits: [] };
  game.charge = 0;
  game.assistUsed += 1;
  emit(game, 'assist', { text: `Assist cleared ${targets.length} target${targets.length === 1 ? '' : 's'}.` });
  return { used: true, hits: targets.map(index => successfulHit(game, index, true)) };
}

export function pause(game) {
  if (game.status === 'playing') game.status = 'paused';
  return game;
}

export function resume(game) {
  if (game.status === 'paused') game.status = 'playing';
  return game;
}

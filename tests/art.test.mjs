import test from 'node:test';
import assert from 'node:assert/strict';
import { character, mallet, star } from '../dist/art.js';

const decorative = markup => {
  assert.match(markup, /^<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
  // Many copies render at once, so the artwork must not declare document-wide IDs.
  assert.doesNotMatch(markup, /\bid="/);
};

test('every character and mood renders decorative, ID-free SVG', () => {
  for (const type of ['bug', 'bonus', 'bot']) {
    for (const mood of ['normal', 'hit']) decorative(character(type, mood));
  }
  decorative(mallet());
  decorative(star());
});

test('bugs, bonus bugs and bots are visually distinct, and hits change the face', () => {
  const bug = character('bug');
  const bonus = character('bonus');
  const bot = character('bot');
  assert.notEqual(bug, bonus);
  assert.match(bot, /bot-svg/);
  assert.doesNotMatch(bug, /bot-svg/);
  assert.notEqual(character('bug', 'hit'), bug);
  assert.match(character('bot', 'hit'), /is-hit/);
  assert.equal(character(), bug);
});

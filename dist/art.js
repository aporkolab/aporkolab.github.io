// Original little residents of the keyboard. Everything is a small, animatable
// vector: no fonts, external images, SVG IDs, or shared clip-path state.
const INK = '#373044';
const svg = (body, extra = '') => `<svg class="creature-svg ${extra}" viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

function bugEyes(hit) {
  if (hit) return `<g class="eyes"><path d="m51 74 12 8-12 8m58-16-12 8 12 8"/><path d="M68 108c6 9 18 9 24 0" fill="#373044"/><path d="M77 113c1-7 10-7 11 0v4c0 7-11 7-11 0Z" fill="#F793A8" stroke-width="3"/></g>`;
  return `<g class="eyes"><ellipse cx="59" cy="80" rx="15" ry="20" fill="#FFFDF8"/><ellipse cx="101" cy="80" rx="15" ry="20" fill="#FFFDF8"/><ellipse cx="63" cy="83" rx="6" ry="10" fill="#373044" stroke="none"/><ellipse cx="97" cy="83" rx="6" ry="10" fill="#373044" stroke="none"/><circle cx="65" cy="79" r="2.5" fill="#FFFDF8" stroke="none"/><circle cx="99" cy="79" r="2.5" fill="#FFFDF8" stroke="none"/><path d="M68 105q12 14 24 0"/><path d="M77 108v7q3 3 6 0v-7" fill="#FFFDF8" stroke-width="3"/></g>`;
}

function bug(bonus, hit) {
  const shell = bonus ? '#B297E7' : '#F78987';
  const deep = bonus ? '#8F72CA' : '#E36A76';
  const belly = bonus ? '#E2D3FF' : '#FFD5BC';
  const shine = bonus ? '#D8C6FB' : '#FFB6A4';
  return svg(`
    <g class="feet" fill="${deep}"><path d="M49 134c-10 4-17 15-12 21 6 7 24 4 30-7l2-10Z"/><path d="M111 134c10 4 17 15 12 21-6 7-24 4-30-7l-2-10Z"/></g>
    <g class="antenna"><path d="M61 51C61 33 53 26 43 23M99 51c0-18 8-25 18-28"/><circle cx="40" cy="21" r="7" fill="${shell}"/><circle cx="120" cy="21" r="7" fill="${shell}"/><path d="M38 19h1m79 0h1" stroke="${shine}" stroke-width="3"/></g>
    <g class="arms" fill="${shell}"><path class="arm arm-left" d="M41 91c-10-3-22 3-21 12 0 6 8 9 18 5"/><path class="arm arm-right" d="M119 91c10-3 22 3 21 12 0 6-8 9-18 5"/></g>
    <path d="M29 102c0-33 20-58 51-58s51 25 51 58c0 32-19 48-51 48s-51-16-51-48Z" fill="${shell}"/>
    <path d="M38 76c3-12 10-19 19-22" stroke="${shine}" stroke-width="7"/>
    <path d="M43 112c0-13 17-20 37-20s37 7 37 20c0 21-15 32-37 32s-37-11-37-32Z" fill="${belly}" stroke="none"/>
    <ellipse cx="41" cy="101" rx="8" ry="5" fill="${deep}" stroke="none"/><ellipse cx="119" cy="101" rx="8" ry="5" fill="${deep}" stroke="none"/>
    ${bugEyes(hit)}
    <path d="M75 132q5 3 10 0" stroke="${bonus ? '#B599DE' : '#EEAE9D'}" stroke-width="3"/>
    ${bonus ? `<g class="crown"><path d="m61 42-5-21 16 9 8-18 8 18 16-9-5 21q-19-5-38 0Z" fill="#F8C3E5" stroke-width="3.5"/><circle cx="80" cy="32" r="3" fill="#FFF8F3" stroke="none"/></g><path d="m118 89 2 5 5 1-4 3 1 5-4-3-5 2 2-5-3-4 5 1Z" fill="#FBE6F5" stroke="none"/>` : ''}
  `, `${bonus ? 'bonus-svg' : 'bug-svg'}${hit ? ' is-hit' : ''}`);
}

function bot(hit) {
  return svg(`
    <g class="feet" fill="#71B9AD"><path d="M52 135v17c0 8 24 8 24 0v-17Z"/><path d="M85 135v17c0 8 24 8 24 0v-17Z"/></g>
    <g class="arms" fill="#B7E8D1"><path class="arm arm-left" d="m42 106-14 12c-7 6-14-1-9-8l14-19Z"/><path class="arm arm-right" d="m118 105 12-11c7-6 15 1 10 8l-11 15Z"/></g>
    <path d="M46 96h68l6 36c2 12-13 18-40 18s-42-6-40-18Z" fill="#A3DDC5"/>
    <path d="M53 120v13" stroke="#DDF4DF" stroke-width="6"/>
    <g class="antenna"><path d="M80 44V24"/><circle cx="80" cy="18" r="8" fill="#F69FAB"/><circle cx="78" cy="15" r="2.5" fill="#FFE4E6" stroke="none"/></g>
    <path d="M31 62h-6c-5 0-8 4-8 10v9c0 6 3 10 8 10h6m98-29h6c5 0 8 4 8 10v9c0 6-3 10-8 10h-6" fill="#71B9AD"/>
    <rect x="28" y="39" width="104" height="73" rx="24" fill="#B7E8D1"/>
    <path d="M38 59c2-7 8-11 15-11h15" stroke="#ECF9E9" stroke-width="6"/>
    <rect x="40" y="56" width="80" height="43" rx="15" fill="#F4FCF0" stroke-width="3.5"/>
    <g class="eyes">${hit ? `<path d="m53 70 10 7-10 7m54-14-10 7 10 7" stroke-width="3.5"/><path d="M75 89q5-6 10 0" stroke-width="3"/>` : `<path d="M59 69v10m42-10v10" stroke-width="7"/><path d="M73 84q7 8 14 0" stroke-width="3.5"/>`}<ellipse cx="50" cy="85" rx="5" ry="3" fill="#F4ABAE" stroke="none"/><ellipse cx="110" cy="85" rx="5" ry="3" fill="#F4ABAE" stroke="none"/></g>
    <path d="M80 123c-8-11-20 1 0 13 20-12 8-24 0-13Z" fill="#F18E9B" stroke-width="3"/>
    <path d="M110 124v9" stroke="#71B9AD" stroke-width="3"/>
  `, `bot-svg${hit ? ' is-hit' : ''}`);
}

export function character(type = 'bug', mood = 'normal') {
  return type === 'bot' ? bot(mood === 'hit') : bug(type === 'bonus', mood === 'hit');
}

export function mallet() {
  return `<svg class="mallet-svg" viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g transform="rotate(-30 60 70)" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"><path d="M50 56h20l-2 65c0 11-16 11-16 0Z" fill="#D6B8E8"/><path d="m59 68-1 45" stroke="#EAD8F6" stroke-width="5"/><rect x="16" y="23" width="88" height="40" rx="13" fill="#FFDFD1"/><path d="M37 25v36m46-36v36" stroke="#ECAAA2" stroke-width="3"/><path d="M23 33v19m74-19v19" stroke="#F68E94" stroke-width="10"/><path d="M47 33h24" stroke="#FFF8EE" stroke-width="6"/></g></svg>`;
}

export function star() {
  return `<svg class="spark-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#F8B9CD" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

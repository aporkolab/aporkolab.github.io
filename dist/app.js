import { createGame, start, tick, hit, assist, pause, resume } from './engine.js';
import { character, mallet, star } from './art.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const keyMap = ['q','w','e','a','s','d','z','x','c'];
const board = $('#game-board');
// Read on use so a changed OS setting applies without a reload.
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = () => reducedMotionQuery.matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clock = () => performance.now();
let game = createGame();
let lastFrame = 0;
let lastEvent = 0;
let soundOn = false;
let audioContext;
let resultShown = false;
let messageUntil = 0;
let resumeAfterHelp = false;
let isOnBoard = false;
let best = loadBest();
const visible = Array(9).fill(null);
const holds = Array(9).fill(0);
const cleanupTimers = new Set();

function later(callback, delay) {
  const id = setTimeout(() => { cleanupTimers.delete(id); callback(); },delay);
  cleanupTimers.add(id);
  return id;
}
function loadBest() {
  try { return Math.max(0,Number(localStorage.getItem(`whack-a-bug:best:${game.mode}`)) || 0); }
  catch { return 0; }
}
function randomSeed() {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch { return Date.now() >>> 0; }
}
function setText(selector,text) { const element = $(selector); if (element.textContent !== String(text)) element.textContent = text; }
function announce(text) { $('#announcer').textContent = text; }
function message(text, duration = 1800) { setText('#message',text); messageUntil = clock() + duration; }

function playSound(kind = 'hit') {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const notes = { hit:[380 + Math.min(game.combo,20)*18,130,.095,'sine'], bonus:[870,1250,.15,'sine'], bad:[160,65,.18,'triangle'], empty:[110,80,.055,'triangle'], buddy:[400,1100,.35,'sine'], start:[400,770,.2,'triangle'], end:[600,280,.4,'sine'] };
    const [first,last,duration,type] = notes[kind] || notes.hit;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(first,audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(last,audioContext.currentTime+duration);
    gain.gain.setValueAtTime(.09,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime+duration);
  } catch { soundOn=false; updateSound(); }
}
function updateSound() {
  const icon = soundOn ? '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 3q5 4 0 8m3-11q8 7 0 14"/>' : '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>';
  $('#sound svg').innerHTML = icon;
  $('#sound').setAttribute('aria-pressed',String(soundOn));
  $('#sound').setAttribute('aria-label',soundOn ? 'Turn sound off' : 'Turn sound on');
}
$('#sound').addEventListener('click',() => { soundOn=!soundOn; updateSound(); playSound('bonus'); });

board.innerHTML = keyMap.map((key,index) => `<button class="hole" data-slot="${index}" aria-label="${key.toUpperCase()} key, empty"><span class="well"></span><span class="creature-window"><span class="character"></span></span><span class="target-label" aria-hidden="true">+25</span><span class="key-front"><span class="key-letter">${key.toUpperCase()}</span></span></button>`).join('');
const holes = $$('.hole');
$('#legend-bug').innerHTML = character('bug');
$('#legend-bonus').innerHTML = character('bonus');
$('#legend-bot').innerHTML = character('bot');
$('#cursor-mallet').innerHTML = mallet();
$('#charge-dots').innerHTML = '<i></i>'.repeat(6);

function preview() {
  const demo = {1:'bug',4:'bonus',6:'bot'};
  holes.forEach((hole,index) => {
    const type = demo[index];
    visible[index] = type ? `demo-${type}` : null;
    hole.className = `hole${type ? ` up demo ${type}` : ''}`;
    hole.querySelector('.character').innerHTML = type ? character(type) : '';
    hole.setAttribute('aria-label',`${keyMap[index].toUpperCase()} key${type ? `, ${type === 'bot' ? 'friendly robot' : type === 'bonus' ? 'purple bonus bug' : 'coral bug'} preview` : ', empty'}. Start a game to score.`);
  });
}

function clearEffects() {
  cleanupTimers.forEach(clearTimeout); cleanupTimers.clear();
  holds.fill(0); visible.fill(null);
  $$('.hit-score,.cheer').forEach(element => element.remove());
  $('#particles').replaceChildren();
  $('#machine').classList.remove('ouch','buddy-flash');
  holes.forEach(hole => { hole.className='hole'; hole.querySelector('.character').replaceChildren(); });
}
function newGame() {
  clearEffects();
  if ($('#result-dialog').open) $('#result-dialog').close();
  resultShown=false; lastEvent=0; lastFrame=0;
  game=createGame({mode:game.mode,seed:randomSeed()});
  best=loadBest();
  start(game);
  message('Bonk the bugs. Be nice to the bots.',2500);
  playSound('start');
  announce('Game started. Bonk coral and purple bugs. Spare mint robots.');
  render();
  board.focus({preventScroll:true});
  if (window.innerWidth < 681) $('#machine').scrollIntoView({behavior:prefersReducedMotion()?'instant':'smooth',block:'center'});
}
$('#start').addEventListener('click',() => {
  if (game.status==='paused') { resume(game); message('Back to perfectly normal development.'); render(); board.focus({preventScroll:true}); }
  else if (game.status!=='playing') newGame();
});
$('#again').addEventListener('click',newGame);
$$('[data-mode]').forEach(button => button.addEventListener('click',() => {
  if (game.status==='playing'||game.status==='paused') return;
  clearEffects();
  game=createGame({mode:button.dataset.mode}); best=loadBest(); resultShown=false; lastEvent=0;
  message('Your production environment awaits.',2000);
  preview();render();
}));

function popScore(index,text,bad=false) {
  const span=document.createElement('span'); span.className=`hit-score${bad?' bad':''}`; span.textContent=text;
  holes[index].append(span); later(() => span.remove(),850);
}
function burst(index,bonus=false) {
  if (prefersReducedMotion()) return;
  const rect=holes[index].getBoundingClientRect();
  const x=rect.left+rect.width/2; const y=rect.top+rect.height*.35;
  const colors=bonus?['#b796df','#ee97b1','#a8d9bd']:['#f09a92','#d6b5ef','#a8d9bd','#efe1fa'];
  for(let i=0;i<(bonus?13:8);i++){
    const particle=document.createElement('i');const size=5+Math.random()*7;
    particle.className=`particle${i%3===0?' star':''}`;
    particle.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i%colors.length]};color:${colors[i%colors.length]};--dx:${(Math.random()-.5)*130}px;--dy:${-20-Math.random()*90}px;--spin:${Math.random()*360}deg`;
    if(i%3===0)particle.innerHTML=star();
    $('#particles').append(particle);later(() => particle.remove(),700);
  }
}
function cheer(text) {
  if(prefersReducedMotion()){message(text);return;}
  const rect=board.getBoundingClientRect();
  const element=document.createElement('span'); element.className='cheer';element.textContent=text;
  element.style.left=`${rect.left+rect.width/2}px`;element.style.top=`${rect.top+rect.height*.45}px`;
  document.body.append(element);later(() => element.remove(),1300);
}
function animateMachine(name) {
  const machine=$('#machine');machine.classList.remove(name);
  void machine.offsetWidth;machine.classList.add(name);
  later(() => machine.classList.remove(name),550);
}
function processEvents() {
  const events=game.events.filter(event => event.id>lastEvent);
  for(const event of events){
    lastEvent=event.id;
    if(event.type==='hit'||event.type==='bot-hit'){
      const hole=holes[event.slot];const friendly=event.type==='bot-hit';
      holds[event.slot]=clock()+175;
      visible[event.slot]=null;
      hole.className=`hole up ${friendly?'bot bot-hit':`${event.targetType} hit`}`;
      hole.querySelector('.character').innerHTML=character(event.targetType,'hit');
      popScore(event.slot,`${event.points>0?'+':''}${event.points}`,friendly);
      if(friendly){playSound('bad');message('That one was helping. −20');animateMachine('ouch');}
      else{
        playSound(event.targetType==='bonus'?'bonus':'hit');burst(event.slot,event.targetType==='bonus');
        if(event.combo>0&&event.combo%5===0){
          const texts=['Nice debugging!','Ship happens.','Unreasonably effective.','Bug whisperer!'];
          cheer(texts[Math.min(3,Math.floor(event.combo/5)-1)]);
          message(`${Math.min(5,1+Math.floor(event.combo/5))}× multiplier. Keep it going!`,1600);
        } else if(event.targetType==='bonus') message('A rare one! Nice catch.',1300);
      }
    }
    if(event.type==='empty'){popScore(event.slot,'−5',true);playSound('empty');message('Nothing there. Just vibes. −5',1200);}
    if(event.type==='miss'&&clock()>messageUntil)message('One got away. Classic.',850);
    if(event.type==='assist'){playSound('buddy');animateMachine('buddy-flash');cheer('Good bot.');message('Bot Buddy cleaned up. Teamwork!',1800);}
    if(event.type==='over')showResult();
  }
}
function whack(index) {
  if(game.status==='ready'){
    const hole=holes[index];hole.classList.add('pressed');later(() => hole.classList.remove('pressed'),130);
    message('Hit “Let’s debug” to start scoring.',1400);playSound('empty');return;
  }
  if(game.status!=='playing')return;
  // A short visual after-hit tail is not a second target.
  if(holds[index]>clock()&&!game.slots[index])return;
  hit(game,index);
  holes[index].classList.add('pressed');later(() => holes[index].classList.remove('pressed'),130);
  const cursor=$('#cursor-mallet');cursor.classList.remove('swing');void cursor.offsetWidth;cursor.classList.add('swing');
  processEvents();render();
}
board.addEventListener('click',event => {
  const hole=event.target.closest('[data-slot]');if(hole)whack(Number(hole.dataset.slot));
});
function useBuddy() {
  const outcome=assist(game);
  if(!outcome.used){if(game.status==='playing')message(game.charge<6?'Catch six bugs to charge your buddy.':'Buddy is ready. Wait for a bug!',1200);return;}
  processEvents();render();
}
$('#assist').addEventListener('click',useBuddy);

function pauseGame(){
  if(game.status==='playing'){pause(game);announce('Game paused.');}
  else if(game.status==='paused'){resume(game);lastFrame=0;announce('Game resumed.');}
  render();
}
$('#pause').addEventListener('click',pauseGame);
$('#resume').addEventListener('click',() => { if(game.status==='paused')pauseGame(); else newGame(); board.focus({preventScroll:true}); });
$('#help').addEventListener('click',() => {
  resumeAfterHelp=game.status==='playing';
  if(resumeAfterHelp)pause(game);
  $('#help-dialog').showModal();render();
});
$('#help-dialog').addEventListener('close',() => { if(resumeAfterHelp&&game.status==='paused'){resume(game);lastFrame=0;}resumeAfterHelp=false;render(); });
$$('[data-close]').forEach(button => button.addEventListener('click',() => $(`#${button.dataset.close}`).close()));
$('#help-play').addEventListener('click',() => { $('#help-dialog').close(); if(game.status==='ready'||game.status==='over')newGame(); });

function showResult() {
  if(resultShown)return;
  resultShown=true;playSound('end');
  const record=game.score>best;
  if(record){best=game.score;try{localStorage.setItem(`whack-a-bug:best:${game.mode}`,String(best));}catch{/* Storage blocked: keep the in-memory best. */}}
  $('#result-mascot').innerHTML=character(game.score>=300?'bonus':'bug');
  setText('#result-badge',record?'NEW PERSONAL BEST! NICE BONKING.':'DEPLOYMENT COMPLETE. SORT OF.');
  setText('#result-title',game.score>=1000?'You absolute bug menace.':game.score>=500?'Certified bug bonker.':game.score>=150?'Well bonked.':'It works on your machine.');
  setText('#final-score',String(game.score).padStart(4,'0'));
  setText('#final-hits',game.hits);setText('#final-combo',game.bestCombo);setText('#final-bots',game.botHits);
  setText('#result-joke',game.botHits>2?'HR would like a word about the robots.':game.botHits===0&&game.hits>0?'Not a single robot harmed. The union thanks you.':'There are probably still bugs. There always are.');
  setText('#share-feedback','');
  $('#result-dialog').showModal();
  announce(`Time up. ${game.score} points. ${game.hits} bugs bonked. Best streak ${game.bestCombo}.`);
  $('#cursor-mallet').style.display='none';
}
$('#share').addEventListener('click',async () => {
  const text=`I bonked ${game.hits} bugs for ${game.score} points in Whack-a-Bug! ${game.mode==='chill'?'Chill':'Ship it'} mode. Can you beat that? ${location.origin}${location.pathname}`;
  try{await navigator.clipboard.writeText(text);setText('#share-feedback','Copied. Go start a friendly rivalry.');}
  catch{setText('#share-feedback',text);}
});

function render() {
  document.body.dataset.status=game.status;
  board.classList.toggle('playing',game.status==='playing');
  if(game.status!=='ready'){
    game.slots.forEach((target,index) => {
      const hole=holes[index];
      if(target){
        if(visible[index]!==target.id){
          holds[index]=0;visible[index]=target.id;
          hole.className=`hole up ${target.type}`;
          hole.querySelector('.character').innerHTML=character(target.type);
        }
        hole.setAttribute('aria-label',`${keyMap[index].toUpperCase()}: ${target.type==='bot'?'friendly robot, do not hit':target.type==='bonus'?'purple bonus bug, 25 points':'coral bug, 10 points'}`);
      }else if(clock()>=holds[index]){
        hole.classList.remove('up','demo','hit','bot-hit','bug','bonus','bot');visible[index]=null;
        hole.setAttribute('aria-label',`${keyMap[index].toUpperCase()}: empty key`);
      }
    });
  }
  setText('#score',String(game.score).padStart(4,'0'));
  setText('#intro-seconds',game.duration);
  const seconds=Math.ceil(game.remaining);
  if($('#timer').dataset.value!==String(seconds)){ $('#timer').innerHTML=`${seconds}<span>s</span>`;$('#timer').dataset.value=String(seconds); }
  if($('#streak').dataset.value!==String(game.bestCombo)){ $('#streak').innerHTML=`${String(game.bestCombo).padStart(2,'0')}<span>×</span>`;$('#streak').dataset.value=String(game.bestCombo); }
  setText('#best-side',String(best).padStart(4,'0'));
  $('.time-block').classList.toggle('urgent',seconds<=10&&game.status==='playing');
  const locked=game.status==='playing'||game.status==='paused';
  $$('[data-mode]').forEach(button => {button.disabled=locked;button.setAttribute('aria-pressed',String(button.dataset.mode===game.mode));});
  const startCopy={ready:'Let’s debug',playing:'Bonking in progress',paused:'Resume',over:'Play again'};
  if($('#start').dataset.status!==game.status){$('#start').innerHTML=`${startCopy[game.status]} <span aria-hidden="true">${game.status==='playing'?'···':'↗'}</span>`;$('#start').dataset.status=game.status;}
  $('#start').disabled=game.status==='playing';
  $('#pause').disabled=!locked;
  $('#pause').setAttribute('aria-label',game.status==='paused'?'Resume game':'Pause game');
  $('#pause span').textContent=game.status==='paused'?'▷':'Ⅱ';
  const ready=game.charge>=6&&game.status==='playing';
  $('#assist').disabled=!ready;
  $('#assist').classList.toggle('ready',ready);
  setText('#assist-label',ready?'Ready! Tap or press Space':`Catch ${6-game.charge} bug${6-game.charge===1?'':'s'} to charge`);
  $$('#charge-dots i').forEach((dot,index) => dot.classList.toggle('filled',index<game.charge));
  $('#combo').hidden=game.combo<5;
  setText('#combo',`${game.multiplier}×`);
  const overlay=game.status==='paused'||game.status==='over';
  $('#board-overlay').hidden=!overlay;
  // Keys under the overlay must not stay reachable by Tab.
  if(overlay&&board.contains(document.activeElement))$('#resume').focus({preventScroll:true});
  board.inert=overlay;
  if(game.status==='over'){
    setText('#overlay-symbol','✦');setText('#overlay-title','One more fix?');setText('#overlay-copy',`${game.score} points. The bugs will be back.`);
    $('#resume').innerHTML='Play again <span>↗</span>';
  }else if(game.status==='paused'){
    setText('#overlay-symbol','☕');setText('#overlay-title','Coffee break.');setText('#overlay-copy','Even production can wait.');
    $('#resume').innerHTML='Back to bugs <span>↗</span>';
  }
  if(clock()>messageUntil){
    setText('#message',game.status==='ready'?'Your production environment awaits.':game.status==='playing'?(game.remaining<10?'Last push. Definitely no new bugs.':game.charge>=6?'Your bot buddy is ready!':'Bonk bugs. Protect robot feelings.'):game.status==='paused'?'No bugs escaped during your break.':'Time to write the incident report.');
  }
  if(finePointer&&!prefersReducedMotion())$('#cursor-mallet').style.display=isOnBoard&&game.status==='playing'&&!$$('dialog').some(dialog=>dialog.open)?'block':'none';
}

board.addEventListener('pointerenter',event => { if(event.pointerType==='mouse'){isOnBoard=true;render();} });
board.addEventListener('pointerleave',() => {isOnBoard=false;$('#cursor-mallet').style.display='none';});
board.addEventListener('pointermove',event => {if(event.pointerType==='mouse'){$('#cursor-mallet').style.left=`${event.clientX}px`;$('#cursor-mallet').style.top=`${event.clientY}px`;}});

document.addEventListener('keydown',event => {
  if(event.repeat||event.metaKey||event.ctrlKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable||$$('dialog').some(dialog=>dialog.open))return;
  const key=event.key.toLowerCase();
  if(game.status==='playing'&&keyMap.includes(key)){event.preventDefault();whack(keyMap.indexOf(key));}
  else if(event.code==='Space'&&game.status==='playing'&&(event.target.closest('.hole')||(event.target.tagName!=='BUTTON'&&event.target.tagName!=='A'))){event.preventDefault();useBuddy();}
  else if(key==='p'&&(game.status==='playing'||game.status==='paused')){event.preventDefault();pauseGame();}
});

document.addEventListener('visibilitychange',() => {
  if(document.hidden&&game.status==='playing'){pause(game);resumeAfterHelp=false;render();announce('Game paused while you were away.');}
  lastFrame=0;
});
function frame(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
  tick(game,dt);processEvents();render();
  requestAnimationFrame(frame);
}
preview();render();requestAnimationFrame(frame);

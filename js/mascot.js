// "Squeezy" — the juicy orange mascot. Pure SVG; expressions swap eyes + mouth.

const MOUTHS = {
  happy: 'M26 50 Q40 64 54 50 Q40 56 26 50 Z',
  grin: 'M24 48 Q40 70 56 48 Q40 56 24 48 Z',
  smile: 'M28 52 Q40 60 52 52',
  flat: 'M30 54 L50 54',
  sad: 'M28 58 Q40 48 52 58',
  oh: 'M40 50 m-5 0 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0',
  smirk: 'M28 54 Q42 62 54 50',
};

const EYES = {
  open: `<circle cx="29" cy="38" r="5.5" fill="#2a1250"/><circle cx="51" cy="38" r="5.5" fill="#2a1250"/><circle cx="31" cy="36" r="2" fill="#fff"/><circle cx="53" cy="36" r="2" fill="#fff"/>`,
  happy: `<path d="M23 40 Q29 32 35 40" stroke="#2a1250" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M45 40 Q51 32 57 40" stroke="#2a1250" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  wide: `<circle cx="29" cy="37" r="7" fill="#fff" stroke="#2a1250" stroke-width="2"/><circle cx="51" cy="37" r="7" fill="#fff" stroke="#2a1250" stroke-width="2"/><circle cx="30" cy="38" r="3.2" fill="#2a1250"/><circle cx="52" cy="38" r="3.2" fill="#2a1250"/>`,
  sad: `<circle cx="29" cy="39" r="5" fill="#2a1250"/><circle cx="51" cy="39" r="5" fill="#2a1250"/><circle cx="30.5" cy="37.5" r="1.8" fill="#fff"/><circle cx="52.5" cy="37.5" r="1.8" fill="#fff"/><path d="M21 35 L35 30 M59 35 L45 30" stroke="#2a1250" stroke-width="3" stroke-linecap="round"/>`,
  think: `<circle cx="29" cy="38" r="5.5" fill="#2a1250"/><circle cx="51" cy="38" r="5.5" fill="#2a1250"/><circle cx="32" cy="35" r="2" fill="#fff"/><circle cx="54" cy="35" r="2" fill="#fff"/><path d="M44 27 Q51 21 58 27" stroke="#2a1250" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  wink: `<path d="M23 39 Q29 33 35 39" stroke="#2a1250" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="51" cy="38" r="5.5" fill="#2a1250"/><circle cx="53" cy="36" r="2" fill="#fff"/>`,
  sleep: `<path d="M23 39 Q29 44 35 39" stroke="#2a1250" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M45 39 Q51 44 57 39" stroke="#2a1250" stroke-width="4" fill="none" stroke-linecap="round"/>`,
};

const MOODS = {
  idle: ['open', 'smile'], happy: ['happy', 'grin'], wow: ['wide', 'oh'], sad: ['sad', 'sad'],
  think: ['think', 'smirk'], wink: ['wink', 'smirk'], sleep: ['sleep', 'flat'], cheer: ['happy', 'grin'],
};

let uid = 0;
export class Mascot {
  constructor(root, { size = 84, bubble = true } = {}) {
    this.root = root;
    const gid = 'mg' + (uid++);
    root.classList.add('mascot');
    root.innerHTML = `
      <div class="mascot-body" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 80 80" width="${size}" height="${size}">
          <defs>
            <radialGradient id="${gid}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".45" stop-color="#ff9f1c"/><stop offset="1" stop-color="#e5560b"/></radialGradient>
          </defs>
          <ellipse cx="40" cy="74" rx="22" ry="4" fill="rgba(0,0,0,.25)"/>
          <path d="M40 12 C34 4 24 6 22 10 C28 12 34 14 40 18 C46 14 54 10 60 8 C56 4 46 4 40 12Z" fill="#4cd964" stroke="#1d7a2e" stroke-width="1.6" stroke-linejoin="round"/>
          <circle cx="40" cy="44" r="31" fill="url(#${gid})" stroke="#b3410a" stroke-width="2"/>
          <ellipse cx="27" cy="26" rx="9" ry="5" transform="rotate(-30 27 26)" fill="#fff" opacity=".45"/>
          <circle cx="19" cy="48" r="5" fill="#ff5d8f" opacity=".5"/><circle cx="61" cy="48" r="5" fill="#ff5d8f" opacity=".5"/>
          <g class="m-eyes"></g>
          <path class="m-mouth" stroke="#2a1250" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      ${bubble ? '<div class="mascot-bubble" hidden></div>' : ''}`;
    this.body = root.querySelector('.mascot-body');
    this.eyes = root.querySelector('.m-eyes');
    this.mouth = root.querySelector('.m-mouth');
    this.bubble = root.querySelector('.mascot-bubble');
    this.set('idle');
    this._blinkLoop();
  }

  set(mood, { bounce = true } = {}) {
    const [e, m] = MOODS[mood] || MOODS.idle;
    this.mood = mood;
    this.eyes.innerHTML = EYES[e];
    this.mouth.setAttribute('d', MOUTHS[m]);
    const filled = ['happy', 'grin', 'oh'].includes(m);
    this.mouth.setAttribute('fill', filled ? '#7a1f3d' : 'none');
    this.root.dataset.mood = mood;
    if (bounce) {
      const keyframes = mood === 'sad'
        ? [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px) rotate(-6deg)' }, { transform: 'translateX(6px) rotate(6deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }]
        : [{ transform: 'scale(1,1)' }, { transform: 'scale(1.2,.8) translateY(6px)' }, { transform: 'scale(.85,1.2) translateY(-14px)' }, { transform: 'scale(1.08,.94)' }, { transform: 'scale(1,1)' }];
      this.body.animate(keyframes, { duration: mood === 'sad' ? 420 : 520, easing: 'ease-out' });
    }
  }

  say(text, ms = 2600) {
    if (!this.bubble) return;
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    this.bubble.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    clearTimeout(this._bt);
    if (ms) this._bt = setTimeout(() => this.hush(), ms);
  }

  hush() {
    if (!this.bubble || this.bubble.hidden) return;
    const a = this.bubble.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    a.onfinish = () => { this.bubble.hidden = true; };
  }

  _blinkLoop() {
    const tick = () => {
      if (!this.root.isConnected) return;
      if (this.mood === 'idle' || this.mood === 'think') {
        const prev = this.eyes.innerHTML;
        this.eyes.innerHTML = EYES.happy.replace(/stroke-width="4"/g, 'stroke-width="3"');
        setTimeout(() => { if (this.eyes.innerHTML !== prev && (this.mood === 'idle' || this.mood === 'think')) this.eyes.innerHTML = prev; }, 120);
      }
      setTimeout(tick, 2200 + Math.random() * 2600);
    };
    setTimeout(tick, 2500);
  }
}

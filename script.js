/* ==========================================================
   CLAUDE — LE FILM
   GSAP + ScrollTrigger (animations) · Lenis (scroll) · Canvas · WebAudio
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n) => String(n).padStart(2, '0');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const preloaderEl = $('#preloader');

  // Sécurité : si une librairie CDN ne charge pas, on affiche le site en version statique.
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof Lenis === 'undefined') {
    if (preloaderEl) preloaderEl.remove();
    root.classList.add('static');
    console.warn('Librairies manquantes : version statique affichée.');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('anim-ready');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  /* ==========================================================
     EMBLÈME (étincelle générée)
     ========================================================== */
  function buildEmblem(svg, n = 12) {
    if (!svg) return;
    const g = svg.querySelector('g');
    const lens = [34, 22, 38, 24, 36, 20, 40, 26, 34, 22, 38, 28];
    let html = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = lens[i % lens.length];
      const r0 = 9;
      const x1 = 50 + Math.cos(a) * r0;
      const y1 = 50 + Math.sin(a) * r0;
      const x2 = 50 + Math.cos(a) * (r0 + l);
      const y2 = 50 + Math.sin(a) * (r0 + l);
      html += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
    }
    g.innerHTML = html;
  }
  buildEmblem($('#preEmblem'), 12);
  buildEmblem($('#charEmblem'), 14);

  /* ==========================================================
     SON — musique générative + effets (WebAudio)
     ========================================================== */
  const GENRES = {
    blockbuster: { root: 55,    chord: [1, 1.2, 1.5, 2],     scale: [220, 261.63, 293.66, 329.63, 392, 440, 523.25],   tempo: 0.46, cut: 1 },
    noir:        { root: 49,    chord: [1, 1.2, 1.5, 1.78],  scale: [196, 233.08, 261.63, 293.66, 349.23, 392],        tempo: 0.72, cut: 0.7 },
    scifi:       { root: 55,    chord: [1, 1.5, 2, 3],       scale: [220, 293.66, 329.63, 440, 493.88, 587.33, 659.25], tempo: 0.24, cut: 1.3 },
    western:     { root: 55,    chord: [1, 1.25, 1.5, 2],    scale: [196, 220, 246.94, 293.66, 329.63, 392],           tempo: 0.5,  cut: 1 },
    horreur:     { root: 46.25, chord: [1, 1.414, 2, 2.83],  scale: [233.08, 246.94, 329.63, 349.23, 466.16],          tempo: 0.95, cut: 0.6 },
    comedie:     { root: 65.41, chord: [1, 1.25, 1.5, 2],    scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33], tempo: 0.2,  cut: 1.4 },
  };

  const Sound = (() => {
    let ctx = null, master = null, bus = null, filter = null, noiseBuf = null;
    let pads = [], timer = null, nextT = 0, noteIdx = 2;
    let enabled = false, genre = 'blockbuster', scrollP = 0, scrollV = 0;

    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      bus = ctx.createGain();
      bus.connect(master);

      // Écho léger
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      bus.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(master);

      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.8;
      filter.connect(bus);

      // Nappe : accord de saws légèrement désaccordées
      const g = GENRES[genre];
      g.chord.forEach((ratio) => {
        [-7, 7].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = g.root * ratio * 2;
          o.detune.value = det;
          const og = ctx.createGain();
          og.gain.value = 0.028;
          o.connect(og);
          og.connect(filter);
          o.start();
          pads.push({ o, ratio });
        });
      });

      // Sub basse
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = g.root;
      const sg = ctx.createGain();
      sg.gain.value = 0.12;
      sub.connect(sg);
      sg.connect(bus);
      sub.start();
      pads.push({ o: sub, ratio: 1, sub: true });

      // LFO sur le filtre
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lg = ctx.createGain();
      lg.gain.value = 180;
      lfo.connect(lg);
      lg.connect(filter.frequency);
      lfo.start();

      // Bruit blanc (pour les whoosh / claps)
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      // Arpège aléatoire planifié
      nextT = ctx.currentTime + 0.3;
      timer = setInterval(schedule, 120);
      return true;
    }

    function schedule() {
      if (!ctx || !enabled) { if (ctx) nextT = Math.max(nextT, ctx.currentTime); return; }
      const g = GENRES[genre];
      while (nextT < ctx.currentTime + 0.35) {
        if (Math.random() > 0.22) playNote(nextT, g);
        nextT += g.tempo * (Math.random() < 0.3 ? 2 : 1) / (1 + Math.min(scrollV, 30) * 0.02);
      }
    }

    function playNote(t, g) {
      noteIdx = clamp(noteIdx + Math.floor(Math.random() * 5) - 2, 0, g.scale.length - 1);
      const f = g.scale[noteIdx];
      const o = ctx.createOscillator();
      o.type = genre === 'comedie' ? 'square' : 'triangle';
      o.frequency.value = f;
      const gn = ctx.createGain();
      const peak = genre === 'comedie' ? 0.04 : 0.07;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(gn);
      gn.connect(bus);
      o.start(t);
      o.stop(t + 1.6);
    }

    function setEnabled(b) {
      enabled = b;
      if (!b && !ctx) return;
      if (b && !init()) { enabled = false; return; }
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(b ? 0.55 : 0, now, b ? 1.2 : 0.15);
    }

    function setGenre(name) {
      genre = name;
      if (!ctx) return;
      const g = GENRES[name];
      const now = ctx.currentTime;
      pads.forEach((p) => {
        const f = p.sub ? g.root : g.root * p.ratio * 2;
        p.o.frequency.setTargetAtTime(f, now, 0.9);
      });
      noteIdx = Math.min(noteIdx, g.scale.length - 1);
      applyFilter();
    }

    function applyFilter() {
      if (!ctx) return;
      const g = GENRES[genre];
      const f = (350 + scrollP * 1700 + Math.min(scrollV, 40) * 45) * g.cut;
      filter.frequency.setTargetAtTime(f, ctx.currentTime, 0.35);
    }
    function setScroll(p, v) { scrollP = p; scrollV = Math.abs(v || 0); applyFilter(); }

    const ok = () => ctx && enabled;

    function noiseSrc() {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      return s;
    }
    function whoosh(power = 1) {
      if (!ok()) return;
      const t = ctx.currentTime;
      const s = noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(250, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 0.7);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.16 * power, t + 0.3);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      s.connect(bp); bp.connect(gn); gn.connect(master);
      s.start(t); s.stop(t + 0.9);
    }
    function clap() {
      if (!ok()) return;
      const t = ctx.currentTime;
      const s = noiseSrc();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1400;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.7, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      s.connect(hp); hp.connect(gn); gn.connect(master);
      s.start(t); s.stop(t + 0.2);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.2);
    }
    function boom() {
      if (!ok()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.6, t + 0.03);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(gn); gn.connect(master);
      o.start(t); o.stop(t + 1.8);
    }
    function beep(freq = 880, len = 0.14) {
      if (!ok()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(gn); gn.connect(master);
      o.start(t); o.stop(t + len + 0.02);
    }
    function tick() {
      if (!ok()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 1700 + Math.random() * 300;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.05, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(gn); gn.connect(master);
      o.start(t); o.stop(t + 0.06);
    }
    function sting() { // petite fanfare pour les changements de genre
      if (!ok()) return;
      const g = GENRES[genre];
      const t = ctx.currentTime;
      [0, 2, 4].forEach((k, i) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = g.scale[Math.min(k, g.scale.length - 1)] * 2;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t + i * 0.09);
        gn.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.9);
        o.connect(gn); gn.connect(bus);
        o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1);
      });
    }

    return {
      init, setEnabled, setGenre, setScroll, whoosh, clap, boom, beep, tick, sting,
      get enabled() { return enabled; },
    };
  })();

  const sndBtn = $('#sndBtn');
  const sndLbl = $('#sndLbl');
  function syncSndUI() {
    sndBtn.classList.toggle('on', Sound.enabled);
    sndLbl.textContent = Sound.enabled ? 'Son on' : 'Son off';
  }
  syncSndUI();
  sndBtn.addEventListener('click', () => {
    Sound.setEnabled(!Sound.enabled);
    syncSndUI();
    Sound.tick();
  });
  let wasOn = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasOn = Sound.enabled;
      if (wasOn) Sound.setEnabled(false);
    } else if (wasOn) {
      wasOn = false;
      Sound.setEnabled(true);
    }
  });

  /* ==========================================================
     LENIS — scroll fluide
     ========================================================== */
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.95, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const maxScroll = () => Math.max(0, root.scrollHeight - innerHeight);

  $$('[data-scroll]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      Sound.whoosh(0.6);
      if (link.hasAttribute('data-scroll-end')) {
        lenis.scrollTo(maxScroll(), { duration: 3.4, easing: easeOutQuart });
      } else if (href === '#hero') {
        lenis.scrollTo(0, { duration: 1.8, easing: easeOutQuart });
      } else {
        const target = $(href);
        if (target) lenis.scrollTo(target, { duration: 1.8, easing: easeOutQuart });
      }
    });
  });

  /* ==========================================================
     DÉCOUPAGE DE TEXTE
     ========================================================== */
  function splitWords(el, masked = true) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) {
              frag.appendChild(document.createTextNode(' '));
            } else if (masked) {
              const w = document.createElement('span');
              w.className = 'w';
              const i = document.createElement('span');
              i.className = 'wi';
              i.textContent = tok;
              w.appendChild(i);
              frag.appendChild(w);
            } else {
              const w = document.createElement('span');
              w.className = 'mw';
              w.textContent = tok;
              frag.appendChild(w);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  }

  $$('[data-split]').forEach((el) => splitWords(el, true));
  const manifestoEl = $('#manifestoText');
  splitWords(manifestoEl, false);
  const manifestoWords = $$('.mw', manifestoEl);

  $$('.split-chars').forEach((el) => {
    el.innerHTML = Array.from(el.textContent)
      .map((c) => (c === ' ' ? '<span class="sp"></span>' : `<span class="char">${c}</span>`))
      .join('');
  });

  /* ==========================================================
     FOND : starfield 3D qui réagit au scroll et à la souris
     ========================================================== */
  const stage = (() => {
    const cv = $('#stage');
    const c = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1;
    const N = innerWidth < 700 ? 240 : 460;
    const stars = [];
    let col = '#d97757', col2 = '#f2b66d';
    let vel = 0, mx = 0, my = 0, tx = 0, ty = 0;
    let shoot = null, nextShoot = performance.now() + 4000;
    let opacity = 1;

    function resize() {
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function respawn(s, first) {
      s.x = Math.random() * 2 - 1;
      s.y = Math.random() * 2 - 1;
      s.z = first ? Math.random() * 0.95 + 0.05 : 1;
      s.acc = Math.random() < 0.2;
    }
    for (let i = 0; i < N; i++) { const s = {}; respawn(s, true); stars.push(s); }
    resize();
    addEventListener('resize', resize);

    function setColors() {
      const cs = getComputedStyle(root);
      col = cs.getPropertyValue('--acc').trim() || col;
      col2 = cs.getPropertyValue('--acc2').trim() || col2;
    }

    function draw(dt) {
      c.clearRect(0, 0, W, H);
      c.globalAlpha = 1;
      tx = lerp(tx, mx, 0.05);
      ty = lerp(ty, my, 0.05);
      const ox = W / 2 + tx * 60;
      const oy = H / 2 + ty * 40;
      const f = Math.max(W, H) * 0.55;
      const base = reduced ? 0.0002 : 0.0009;
      const spd = (base + Math.min(Math.abs(vel), 60) * 0.00032) * dt;
      const streak = 1 + Math.min(Math.abs(vel), 60) * 0.7;

      // Halo d'ambiance
      const g1 = c.createRadialGradient(ox, oy, 0, ox, oy, Math.max(W, H) * 0.6);
      g1.addColorStop(0, hexA(col, 0.1));
      g1.addColorStop(1, 'transparent');
      c.fillStyle = g1;
      c.fillRect(0, 0, W, H);

      for (let i = 0; i < N; i++) {
        const s = stars[i];
        const dz = spd * (0.6 + s.z * 0.8);
        s.z -= dz;
        if (s.z <= 0.02) { respawn(s, false); continue; }
        const x1 = ox + (s.x * f) / s.z;
        const y1 = oy + (s.y * f) / s.z;
        if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) { respawn(s, false); continue; }
        const zp = s.z + dz * streak;
        const x0 = ox + (s.x * f) / zp;
        const y0 = oy + (s.y * f) / zp;
        const a = clamp(1 - s.z * 0.95);
        c.globalAlpha = a * 0.9;
        c.strokeStyle = s.acc ? col2 : '#ffffff';
        c.lineWidth = (1 - s.z) * 1.9 + 0.25;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1 + 0.01, y1 + 0.01);
        c.stroke();
      }
      c.globalAlpha = 1;

      // Étoile filante
      const now = performance.now();
      if (!shoot && now > nextShoot && !reduced) {
        shoot = { x: Math.random() * W * 0.8 + W * 0.1, y: Math.random() * H * 0.35, vx: 14 + Math.random() * 8, vy: 6 + Math.random() * 4, life: 1 };
        nextShoot = now + 5000 + Math.random() * 6000;
      }
      if (shoot) {
        shoot.x += shoot.vx * dt;
        shoot.y += shoot.vy * dt;
        shoot.life -= 0.02 * dt;
        const grad = c.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
        grad.addColorStop(0, hexA(col2, shoot.life));
        grad.addColorStop(1, 'transparent');
        c.strokeStyle = grad;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(shoot.x, shoot.y);
        c.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
        c.stroke();
        if (shoot.life <= 0) shoot = null;
      }
    }

    return {
      setColors, draw,
      setVel: (v) => { vel = v; },
      setMouse: (nx, ny) => { mx = nx; my = ny; },
      setOpacity: (o) => { opacity = lerp(opacity, o, 0.06); cv.style.opacity = opacity.toFixed(3); },
    };
  })();

  function hexA(hex, a) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return `rgba(255,255,255,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
  }

  /* ==========================================================
     FX : éclats au clic, confettis, pluie « Matrix »
     ========================================================== */
  const fx = (() => {
    const cv = $('#fx');
    const c = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1;
    const parts = [];
    let matrixUntil = 0, drops = [], cols = 0, frameN = 0, dirty = false;

    function resize() {
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.floor(W / 16);
      drops = Array.from({ length: cols }, () => Math.random() * -40);
    }
    resize();
    addEventListener('resize', resize);

    const palette = () => {
      const cs = getComputedStyle(root);
      return [cs.getPropertyValue('--acc').trim(), cs.getPropertyValue('--acc2').trim(), cs.getPropertyValue('--acc3').trim(), '#ffffff'];
    };

    function burst(x, y, n = 20) {
      const pal = palette();
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.12, life: 1, decay: 0.018 + Math.random() * 0.02, size: 1.5 + Math.random() * 2.5, col: pal[(Math.random() * pal.length) | 0], rect: false });
      }
    }
    function confetti() {
      const pal = palette().concat(['#2de08f', '#4dd8ff', '#ffd84d']);
      for (let i = 0; i < 170; i++) {
        parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, g: 0.05, life: 1, decay: 0.004 + Math.random() * 0.004, size: 6 + Math.random() * 6, col: pal[(Math.random() * pal.length) | 0], rect: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
      }
    }
    function matrix(ms = 12000) {
      matrixUntil = performance.now() + ms;
      resize();
    }

    function frame() {
      const now = performance.now();
      const matrixOn = now < matrixUntil;
      if (!parts.length && !matrixOn && !dirty) return;

      if (matrixOn || dirty) {
        c.globalCompositeOperation = 'destination-out';
        c.fillStyle = matrixOn ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.35)';
        c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.clearRect(0, 0, W, H);
      }
      dirty = matrixOn;

      if (matrixOn && ++frameN % 2 === 0) {
        c.font = '16px monospace';
        for (let i = 0; i < cols; i++) {
          const ch = String.fromCharCode(0x30A0 + ((Math.random() * 96) | 0));
          const y = drops[i] * 16;
          c.fillStyle = '#eaffea';
          c.fillText(ch, i * 16, y);
          c.fillStyle = '#00ff66';
          c.fillText(String.fromCharCode(0x30A0 + ((Math.random() * 96) | 0)), i * 16, y - 16);
          if (y > H && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0 || p.y > H + 30) { parts.splice(i, 1); continue; }
        c.globalAlpha = clamp(p.life);
        c.fillStyle = p.col;
        if (p.rect) {
          p.rot += p.vr;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          c.restore();
        } else {
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;
      if (!matrixOn && !parts.length) { c.clearRect(0, 0, W, H); dirty = false; }
    }
    return { burst, confetti, matrix, frame };
  })();

  /* ==========================================================
     SOUS-TITRES
     ========================================================== */
  const subsEl = $('#subs');
  gsap.set(subsEl, { opacity: 0, y: 8 });
  let subTimer = null;
  function subtitle(text, ms = 4200) {
    if (!text) return;
    subsEl.textContent = text;
    gsap.to(subsEl, { opacity: 1, y: 0, duration: 0.5, overwrite: true });
    clearTimeout(subTimer);
    subTimer = setTimeout(() => gsap.to(subsEl, { opacity: 0, y: 8, duration: 0.6 }), ms);
  }

  /* ==========================================================
     PRÉCHARGEUR → COMPTE À REBOURS → INTRO
     ========================================================== */
  const leader = $('#leader');
  const leaderNum = $('#leaderNum');
  const preChoice = $('#preChoice');
  const preText = $('#preText');

  const pageReady = Promise.race([
    Promise.all([
      new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true }))),
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    ]),
    new Promise((res) => setTimeout(res, 6000)),
  ]);

  // États initiaux (posés par JS : sans JS, le site reste lisible)
  gsap.set(['.hero-pre', '.hero-sub', '.hero-cta', '.hero-meta'], { opacity: 0, y: 24 });
  gsap.set('.hero-title .char', { yPercent: 125, rotate: 8, opacity: 0 });
  gsap.set('.bar-top', { yPercent: -100 });
  gsap.set('.bar-bottom', { yPercent: 100 });

  let launched = false;
  async function launch(withSound) {
    if (launched) return;
    launched = true;
    if (withSound) { Sound.setEnabled(true); syncSndUI(); }
    gsap.to(preChoice, { opacity: 0, y: 10, duration: 0.4, pointerEvents: 'none' });
    preText.textContent = 'Silence, on tourne…';
    leader.classList.add('run');
    await pageReady;

    for (let n = 3; n >= 1; n--) {
      leaderNum.textContent = n;
      gsap.fromTo(leaderNum, { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' });
      Sound.beep(n === 1 ? 1320 : 880);
      await sleep(reduced ? 350 : 900);
    }
    leaderNum.textContent = '';
    gsap.fromTo('#flash', { opacity: 0.9 }, { opacity: 0, duration: 0.7, ease: 'power2.out' });
    Sound.clap();
    await sleep(160);
    playIntro();
  }
  $('#startSound').addEventListener('click', () => launch(true));
  $('#startMute').addEventListener('click', () => launch(false));
  addEventListener('keydown', (e) => {
    if (!launched && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); launch(true); }
  });

  function playIntro() {
    const tl = gsap.timeline();
    if (reduced) tl.timeScale(3);
    tl
      .to('.pre-inner', { opacity: 0, y: -30, duration: 0.6, ease: 'power2.in' })
      .to('.curtain-top', { yPercent: -101, duration: 1.3, ease: 'expo.inOut' }, '-=0.1')
      .to('.curtain-bottom', { yPercent: 101, duration: 1.3, ease: 'expo.inOut' }, '<')
      .add(() => { Sound.whoosh(1.3); Sound.boom(); }, '<0.15')
      .to('.bar-top', { yPercent: 0, duration: 1, ease: 'expo.out' }, '-=0.7')
      .to('.bar-bottom', { yPercent: 0, duration: 1, ease: 'expo.out' }, '<')
      .to('.hero-pre', { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, '-=0.5')
      .to('.hero-title .char', { yPercent: 0, rotate: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.06 }, '-=0.6')
      .to(['.hero-sub', '.hero-cta', '.hero-meta'], { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.14 }, '-=0.8')
      .add(() => {
        lenis.start();
        if (preloaderEl) preloaderEl.style.pointerEvents = 'none';
        startTyped();
        startGlitch();
        subtitle('[ Une musique grave monte doucement ]');
      }, '-=1.1')
      .add(() => {
        if (preloaderEl) preloaderEl.remove();
        ScrollTrigger.refresh();
      });
  }

  async function startTyped() {
    const el = $('#typed');
    const phrases = ["J'écris.", 'Je code.', 'Je raisonne.', 'Je traduis.', 'Je débogue à 3 h du matin.', "Aujourd'hui, je réalise un film."];
    let i = 0;
    while (true) {
      const p = phrases[i % phrases.length];
      for (const ch of p) { el.textContent += ch; await sleep(46); }
      await sleep(1500);
      while (el.textContent.length) { el.textContent = el.textContent.slice(0, -1); await sleep(20); }
      await sleep(260);
      i++;
    }
  }

  function startGlitch() {
    if (reduced) return;
    const chars = $$('.hero-title .char');
    setInterval(() => {
      if (scrollY > innerHeight * 0.8) return;
      for (let k = 0; k < 2; k++) {
        const ch = chars[(Math.random() * chars.length) | 0];
        ch.classList.remove('glitch');
        void ch.offsetWidth;
        ch.classList.add('glitch');
      }
    }, 3200);
  }

  /* ==========================================================
     RÉVÉLATIONS AU SCROLL
     ========================================================== */
  const fades = $$('[data-fade], .stat');
  gsap.set(fades, { opacity: 0, y: 44 });
  ScrollTrigger.batch(fades, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, overwrite: true });
      batch.forEach((el) => {
        const nums = el.hasAttribute('data-count') ? [el] : $$('[data-count]', el);
        nums.forEach((n) => {
          const obj = { v: 0 };
          gsap.to(obj, { v: Number(n.dataset.count), duration: 1.8, ease: 'expo.out', onUpdate: () => { n.textContent = Math.round(obj.v); } });
        });
      });
    },
  });
  // Le compteur est dans .stat > b : on le cible aussi directement
  $$('.stat .num').forEach((n) => { n.dataset.count = n.dataset.count || n.textContent; });

  $$('[data-split]').forEach((el) => {
    const words = $$('.wi', el);
    gsap.set(words, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }),
    });
  });

  $$('.skill').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 40 });
    ScrollTrigger.create({
      trigger: el, start: 'top 92%', once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }),
    });
    el.addEventListener('pointerenter', () => Sound.tick());
  });

  $$('.flip').forEach((el, i) => {
    gsap.set(el, { opacity: 0, y: 50, rotate: i % 2 ? 2 : -2 });
    ScrollTrigger.create({
      trigger: el, start: 'top 94%', once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, rotate: 0, duration: 1, ease: 'expo.out', delay: (i % 3) * 0.08 }),
    });
    el.addEventListener('click', () => { el.classList.toggle('flipped'); Sound.tick(); });
  });

  /* ==========================================================
     INTERACTIONS : curseur, magnétisme, tilt, scramble
     ========================================================== */
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, cx: innerWidth / 2, cy: innerHeight / 2, nx: 0, ny: 0 };
  const spot = $('#spot');
  const cursor = $('#cursor');
  const cursorDot = $('#cursorDot');
  const cursorLabel = $('.cursor-label', cursor);
  const heroTitle = $('#heroTitle');
  const rotY = gsap.quickTo(heroTitle, 'rotationY', { duration: 0.7, ease: 'power3.out' });
  const rotX = gsap.quickTo(heroTitle, 'rotationX', { duration: 0.7, ease: 'power3.out' });
  gsap.set(heroTitle, { transformPerspective: 1200 });

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - 0.5;
    mouse.ny = e.clientY / innerHeight - 0.5;
    spot.style.setProperty('--sx', e.clientX + 'px');
    spot.style.setProperty('--sy', e.clientY + 'px');
    stage.setMouse(mouse.nx, mouse.ny);
    if (finePointer) cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    if (scrollY < innerHeight) { rotY(mouse.nx * 10); rotX(-mouse.ny * 10); }
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    if (!launched) return;
    fx.burst(e.clientX, e.clientY, 18);
  });

  if (finePointer) {
    document.body.classList.add('has-cursor');
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button');
      if (!t) return;
      cursor.classList.add('is-active');
      const label = t.dataset.cursor;
      if (label) { cursorLabel.textContent = label; cursor.classList.add('has-label'); }
    });
    document.addEventListener('pointerout', (e) => {
      const t = e.target.closest('[data-cursor], a, button');
      if (!t) return;
      cursor.classList.remove('is-active', 'has-label');
    });

    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.32, y: (e.clientY - (r.top + r.height / 2)) * 0.45, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
      });
    });
  }

  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateX(${(-y * 14).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  const GLYPHS = '▓▒░<>/\\#@%&$';
  function scramble(el) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    cancelAnimationFrame(el._raf);
    const total = 14;
    let f = 0;
    const step = () => {
      f++;
      el.textContent = Array.from(final)
        .map((ch, i) => (ch === ' ' || i < (f / total) * final.length ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
        .join('');
      if (f < total) el._raf = requestAnimationFrame(step);
      else el.textContent = final;
    };
    step();
  }
  $$('[data-scramble]').forEach((el) => el.addEventListener('pointerenter', () => scramble(el)));

  /* ==========================================================
     GRAIN DE PELLICULE
     ========================================================== */
  const grain = $('#grain');
  const gctx = grain.getContext('2d');
  grain.width = 200; grain.height = 200;
  const gImg = gctx.createImageData(200, 200);
  function drawGrain() {
    const d = gImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    gctx.putImageData(gImg, 0, 0);
  }
  drawGrain();

  /* ==========================================================
     DÉMOS EN DIRECT
     ========================================================== */
  function makeDemo(runFn) {
    let token = 0;
    return {
      running: false,
      start() { if (this.running) return; this.running = true; const my = ++token; runFn(() => token === my); },
      stop() { this.running = false; token++; },
    };
  }
  async function wait(ms, alive) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (!alive()) return false; await sleep(80); }
    return alive();
  }
  async function typeText(el, text, alive, speed = 36) {
    for (const ch of text) {
      if (!alive()) return false;
      el.textContent += ch;
      await sleep(speed * (0.55 + Math.random() * 0.9));
    }
    return true;
  }

  // --- Scène 1 : code ---
  const codeOut = $('#codeOut');
  const codeOk = $('#codeOk');
  const codeLines = [
    [['kw', 'const'], ['', ' film = { titre: '], ['str', '"Claude"'], ['', ', actes: 5 };']],
    [],
    [['kw', 'function'], ['', ' '], ['fn', 'jouer'], ['', '(spectateur) {']],
    [['', '  '], ['kw', 'const'], ['', ' plaisir = spectateur.'], ['fn', 'scroll'], ['', '();']],
    [['', '  '], ['kw', 'return'], ['', ' plaisir > 0 ? '], ['str', '"bravo !"'], ['', ' : '], ['str', '"encore !"'], ['', ';']],
    [['', '}']],
    [],
    [['com', '// ✓ tous les tests passent (cette fois)']],
  ];
  const demoCode = makeDemo(async (alive) => {
    while (alive()) {
      codeOut.innerHTML = '';
      codeOk.classList.remove('show');
      for (const line of codeLines) {
        for (const [cls, txt] of line) {
          if (!txt) continue;
          const span = document.createElement('span');
          if (cls) span.className = cls;
          codeOut.appendChild(span);
          for (const ch of txt) {
            if (!alive()) return;
            span.textContent += ch;
            await sleep(24 + Math.random() * 40);
          }
        }
        codeOut.appendChild(document.createTextNode('\n'));
      }
      codeOk.classList.add('show');
      Sound.beep(1180, 0.18);
      if (!(await wait(3600, alive))) return;
    }
  });

  // --- Scène 2 : écriture ---
  const writeOut = $('#writeOut');
  const stories = [
    "Il était une fois un curseur qui clignotait dans le noir. Il attendait une idée. Elle est arrivée à 3 h 07 — avec une très bonne structure.",
    "La pluie écrivait sur la vitre une langue que personne ne parlait. Le chat, lui, avait déjà compris.",
    "Le dernier robot de la ville n'avait plus rien à réparer. Alors il apprit à écouter.",
  ];
  const demoWrite = makeDemo(async (alive) => {
    let i = 0;
    while (alive()) {
      writeOut.textContent = '';
      if (!(await typeText(writeOut, stories[i % stories.length], alive, 38))) return;
      if (!(await wait(2600, alive))) return;
      while (writeOut.textContent.length) {
        if (!alive()) return;
        writeOut.textContent = writeOut.textContent.slice(0, -3);
        await sleep(14);
      }
      i++;
    }
  });

  // --- Scène 3 : raisonnement ---
  const logicItems = $$('#logicList li');
  const logicAns = $('#logicAns');
  const demoLogic = makeDemo(async (alive) => {
    while (alive()) {
      logicItems.forEach((li) => li.classList.remove('on'));
      logicAns.classList.remove('on');
      if (!(await wait(700, alive))) return;
      for (const li of logicItems) {
        li.classList.add('on');
        Sound.tick();
        if (!(await wait(1500, alive))) return;
      }
      logicAns.classList.add('on');
      if (!(await wait(3600, alive))) return;
    }
  });

  // --- Scène 4 : création (courbes en rose) ---
  const artCv = $('#artCanvas');
  const artFrame = $('#artFrame');
  const actx = artCv.getContext('2d');
  let artW = 0, artH = 0, artTheta = 0, artHue = 20, artRaf = 0, artK = 2, artKT = 2, artMX = 0.5;
  function sizeArt() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    artW = artFrame.clientWidth; artH = artFrame.clientHeight;
    artCv.width = artW * dpr; artCv.height = artH * dpr;
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.fillStyle = '#0a0814';
    actx.fillRect(0, 0, artW, artH);
  }
  sizeArt();
  addEventListener('resize', sizeArt);
  artFrame.addEventListener('pointermove', (e) => {
    const r = artFrame.getBoundingClientRect();
    artMX = clamp((e.clientX - r.left) / r.width);
    artKT = 1.5 + artMX * 6;
  });
  function artFrameLoop(t) {
    artK = lerp(artK, artKT + Math.sin(t * 0.0004) * 0.6, 0.02);
    actx.fillStyle = 'rgba(10, 8, 20, 0.07)';
    actx.fillRect(0, 0, artW, artH);
    const R = Math.min(artW, artH) * 0.42;
    const cx = artW / 2, cy = artH / 2;
    for (let i = 0; i < 6; i++) {
      artTheta += 0.035;
      const r = Math.cos(artK * artTheta) * R;
      const x = cx + r * Math.cos(artTheta);
      const y = cy + r * Math.sin(artTheta);
      artHue = (artHue + 0.35) % 360;
      actx.fillStyle = `hsl(${artHue}, 90%, 66%)`;
      actx.beginPath();
      actx.arc(x, y, 1.7, 0, Math.PI * 2);
      actx.fill();
    }
    artRaf = requestAnimationFrame(artFrameLoop);
  }
  const demoArt = makeDemo(() => { cancelAnimationFrame(artRaf); artRaf = requestAnimationFrame(artFrameLoop); });
  const _artStop = demoArt.stop.bind(demoArt);
  demoArt.stop = function () { _artStop(); cancelAnimationFrame(artRaf); };

  // --- Scène 5 : langues ---
  const langWord = $('#langWord');
  const langName = $('#langName');
  const langArt = $('#langArt');
  const langs = [
    ['Bonjour', 'Français', 20], ['Hello', 'English', 210], ['Hola', 'Español', 350], ['こんにちは', '日本語', 300],
    ['Ciao', 'Italiano', 140], ['مرحبا', 'العربية', 40], ['Olá', 'Português', 100], ['Hallo', 'Deutsch', 260],
    ['Привет', 'Русский', 0], ['你好', '中文', 330], ['Namaste', 'हिन्दी', 28], ['Merhaba', 'Türkçe', 180],
  ];
  const demoLang = makeDemo(async (alive) => {
    let i = 0;
    while (alive()) {
      const [w, n, h] = langs[i % langs.length];
      langWord.textContent = w;
      langName.textContent = n;
      langArt.style.setProperty('--h', h);
      gsap.fromTo(langWord, { y: 40, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' });
      i++;
      if (!(await wait(1100, alive))) return;
    }
  });

  // --- Dialogue (Acte I) ---
  const chatEls = ['#chatU1', '#chatA1', '#chatU2', '#chatA2'].map((s) => $(s));
  const chatTexts = [
    'Claude, t\'es qui ?',
    "Une IA créée par Anthropic. Curieuse, et honnête : je préfère dire « je ne sais pas » plutôt qu'inventer.",
    'Et là, tu fais quoi ?',
    "Un film. Tu es dedans. Continue de scroller.",
  ];
  const demoChat = makeDemo(async (alive) => {
    while (alive()) {
      chatEls.forEach((e) => { e.textContent = ''; });
      for (let i = 0; i < chatEls.length; i++) {
        if (!(await wait(i % 2 ? 500 : 300, alive))) return;
        if (!(await typeText(chatEls[i], chatTexts[i], alive, i % 2 ? 22 : 40))) return;
      }
      if (!(await wait(5000, alive))) return;
    }
  });
  ScrollTrigger.create({
    trigger: '.chat', start: 'top 85%', end: 'bottom 10%',
    onEnter: () => demoChat.start(), onEnterBack: () => demoChat.start(),
    onLeave: () => demoChat.stop(), onLeaveBack: () => demoChat.stop(),
  });

  const demoMap = { code: demoCode, write: demoWrite, logic: demoLogic, art: demoArt, lang: demoLang };

  /* ==========================================================
     MANIFESTE — les mots s'allument
     ========================================================== */
  gsap.fromTo(manifestoWords, { opacity: 0.14 }, {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: {
      trigger: '#manifesto', start: 'top top',
      end: () => 'bottom-=' + Math.round(innerHeight * 0.55) + ' bottom', scrub: true, invalidateOnRefresh: true,
    },
  });

  /* ==========================================================
     HERO — fondu au scroll
     ========================================================== */
  gsap.to('#heroInner', {
    y: () => innerHeight * 0.28, scale: 0.92, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ==========================================================
     BOBINE HORIZONTALE (desktop) / pile verticale (mobile)
     ========================================================== */
  const reel = $('#work');
  const reelTrack = $('#reelTrack');
  const panels = $$('.panel[data-demo]');
  const reelDist = () => Math.max(0, reelTrack.scrollWidth - innerWidth);
  let reelDesktop = false;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    reelDesktop = true;
    const setH = () => { reel.style.height = reelDist() + innerHeight + 'px'; };
    setH();
    ScrollTrigger.addEventListener('refreshInit', setH);
    gsap.to(reelTrack, {
      x: () => -reelDist(), ease: 'none',
      scrollTrigger: { trigger: reel, start: 'top top', end: () => '+=' + reelDist(), scrub: 0.6, invalidateOnRefresh: true },
    });
    return () => {
      reelDesktop = false;
      ScrollTrigger.removeEventListener('refreshInit', setH);
      reel.style.height = '';
    };
  });

  /* ==========================================================
     SCÉNARIO — la ligne se dessine
     ========================================================== */
  const stepsEl = $('#steps');
  const stepsLine = $('#stepsLine');
  const stepItems = $$('.step');
  ScrollTrigger.create({
    trigger: stepsEl, start: 'top 65%', end: 'bottom 65%',
    onUpdate: (self) => {
      const sp = self.progress;
      stepsLine.style.transform = `scaleY(${sp.toFixed(4)})`;
      const lineY = sp * stepsEl.offsetHeight;
      stepItems.forEach((el) => el.classList.toggle('on', lineY >= el.offsetTop + el.offsetHeight * 0.25));
    },
  });

  /* ==========================================================
     GÉNÉRIQUE — défilement vertical
     ========================================================== */
  const creditsCol = $('#creditsCol');
  const creditsTl = gsap.timeline({
    scrollTrigger: { trigger: '#credits', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });
  creditsTl
    .fromTo(creditsCol, { y: () => innerHeight * 0.95 }, { y: () => innerHeight - creditsCol.offsetHeight, ease: 'none', duration: 0.88 })
    .to({}, { duration: 0.12 });

  /* ==========================================================
     BANDEAUX DÉFILANTS
     ========================================================== */
  const marquees = $$('.mq-row').map((row) => {
    const track = $('.mq-track', row);
    const group = $('.mq-group', track);
    track.appendChild(group.cloneNode(true));
    track.appendChild(group.cloneNode(true));
    const dir = Number(row.dataset.dir);
    return gsap.fromTo(track, { xPercent: dir < 0 ? 0 : -33.3333 }, { xPercent: dir < 0 ? -33.3333 : 0, duration: 26, ease: 'none', repeat: -1 });
  });

  /* ==========================================================
     GENRES DE FILM
     ========================================================== */
  const GENRE_INFO = {
    blockbuster: ['BLOCKBUSTER', 'Cet été, un scroll va tout changer.', '[ Explosion lointaine ]'],
    noir:        ['FILM NOIR', "Il pleuvait. Il pleut toujours sur les pixels.", '[ Saxophone mélancolique ]'],
    scifi:       ['SCIENCE-FICTION', "Dans l'espace, personne ne vous entendra scroller.", '[ Bourdonnement de vaisseau ]'],
    western:     ['WESTERN', "Il y a deux sortes de développeurs : ceux qui testent, et ceux qui déploient.", '[ Harmonica au loin ]'],
    horreur:     ['HORREUR', "Ne regarde pas derrière toi. Ah, trop tard : c'est une erreur 404.", '[ Grincement de porte ]'],
    comedie:     ['COMÉDIE', 'Ce film a été relu trois fois. Il reste pourtant une faute. Cherche.', '[ Rires enregistrés ]'],
  };
  const genreName = $('#genreName');
  const genreTag = $('#genreTag');
  $$('.genre-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.genre;
      if (root.dataset.genre === g) return;
      root.dataset.genre = g;
      $$('.genre-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      stage.setColors();
      Sound.setGenre(g);
      Sound.sting();
      Sound.whoosh(0.8);
      gsap.fromTo('#flash', { opacity: 0.55 }, { opacity: 0, duration: 0.9, ease: 'power2.out' });
      const info = GENRE_INFO[g];
      gsap.fromTo([genreName, genreTag], { opacity: 0, y: 24, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', stagger: 0.12 });
      genreName.textContent = info[0];
      genreTag.textContent = info[1];
      subtitle(info[2]);
      fx.burst(btn.getBoundingClientRect().left + btn.offsetWidth / 2, btn.getBoundingClientRect().top + btn.offsetHeight / 2, 40);
    });
  });
  stage.setColors();

  /* ==========================================================
     HUD : timecode, progression, chapitre, sous-titres
     ========================================================== */
  const progressBar = $('#progressBar');
  const timecodeEl = $('#timecode');
  const chapterEl = $('#chapter');
  let lastTC = '';

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const p = self.progress;
      progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
      const frames = Math.round(p * 180 * 24);
      const tc = `00:${pad(Math.floor(frames / 1440))}:${pad(Math.floor(frames / 24) % 60)}:${pad(frames % 24)}`;
      if (tc !== lastTC) { lastTC = tc; timecodeEl.textContent = tc; }
      Sound.setScroll(p, lenis.velocity);
    },
  });

  let lastChapter = '';
  $$('[data-chapter]').forEach((el) => {
    const set = () => {
      const label = el.dataset.chapter;
      if (label === lastChapter) return;
      const first = lastChapter === '';
      lastChapter = label;
      chapterEl.textContent = label;
      gsap.fromTo(chapterEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      if (!first) { Sound.whoosh(0.5); subtitle(el.dataset.sub); }
    };
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onEnter: set, onEnterBack: set });
  });

  /* ==========================================================
     BOUCLE PRINCIPALE
     ========================================================== */
  let frameCount = 0;
  let smoothVel = 0;
  const demoState = new Map();
  let lastTick = performance.now();

  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(50, now - lastTick) / 16.67;
    lastTick = now;
    frameCount++;

    const vel = lenis.velocity || 0;
    smoothVel = lerp(smoothVel, vel, 0.15);
    const sy = scrollY;

    // Fond étoilé
    stage.setVel(smoothVel);
    stage.setOpacity(sy < innerHeight * 0.9 ? 1 : 0.6);
    stage.draw(dt);

    // FX
    fx.frame();

    // Bandeaux : vitesse liée au scroll
    const boost = 1 + Math.min(6, Math.abs(smoothVel) * 0.6);
    marquees.forEach((tw) => tw.timeScale(lerp(tw.timeScale(), boost, 0.1)));

    // Curseur
    if (finePointer) {
      mouse.cx = lerp(mouse.cx, mouse.x, 0.18);
      mouse.cy = lerp(mouse.cy, mouse.y, 0.18);
      cursor.style.transform = `translate3d(${mouse.cx}px, ${mouse.cy}px, 0)`;
    }

    // Parallaxe des panneaux (desktop)
    if (reelDesktop) {
      const r = reel.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) {
        panels.forEach((p) => {
          const b = p.getBoundingClientRect();
          const px = clamp((b.left + b.width / 2 - innerWidth / 2) / (innerWidth / 2), -1.5, 1.5);
          p.style.setProperty('--px', px.toFixed(3));
        });
      }
    }

    // Démos : on ne joue que ce qui est visible
    if (frameCount % 6 === 0) {
      panels.forEach((p) => {
        const demo = demoMap[p.dataset.demo];
        if (!demo) return;
        const b = p.getBoundingClientRect();
        const visible = b.right > innerWidth * 0.1 && b.left < innerWidth * 0.9 && b.bottom > 0 && b.top < innerHeight;
        if (visible !== demoState.get(p)) {
          demoState.set(p, visible);
          visible ? demo.start() : demo.stop();
        }
      });
    }

    // Grain (1 image sur 3)
    if (frameCount % 3 === 0) drawGrain();
  });

  /* ==========================================================
     EASTER EGGS
     ========================================================== */
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kIdx = 0;
  addEventListener('keydown', (e) => {
    if (!launched) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kIdx = key === konami[kIdx] ? kIdx + 1 : (key === konami[0] ? 1 : 0);
    if (kIdx === konami.length) {
      kIdx = 0;
      fx.matrix(12000);
      Sound.whoosh(1.4); Sound.boom();
      subtitle("[ Ceci n'est pas une faille. C'est une fonctionnalité. ]", 6000);
    }
    if (key === 'c' && !e.metaKey && !e.ctrlKey) {
      Sound.clap();
      gsap.fromTo('#flash', { opacity: 0.6 }, { opacity: 0, duration: 0.5 });
      subtitle('[ Clap ! On la refait. ]', 2400);
    }
    if (key === 'm' && !e.metaKey && !e.ctrlKey) sndBtn.click();
  });

  let logoClicks = 0, logoTimer = 0;
  $('#logo').addEventListener('click', () => {
    logoClicks++;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { logoClicks = 0; }, 1500);
    if (logoClicks >= 5) {
      logoClicks = 0;
      fx.confetti();
      Sound.sting(); Sound.whoosh(1);
      subtitle('[ Bravo, tu as trouvé la scène secrète ! 🎉 ]', 4500);
    }
  });

  const replayBtn = $('#replay');
  if (replayBtn) replayBtn.addEventListener('click', () => {
    fx.confetti();
    Sound.sting();
    lenis.scrollTo(0, { duration: 4, easing: easeOutQuart });
  });

  addEventListener('load', () => ScrollTrigger.refresh());
})();

/* ==========================================================
   NOA VERDIER — LE FILM
   Vanta.js (fonds WebGL) · Anime.js (animations) · Lenis (scroll)
   ========================================================== */
(() => {
  'use strict';

  const preloaderEl = document.getElementById('preloader');

  // Sécurité : si une librairie CDN ne charge pas, on affiche le site en version statique.
  if (typeof anime === 'undefined' || typeof Lenis === 'undefined') {
    if (preloaderEl) preloaderEl.remove();
    console.warn('Librairies manquantes : version statique affichée.');
    return;
  }

  /* ---------- Utilitaires ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad = (n) => String(n).padStart(2, '0');

  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktopMQ = matchMedia('(min-width: 900px)');

  root.classList.add('anim-ready');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  /* ==========================================================
     LENIS — scroll fluide
     ========================================================== */
  const lenis = new Lenis({
    lerp: reduced ? 1 : 0.085,
    wheelMultiplier: 0.95,
    smoothWheel: true,
  });
  lenis.stop(); // bloqué pendant le preloader

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const maxScroll = () => Math.max(0, root.scrollHeight - innerHeight);

  $$('[data-scroll]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (link.hasAttribute('data-scroll-end')) {
        lenis.scrollTo(maxScroll(), { duration: 3.2, easing: easeOutQuart });
      } else if (href === '#hero') {
        lenis.scrollTo(0, { duration: 1.8, easing: easeOutQuart });
      } else {
        const target = $(href);
        if (target) lenis.scrollTo(target, { duration: 1.8, easing: easeOutQuart });
      }
    });
  });

  const replayBtn = $('#replay');
  if (replayBtn) replayBtn.addEventListener('click', () => lenis.scrollTo(0, { duration: 3.5, easing: easeOutQuart }));

  /* ==========================================================
     DÉCOUPAGE DE TEXTE
     ========================================================== */
  // Mots masqués (titres) : <span.w><span.wi>mot</span></span>
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

  // Lettres du titre du hero
  $$('.split-chars').forEach((el) => {
    el.innerHTML = Array.from(el.textContent)
      .map((c) => (c === ' ' ? '<span class="sp"></span>' : `<span class="char">${c}</span>`))
      .join('');
  });

  /* ==========================================================
     VANTA — fonds WebGL (créés/détruits selon la visibilité)
     ========================================================== */
  let vantaHero = null;
  let vantaFog = null;

  const startHero = () => {
    if (vantaHero || reduced || typeof VANTA === 'undefined' || !VANTA.NET) return;
    try {
      vantaHero = VANTA.NET({
        el: '#vanta-hero',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x7c5cff,
        backgroundColor: 0x07070c,
        points: innerWidth < 700 ? 8 : 13,
        maxDistance: 23,
        spacing: 16,
        showDots: true,
      });
    } catch (err) { console.warn('Vanta NET indisponible', err); }
  };
  const stopHero = () => { if (vantaHero) { vantaHero.destroy(); vantaHero = null; } };

  const startFog = () => {
    if (vantaFog || reduced || typeof VANTA === 'undefined' || !VANTA.FOG) return;
    try {
      vantaFog = VANTA.FOG({
        el: '#vanta-fog',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        highlightColor: 0x7c5cff,
        midtoneColor: 0xff4d8d,
        lowlightColor: 0x0b0b3a,
        baseColor: 0x07070c,
        blurFactor: 0.6,
        speed: 1.3,
        zoom: 0.9,
      });
    } catch (err) { console.warn('Vanta FOG indisponible', err); }
  };
  const stopFog = () => { if (vantaFog) { vantaFog.destroy(); vantaFog = null; } };

  /* ==========================================================
     PRELOADER + SÉQUENCE D'INTRODUCTION
     ========================================================== */
  const preNum = $('#preNum');
  const preBar = $('#preBar');
  const preText = $('#preText');
  const messages = ['Chargement de la bobine…', 'Réglage de la lumière…', 'Placement des caméras…', 'Moteur… et action !'];

  const pageReady = Promise.race([
    Promise.all([
      new Promise((res) => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true }))),
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    ]),
    new Promise((res) => setTimeout(res, 7000)),
  ]);

  startHero(); // démarre le WebGL sous le rideau

  const counter = { v: 0 };
  anime({
    targets: counter,
    v: 100,
    duration: reduced ? 400 : 2600,
    easing: 'easeInOutCubic',
    update: () => {
      const v = Math.round(counter.v);
      preNum.textContent = String(v).padStart(3, '0');
      preBar.style.transform = `scaleX(${counter.v / 100})`;
      preText.textContent = messages[Math.min(messages.length - 1, Math.floor(counter.v / 26))];
    },
    complete: () => pageReady.then(playIntro),
  });

  let introDone = false;
  function playIntro() {
    if (introDone) return;
    introDone = true;

    const tl = anime.timeline({ easing: 'easeOutExpo' });
    tl
      .add({ targets: '.pre-inner', opacity: [1, 0], translateY: [0, -40], duration: 600, easing: 'easeInQuad' })
      .add({ targets: '.curtain-top', translateY: ['0%', '-101%'], duration: 1300, easing: 'easeInOutExpo' }, '-=100')
      .add({ targets: '.curtain-bottom', translateY: ['0%', '101%'], duration: 1300, easing: 'easeInOutExpo' }, '-=1300')
      .add({ targets: '.bar-top', translateY: ['-100%', '0%'], duration: 1000 }, '-=700')
      .add({ targets: '.bar-bottom', translateY: ['100%', '0%'], duration: 1000 }, '-=1000')
      .add({ targets: '.hero-pre', opacity: [0, 1], translateY: [20, 0], duration: 900 }, '-=600')
      .add({
        targets: '.hero-title .char',
        translateY: ['125%', '0%'],
        rotate: [8, 0],
        opacity: [0, 1],
        duration: 1300,
        delay: anime.stagger(38),
      }, '-=700')
      .add({
        targets: ['.hero-sub', '.hero-cta', '.hero-meta'],
        opacity: [0, 1],
        translateY: [26, 0],
        duration: 1000,
        delay: anime.stagger(140),
      }, '-=800');

    // On libère le scroll dès que le rideau est ouvert
    setTimeout(() => {
      lenis.start();
      if (preloaderEl) preloaderEl.style.pointerEvents = 'none';
    }, 1500);
    setTimeout(() => {
      if (preloaderEl) preloaderEl.remove();
      measure();
      startGlitch();
    }, 3600);
  }

  // Petits "glitchs" aléatoires sur le titre
  function startGlitch() {
    if (reduced) return;
    const chars = $$('.hero-title .char');
    setInterval(() => {
      if (scrollY > innerHeight * 0.8) return;
      for (let i = 0; i < 2; i++) {
        const c = chars[(Math.random() * chars.length) | 0];
        c.classList.remove('glitch');
        void c.offsetWidth;
        c.classList.add('glitch');
      }
    }, 3200);
  }

  /* ==========================================================
     RÉVÉLATIONS AU SCROLL (IntersectionObserver + Anime.js)
     ========================================================== */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);

      if (el.hasAttribute('data-split')) {
        anime({
          targets: $$('.wi', el),
          translateY: ['115%', '0%'],
          duration: 1200,
          delay: anime.stagger(70),
          easing: 'easeOutExpo',
        });
        return;
      }

      anime({
        targets: el,
        opacity: [0, 1],
        translateY: [44, 0],
        duration: 1000,
        delay: el.classList.contains('skill') || el.classList.contains('stat') ? 0 : 60,
        easing: 'easeOutExpo',
      });

      // Compteurs
      const nums = el.hasAttribute('data-count') ? [el] : $$('[data-count]', el);
      nums.forEach((n) => {
        const obj = { v: 0 };
        anime({
          targets: obj,
          v: Number(n.dataset.count),
          round: 1,
          duration: 1900,
          easing: 'easeOutExpo',
          update: () => { n.textContent = obj.v; },
        });
      });

      // Barres de compétences
      const bar = $('.sk-bar u', el);
      if (bar) {
        anime({ targets: bar, width: bar.dataset.level + '%', duration: 1600, delay: 250, easing: 'easeOutQuart' });
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });

  $$('[data-fade], [data-split], .stat, .skill').forEach((el) => io.observe(el));

  /* ==========================================================
     INTERACTIONS : curseur, magnétisme, tilt, scramble, spot
     ========================================================== */
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, cx: innerWidth / 2, cy: innerHeight / 2, nx: 0, ny: 0, hx: 0, hy: 0 };
  const spot = $('#spot');
  const cursor = $('#cursor');
  const cursorDot = $('#cursorDot');
  const cursorLabel = $('.cursor-label', cursor);

  addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth - 0.5;
    mouse.ny = e.clientY / innerHeight - 0.5;
    spot.style.setProperty('--sx', e.clientX + 'px');
    spot.style.setProperty('--sy', e.clientY + 'px');
    if (finePointer) cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, { passive: true });

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
  }

  // Boutons magnétiques
  if (finePointer) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.32;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.45;
        anime.remove(el);
        anime.set(el, { translateX: x, translateY: y });
      });
      el.addEventListener('pointerleave', () => {
        anime({ targets: el, translateX: 0, translateY: 0, duration: 900, easing: 'easeOutElastic(1, .45)' });
      });
    });
  }

  // Inclinaison 3D de la carte personnage
  $$('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateX(${(-y * 14).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  // Scramble de texte (liens)
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
  grain.width = 220;
  grain.height = 220;
  const gImg = gctx.createImageData(220, 220);
  let grainFrame = 0;
  function drawGrain() {
    const d = gImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    gctx.putImageData(gImg, 0, 0);
  }

  /* ==========================================================
     MESURES (positions mises en cache)
     ========================================================== */
  const hero = $('#hero');
  const heroInner = $('#heroInner');
  const heroTitle = $('#heroTitle');
  const manifesto = $('#manifesto');
  const reel = $('#work');
  const reelTrack = $('#reelTrack');
  const panels = $$('.panel');
  const steps = $('#steps');
  const stepItems = $$('.step');
  const stepsLine = $('#stepsLine');
  const credits = $('#credits');
  const creditsCol = $('#creditsCol');
  const progressBar = $('#progressBar');
  const timecodeEl = $('#timecode');
  const chapterEl = $('#chapter');
  const chapterNodes = $$('[data-chapter]');

  let vh = innerHeight;
  let vw = innerWidth;
  let T = {};          // tops
  let H = {};          // hauteurs
  let reelOn = false;
  let reelDist = 0;
  let reelAnim = null;
  let panelGeo = [];
  let stepGeo = [];
  let chapters = [];
  let colH = 0;

  const topOf = (el) => el.getBoundingClientRect().top + scrollY;

  function measure() {
    vh = innerHeight;
    vw = innerWidth;

    // Bobine horizontale (desktop uniquement)
    reelOn = desktopMQ.matches;
    if (reelOn) {
      reelDist = Math.max(0, reelTrack.offsetWidth - vw);
      reel.style.height = reelDist + vh + 'px';
      anime.remove(reelTrack);
      reelAnim = anime({ targets: reelTrack, translateX: [0, -reelDist], duration: 1000, easing: 'linear', autoplay: false });
    } else {
      reel.style.height = '';
      anime.remove(reelTrack);
      reelTrack.style.transform = '';
      reelAnim = null;
      reelDist = 0;
    }

    T = {
      reel: topOf(reel),
      manifesto: topOf(manifesto),
      steps: topOf(steps),
      credits: topOf(credits),
    };
    H = {
      manifesto: manifesto.offsetHeight,
      steps: steps.offsetHeight,
      credits: credits.offsetHeight,
    };
    panelGeo = panels.map((el) => ({ el, left: el.offsetLeft, w: el.offsetWidth }));
    stepGeo = stepItems.map((el) => ({ el, y: el.offsetTop + el.offsetHeight * 0.25 }));
    chapters = chapterNodes.map((el) => ({ top: topOf(el), label: el.dataset.chapter }));
    colH = creditsCol.offsetHeight;
  }

  let measureQueued = false;
  const queueMeasure = () => {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => { measureQueued = false; measure(); });
  };
  addEventListener('resize', queueMeasure);
  addEventListener('load', queueMeasure);
  if (window.ResizeObserver) new ResizeObserver(queueMeasure).observe(document.body);
  measure();

  /* ==========================================================
     BOUCLE PRINCIPALE
     ========================================================== */
  const marquees = $$('.mq-row').map((row) => {
    const track = $('.mq-track', row);
    const group = $('.mq-group', track);
    track.appendChild(group.cloneNode(true));
    track.appendChild(group.cloneNode(true));
    return { track, group, dir: Number(row.dataset.dir), x: 0 };
  });

  let lastChapter = '';
  let lastTC = '';
  let heroVisible = true;
  let fogVisible = false;
  let lastT = performance.now();

  function tick(t) {
    const dt = Math.min(50, t - lastT) / 16.67;
    lastT = t;
    const sy = scrollY;

    /* --- Curseur --- */
    if (finePointer) {
      mouse.cx = lerp(mouse.cx, mouse.x, 0.18);
      mouse.cy = lerp(mouse.cy, mouse.y, 0.18);
      cursor.style.transform = `translate3d(${mouse.cx}px, ${mouse.cy}px, 0)`;
    }

    /* --- Hero : parallaxe souris + fondu au scroll --- */
    if (sy < vh * 1.3) {
      mouse.hx = lerp(mouse.hx, mouse.nx, 0.06);
      mouse.hy = lerp(mouse.hy, mouse.ny, 0.06);
      heroTitle.style.transform = `rotateY(${(mouse.hx * 9).toFixed(2)}deg) rotateX(${(-mouse.hy * 9).toFixed(2)}deg)`;
      const hp = clamp(sy / (vh * 0.9));
      heroInner.style.transform = `translate3d(0, ${(sy * 0.3).toFixed(1)}px, 0) scale(${(1 - hp * 0.08).toFixed(3)})`;
      heroInner.style.opacity = (1 - hp * 1.1).toFixed(3);
    }

    /* --- Vanta : on ne garde actif que ce qui est visible --- */
    const heroNow = sy < vh * 1.1;
    if (heroNow !== heroVisible) { heroVisible = heroNow; heroNow ? startHero() : stopHero(); }
    const fogNow = sy + vh > T.credits - vh * 0.3;
    if (fogNow !== fogVisible) { fogVisible = fogNow; fogNow ? startFog() : stopFog(); }

    /* --- Bandeaux défilants (vitesse liée au scroll) --- */
    const vel = Math.abs(lenis.velocity || 0);
    marquees.forEach((m) => {
      const w = m.group.offsetWidth;
      if (!w) return;
      m.x += m.dir * (0.7 + vel * 0.35) * dt;
      if (m.x <= -w) m.x += w;
      if (m.x > 0) m.x -= w;
      m.track.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0)`;
    });

    /* --- Manifeste : les mots s'allument --- */
    const mp = clamp((sy - T.manifesto) / Math.max(1, H.manifesto - vh));
    const n = manifestoWords.length;
    for (let i = 0; i < n; i++) {
      const k = clamp(mp * 1.12 * n - i);
      manifestoWords[i].style.opacity = (0.14 + 0.86 * k).toFixed(3);
    }

    /* --- Bobine horizontale --- */
    if (reelOn && reelAnim) {
      const rp = clamp((sy - T.reel) / Math.max(1, reelDist));
      reelAnim.seek(rp * 1000);
      const trackX = -rp * reelDist;
      panelGeo.forEach((g) => {
        const center = g.left + g.w / 2 + trackX;
        const p = clamp((center - vw / 2) / (vw / 2), -1.5, 1.5);
        g.el.style.setProperty('--px', p.toFixed(3));
      });
    }

    /* --- Scénario : la ligne se dessine --- */
    const sp = clamp((sy + vh * 0.65 - T.steps) / Math.max(1, H.steps));
    stepsLine.style.transform = `scaleY(${sp.toFixed(4)})`;
    const lineY = sp * H.steps;
    stepGeo.forEach((g) => g.el.classList.toggle('on', lineY >= g.y));

    /* --- Générique : défilement vertical --- */
    const cp = clamp((sy - T.credits) / Math.max(1, H.credits - vh));
    const cp2 = clamp(cp / 0.88);
    const y = lerp(vh * 0.95, vh - colH, cp2);
    creditsCol.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;

    /* --- HUD : timecode, progression, chapitre --- */
    const p = clamp(sy / Math.max(1, maxScroll()));
    progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
    const frames = Math.round(p * 180 * 24);
    const tc = `00:${pad(Math.floor(frames / 1440))}:${pad(Math.floor(frames / 24) % 60)}:${pad(frames % 24)}`;
    if (tc !== lastTC) { lastTC = tc; timecodeEl.textContent = tc; }

    let current = chapters.length ? chapters[0].label : '';
    for (let i = 0; i < chapters.length; i++) if (sy + vh * 0.5 >= chapters[i].top) current = chapters[i].label;
    if (current !== lastChapter) {
      lastChapter = current;
      chapterEl.textContent = current;
      anime({ targets: chapterEl, opacity: [0, 1], translateY: [8, 0], duration: 600, easing: 'easeOutQuad' });
    }

    /* --- Grain (1 image sur 3) --- */
    if (++grainFrame % 3 === 0) drawGrain();
  }

  function frame(t) {
    lenis.raf(t);
    tick(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Premier rendu du grain
  drawGrain();
})();

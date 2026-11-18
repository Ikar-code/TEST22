/* ===== Lenis : smooth scroll ===== */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

document.querySelectorAll('[data-scroll]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo(link.getAttribute('href'), { offset: 0, duration: 1.4 });
  });
});

/* ===== Vanta.js : fond animé du hero ===== */
let vantaEffect = null;
try {
  vantaEffect = VANTA.NET({
    el: '#vanta-bg',
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200,
    minWidth: 200,
    scale: 1.0,
    scaleMobile: 1.0,
    color: 0x7c5cff,
    backgroundColor: 0x0b0b12,
    points: 11,
    maxDistance: 22,
    spacing: 17,
  });
} catch (err) {
  console.warn('Vanta indisponible :', err);
}

/* ===== Anime.js : intro du hero ===== */
const title = document.getElementById('title');
title.innerHTML = title.textContent
  .split('')
  .map((ch) => (ch === ' ' ? '<span class="space"></span>' : `<span class="letter">${ch}</span>`))
  .join('');

anime
  .timeline({ easing: 'easeOutExpo' })
  .add({ targets: '.eyebrow', opacity: [0, 1], translateY: [20, 0], duration: 800 })
  .add(
    {
      targets: '.title .letter',
      opacity: [0, 1],
      translateY: [80, 0],
      rotateZ: [8, 0],
      duration: 1100,
      delay: anime.stagger(55),
    },
    '-=400'
  )
  .add({ targets: '.subtitle', opacity: [0, 1], translateY: [20, 0], duration: 800 }, '-=600')
  .add({ targets: '.btn', opacity: [0, 1], scale: [0.8, 1], duration: 800 }, '-=500');

/* ===== Anime.js : animations au scroll ===== */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      observer.unobserve(el);

      anime({
        targets: el,
        opacity: [0, 1],
        translateY: [50, 0],
        duration: 900,
        easing: 'easeOutCubic',
      });

      // compteurs
      const num = el.querySelector('.num');
      if (num) {
        const obj = { v: 0 };
        anime({
          targets: obj,
          v: Number(num.dataset.count),
          round: 1,
          duration: 1800,
          easing: 'easeOutExpo',
          update: () => (num.textContent = obj.v),
        });
      }

      // barres de compétences
      const bar = el.querySelector('.bar i');
      if (bar) {
        anime({
          targets: bar,
          width: bar.dataset.level + '%',
          duration: 1500,
          delay: 200,
          easing: 'easeOutQuart',
        });
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

/* Nettoyage Vanta (bonne pratique) */
window.addEventListener('beforeunload', () => {
  if (vantaEffect) vantaEffect.destroy();
});

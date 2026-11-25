import './styles/fonts.css';
import './styles/main.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';
import { initCursor } from './modules/cursor.js';
import { initMagnetic } from './modules/magnetic.js';
import { initMap } from './modules/map.js';
import { initForm } from './modules/form.js';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase);
CustomEase.create('expo', '0.16, 1, 0.3, 1');
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 860px)').matches; // WebGL budget only
if (reduced) root.classList.add('reduced');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.body.classList.add('is-loading');
$$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

/* ---------------------------------------------------------------
   Smooth scroll (Lenis) driven by GSAP's ticker
--------------------------------------------------------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToTarget = (target) => {
  let el = target;
  if (el && el !== 0 && el.parentElement?.classList.contains('pin-spacer')) el = el.parentElement;
  if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (el === 0) window.scrollTo({ top: 0 });
  else el.scrollIntoView();
};

/* ---------------------------------------------------------------
   Navigation, mobile menu, anchors
--------------------------------------------------------------- */
const nav = $('[data-nav]');
const burger = $('.nav__burger');
const menu = $('#mobile-menu');
let menuOpen = false;
function toggleMenu(force) {
  menuOpen = force ?? !menuOpen;
  burger.setAttribute('aria-expanded', String(menuOpen));
  burger.setAttribute('aria-label', menuOpen ? 'Close menu' : 'Open menu');
  if (menuOpen) {
    menu.hidden = false;
    nav.classList.remove('is-hidden', 'is-light', 'is-lime');
    lenis?.stop();
    gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo' });
    gsap.from($$('nav a', menu), { yPercent: 60, autoAlpha: 0, duration: 0.8, stagger: 0.05, ease: 'expo', delay: 0.15 });
  } else {
    lenis?.start();
    gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo', onComplete: () => { menu.hidden = true; } });
    ScrollTrigger.update();
  }
}
burger?.addEventListener('click', () => toggleMenu());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (menuOpen) toggleMenu(false);
    scrollToTarget(target);
  });
});

/* ---------------------------------------------------------------
   Boot
--------------------------------------------------------------- */
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const fontsReady = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);

async function loadScenes() {
  const fallback = { hero: { state: { progress: 0, rot: 0, anchors: 0, stir: 0 }, start() {}, stop() {}, resize() {}, render() {} },
    room: { state: { debris: 0, dust: 1, scan: 0, lights: 0, furnish: 0, tags: 0, stamp: 0, orbit: 0 }, start() {}, stop() {}, resize() {}, render() {} } };
  if (!webglOK()) { root.classList.add('no-webgl'); return fallback; }
  try {
    const [{ createHero }, { createRoom }] = await Promise.all([import('./webgl/hero.js'), import('./webgl/room.js')]);
    const hero = createHero($('#hero-canvas'), { isMobile });
    const room = createRoom($('#room-canvas'), { isMobile });
    return { hero, room };
  } catch (err) {
    console.warn('WebGL scenes unavailable:', err);
    root.classList.add('no-webgl');
    return fallback;
  }
}

async function runLoader(ready) {
  const loader = $('.loader');
  if (!loader) return ready;
  if (reduced) { await ready; loader.remove(); return; }
  const num = $('.loader__num'), bar = $('.loader__bar span');
  const c = { v: 0 };
  const paint = () => { num.textContent = String(Math.round(c.v)).padStart(3, '0'); bar.style.transform = `scaleX(${c.v / 100})`; };
  const fill = gsap.to(c, { v: 84, duration: 1.5, ease: 'power2.out', onUpdate: paint });
  await Promise.all([ready, fill]);
  await gsap.to(c, { v: 100, duration: 0.45, ease: 'power2.inOut', onUpdate: paint });
  $('.loader__status').textContent = 'Site cleared';
  const tl = gsap.timeline({ onComplete: () => loader.remove() });
  tl.set('.loader__squeegee', { opacity: 1 }, 0.15)
    .to('.loader__inner', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.15, ease: 'power4.inOut' }, 0.15)
    .to('.loader__squeegee', { bottom: '100%', duration: 1.15, ease: 'power4.inOut' }, 0.15)
    .to('.loader__squeegee', { opacity: 0, duration: 0.2 }, 1.2);
  return new Promise((resolve) => tl.call(resolve, null, 0.75));
}

(async function boot() {
  initCursor();
  initMagnetic();
  initForm();

  const scenesP = loadScenes();
  const ready = Promise.all([scenesP, fontsReady]);
  const loaderDone = runLoader(ready);
  const { hero, room } = await scenesP;
  await fontsReady;

  buildScroll(hero, room);
  initMap({ reduced });

  // render-on-demand: only animate canvases that are on screen
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const r = en.target.classList.contains('hero') ? hero : room;
    if (en.isIntersecting) r.start(); else r.stop();
  }), { rootMargin: '120px' });
  if (reduced) {
    Object.assign(room.state, { debris: 1, dust: 0, scan: 1, lights: 1, furnish: 1, tags: 1, stamp: 1, orbit: 0.5 });
    hero.render(); room.render();
    window.addEventListener('resize', () => { hero.resize(); room.resize(); hero.render(); room.render(); });
  } else {
    io.observe($('.hero')); io.observe($('.process'));
  }
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { hero.resize(); room.resize(); }, 120); });

  await loaderDone;
  intro(hero);
})();

/* ---------------------------------------------------------------
   Intro after the loader wipe
--------------------------------------------------------------- */
let heroSplit;
let introDone = false;
function intro(hero) {
  document.body.classList.remove('is-loading');
  if (reduced) { introDone = true; return; }
  const tl = gsap.timeline({ onComplete: () => lenis?.start() });
  tl.fromTo(heroSplit.chars, { yPercent: 118 }, { yPercent: 0, duration: 1.4, ease: 'expo', stagger: 0.035 }, 0)
    .from(['.hero__eyebrow > *', '.hero__lead', '.hero__ctas', '.hero__meta > span'], { autoAlpha: 0, y: 26, duration: 1.1, ease: 'expo', stagger: 0.06 }, 0.35)
    .from(nav, { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 0.25)
    .fromTo(hero.state, { stirBase: 1.4 }, { stirBase: 0, duration: 3, ease: 'power2.out' }, 0);
  // let people scroll as soon as the headline lands
  tl.call(() => { lenis?.start(); introDone = true; }, null, 0.9);
}

/* ---------------------------------------------------------------
   Scroll choreography
--------------------------------------------------------------- */
function buildScroll(hero, room) {
  const H = hero.state, R = room.state;
  H.stirBase = 0;

  // ---------- split headings ----------
  heroSplit = SplitText.create('.hero__title', { type: 'chars,lines', mask: 'lines', linesClass: 'split-line' });
  if (!reduced) gsap.set(heroSplit.chars, { yPercent: 118 });
  const outroSplit = SplitText.create('.hero__outro-text', { type: 'lines', mask: 'lines', linesClass: 'split-line' });

  if (!reduced) {
    $$('main h2, .footer h2').forEach((h2) => {
      SplitText.create(h2, {
        type: 'words,lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => gsap.from(self.words, { yPercent: 115, duration: 1.2, ease: 'expo', stagger: 0.06, scrollTrigger: { trigger: h2, start: 'top 85%', once: true } }),
      });
    });
  }

  // scroll-velocity → dust stir + marquee + card skew
  let vel = 0;
  gsap.ticker.add(() => {
    vel += ((lenis && lenis.isScrolling ? lenis.velocity : 0) - vel) * 0.15;
    H.stir = (H.stirBase || 0) + Math.min(1.2, Math.abs(vel) / 35);
  });

  if (reduced) {
    $$('.manifesto__text').forEach((el) => el.classList.add('is-static'));
    buildNavThemes();
    return;
  }

  /* ---------- HERO: dust → tower ---------- */
  const heroTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.hero', start: 'top top', end: () => `+=${window.innerHeight * 1.7}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
  });
  heroTl
    .to(heroSplit.lines, { yPercent: -115, duration: 0.22, stagger: 0.05, ease: 'power2.in' }, 0)
    .to(['.hero__eyebrow', '.hero__aside', '.hero__meta'], { autoAlpha: 0, y: -50, duration: 0.2, stagger: 0.02, ease: 'power2.in' }, 0)
    .to(H, { progress: 1, duration: 0.62, ease: 'power1.inOut' }, 0.06)
    .to(H, { rot: Math.PI * 0.8, duration: 1 }, 0)
    .to('.hero__beam', { autoAlpha: 0.25, duration: 0.5 }, 0.1)
    .set('.hero__outro', { autoAlpha: 1 }, 0.62)
    .fromTo(outroSplit.lines, { yPercent: 115 }, { yPercent: 0, duration: 0.2, stagger: 0.05, ease: 'power3.out' }, 0.62)
    .to(H, { anchors: 1, duration: 0.24 }, 0.7)
    .to({}, { duration: 0.1 });

  /* ---------- MANIFESTO: words ink in ---------- */
  const man = SplitText.create('.manifesto__text', { type: 'words', wordsClass: 'word' });
  gsap.to(man.words, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: '.manifesto__text', start: 'top 78%', end: 'bottom 42%', scrub: true } });
  gsap.from('.manifesto__points li', { y: 40, autoAlpha: 0, duration: 1, ease: 'expo', stagger: 0.1, scrollTrigger: { trigger: '.manifesto__points', start: 'top 88%', once: true } });

  /* ---------- PROCESS: the 3D room gets cleaned ---------- */
  const phases = $$('.phase');
  const bars = $$('.phase-bars i');
  const wheel = $$('.phase-count__wheel span');
  let current = 0;
  gsap.set(phases.slice(1), { autoAlpha: 0 });
  const setPhase = (i) => {
    if (i === current) return;
    const prev = phases[current], next = phases[i];
    const dir = i > current ? 1 : -1;
    current = i;
    phases.forEach((p) => p.classList.toggle('is-active', p === next));
    gsap.to(prev, { autoAlpha: 0, y: -24 * dir, duration: 0.35, ease: 'power2.in', overwrite: true });
    gsap.fromTo(next, { autoAlpha: 0, y: 30 * dir }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.2, ease: 'expo', overwrite: true });
    gsap.fromTo($$('li', next), { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.6, delay: 0.35, stagger: 0.07, ease: 'expo' });
    gsap.to(wheel, { yPercent: -100 * i, duration: 0.9, ease: 'expo' });
  };
  const procTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.process', start: 'top top', end: () => `+=${window.innerHeight * 3.2}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => setPhase(Math.min(2, Math.floor(self.progress * 3.001))),
    },
  });
  procTl
    .to(R, { orbit: 1, duration: 3 }, 0)
    .to('.process__hint', { autoAlpha: 0, duration: 0.15 }, 0.1)
    .to(bars[0], { scaleX: 1, duration: 1 }, 0)
    .to(R, { debris: 1, duration: 0.75, ease: 'power1.inOut' }, 0.12)
    .to(R, { dust: 0.45, duration: 0.75 }, 0.12)
    .to(bars[1], { scaleX: 1, duration: 1 }, 1)
    .to(R, { scan: 1, duration: 0.8, ease: 'power1.inOut' }, 1.08)
    .to(R, { dust: 0, duration: 0.6 }, 1.1)
    .to(bars[2], { scaleX: 1, duration: 1 }, 2)
    .to(R, { lights: 1, duration: 0.35 }, 2.06)
    .to(R, { furnish: 1, duration: 0.55 }, 2.1)
    .to(R, { tags: 1, duration: 0.4 }, 2.4)
    .to(R, { stamp: 1, duration: 0.18, ease: 'back.out(2)' }, 2.72)
    .to({}, { duration: 0.1 }, 2.9);

  /* ---------- SERVICES: horizontal track (desktop) ---------- */
  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 861px)', mobile: '(max-width: 860px)' }, (ctx) => {
    const cards = $$('.services__track .card');
    if (ctx.conditions.desktop) {
      const track = $('.services__track');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const bar = $('.services__progress-bar i');
      const horiz = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.services', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }) },
      });
      cards.forEach((card) => {
        const paths = $$('.card__icon path', card);
        if (paths.length) gsap.from(paths, { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: card, containerAnimation: horiz, start: 'left 92%', once: true } });
        gsap.from(card, { scale: 0.86, autoAlpha: 0.25, transformOrigin: '0% 60%', ease: 'none', scrollTrigger: { trigger: card, containerAnimation: horiz, start: 'left 105%', end: 'left 62%', scrub: true } });
      });
      // skew with scroll velocity + 3D hover tilt
      const skew = gsap.quickTo(cards, 'skewX', { duration: 0.5, ease: 'power3' });
      const tick = () => skew(gsap.utils.clamp(-7, 7, -vel * 0.22));
      gsap.ticker.add(tick);
      cards.forEach((card) => {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
        const move = (e) => { const r = card.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 10); rx(-((e.clientY - r.top) / r.height - 0.5) * 10); };
        const leave = () => { rx(0); ry(0); };
        card.addEventListener('pointermove', move); card.addEventListener('pointerleave', leave);
      });
      return () => gsap.ticker.remove(tick);
    }
    cards.forEach((card) => {
      gsap.from(card, { y: 60, autoAlpha: 0, duration: 1, ease: 'expo', scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
      const paths = $$('.card__icon path', card);
      if (paths.length) gsap.from(paths, { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: card, start: 'top 85%', once: true } });
    });
    return undefined;
  });

  /* ---------- STANDARD: stacking cards ---------- */
  const stack = $$('.stack__card');
  stack.forEach((card, i) => {
    gsap.from(card.querySelector('.stack__big'), { yPercent: 30, autoAlpha: 0, duration: 1.2, ease: 'expo', scrollTrigger: { trigger: card, start: 'top 75%', once: true } });
    if (i === stack.length - 1) return;
    gsap.to(card, { scale: 0.9 + i * 0.02, '--dim': 0.28, ease: 'none', scrollTrigger: { trigger: stack[i + 1], start: 'top bottom', end: 'top 25%', scrub: true } });
  });
  const check = $('.stack__big--check');
  if (check) {
    gsap.from($$('circle, path', check), { drawSVG: 0, duration: 1.4, ease: 'power3.inOut', stagger: 0.25, scrollTrigger: { trigger: check, start: 'top 75%', once: true } });
  }

  /* ---------- INDUSTRIES: rows + cursor preview ---------- */
  gsap.from('.ind', { y: 50, autoAlpha: 0, duration: 1, ease: 'expo', stagger: 0.08, scrollTrigger: { trigger: '.ind-list', start: 'top 85%', once: true } });
  const preview = $('.ind-preview');
  if (preview && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const icons = $$('svg', preview);
    const px = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const py = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    const list = $('.ind-list');
    list.addEventListener('pointermove', (e) => { px(e.clientX + 140); py(e.clientY); });
    $$('.ind').forEach((row) => row.addEventListener('pointerenter', () => {
      icons.forEach((s) => s.classList.toggle('is-on', s.dataset.i === row.dataset.icon));
      gsap.to(preview, { autoAlpha: 1, scale: 1, rotation: gsap.utils.random(-7, 7), duration: 0.6, ease: 'expo' });
    }));
    list.addEventListener('pointerleave', () => gsap.to(preview, { autoAlpha: 0, scale: 0.6, duration: 0.4, ease: 'power2.in' }));
  }

  /* ---------- AREAS / FAQ / BID reveals ---------- */
  gsap.from('.region', { y: 30, autoAlpha: 0, duration: 1, ease: 'expo', stagger: 0.1, scrollTrigger: { trigger: '.regions', start: 'top 88%', once: true } });
  gsap.from('.qa', { y: 30, autoAlpha: 0, duration: 1, ease: 'expo', stagger: 0.07, scrollTrigger: { trigger: '.faq__list', start: 'top 85%', once: true } });
  gsap.from('.form', { y: 80, autoAlpha: 0, duration: 1.3, ease: 'expo', scrollTrigger: { trigger: '.bid__grid', start: 'top 80%', once: true } });
  gsap.from('.bid__contact li', { y: 20, autoAlpha: 0, duration: 0.9, ease: 'expo', stagger: 0.08, scrollTrigger: { trigger: '.bid__contact', start: 'top 92%', once: true } });

  // FAQ accordion with height animation
  $$('.qa').forEach((d) => {
    const s = $('summary', d), a = $('.qa__a', d);
    s.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) {
        gsap.to(a, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
      } else {
        d.open = true;
        gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.7, ease: 'expo', onComplete: () => ScrollTrigger.refresh() });
      }
    });
  });

  // marquee reacts to scroll direction/velocity
  const mt = $('.marquee__track');
  if (mt) {
    mt.innerHTML += mt.innerHTML;
    const loop = gsap.to(mt, { xPercent: -50, duration: 30, ease: 'none', repeat: -1 });
    let dir = 1;
    gsap.ticker.add(() => {
      if (Math.abs(vel) > 0.5) dir = vel > 0 ? 1 : -1;
      loop.timeScale(dir * (1 + Math.min(6, Math.abs(vel) * 0.12)));
    });
  }

  // footer wordmark rises letter by letter
  gsap.from('.footer__word span', { yPercent: 100, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: 1 } });

  buildNavThemes();
}

/* ---------------------------------------------------------------
   Nav theme per section, hide-on-scroll, mobile bar
--------------------------------------------------------------- */
function buildNavThemes() {
  const setTheme = (t) => { if (menuOpen) return; nav.classList.toggle('is-light', t === 'light'); nav.classList.toggle('is-lime', t === 'lime'); };
  $$('[data-theme]').forEach((sec) => {
    const trig = sec.parentElement?.classList.contains('pin-spacer') ? sec.parentElement : sec;
    ScrollTrigger.create({ trigger: trig, start: 'top top+=40', end: 'bottom top+=40', onToggle: (self) => self.isActive && setTheme(sec.dataset.theme) });
  });
  const mbar = $('.mbar');
  let nearBid = false;
  ScrollTrigger.create({ trigger: '#bid', start: 'top bottom', end: 'max', onToggle: (self) => { nearBid = self.isActive; } });
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen && introDone) nav.classList.toggle('is-hidden', self.direction === 1 && y > window.innerHeight * 0.9);
      mbar?.classList.toggle('is-on', y > window.innerHeight * 0.6 && !nearBid);
    },
  });
  ScrollTrigger.refresh();
}

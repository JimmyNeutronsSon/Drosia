import gsap from 'gsap';

/** Custom cursor: lerped ring + dot, grows over interactive elements, shows labels via [data-cursor]. */
export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = document.querySelector('.cursor');
  if (!el) return;
  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = el.querySelector('.cursor__label');
  gsap.set([ring, dot], { xPercent: 0, yPercent: 0 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2' });

  window.addEventListener('pointermove', (e) => {
    rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    el.classList.remove('is-hidden');
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));

  const interactive = 'a, button, summary, label, [data-hover], [data-cursor], .ind';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(interactive);
    if (!t) return;
    const text = t.getAttribute('data-cursor');
    if (text) { label.textContent = text; el.classList.add('is-label'); }
    else el.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest(interactive);
    if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    el.classList.remove('is-hover', 'is-label');
  });
}

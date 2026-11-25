import gsap from 'gsap';

/** Magnetic buttons: element and label lean toward the cursor, spring back on leave. */
export function initMagnetic() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const inner = el.querySelector('.btn__label');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3' });
    const iyTo = inner && gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      xTo(mx * 0.3); yTo(my * 0.4);
      if (inner) { ixTo(mx * 0.12); iyTo(my * 0.15); }
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.35)' });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.35)' });
    });
  });
}

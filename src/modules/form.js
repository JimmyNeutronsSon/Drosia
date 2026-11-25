import gsap from 'gsap';

/**
 * Bid request form.
 * - If the <form> has data-endpoint="https://…" (Formspree, Basin, a CRM webhook…), it POSTs JSON there.
 * - Otherwise it falls back to opening the visitor's email app, pre-filled, addressed to hi@verilyclean.net.
 */
export function initForm() {
  const form = document.getElementById('bid-form');
  if (!form) return;
  const note = form.querySelector('.form__note');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector('.btn__label');

  const setNote = (msg) => {
    note.textContent = msg;
    gsap.fromTo(note, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4 });
  };

  form.addEventListener('input', (e) => { if (e.target.matches('[aria-invalid]')) e.target.removeAttribute('aria-invalid'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const missing = [];
    if (!data.name?.trim()) missing.push(form.elements.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) missing.push(form.elements.email);
    if (missing.length) {
      missing.forEach((el) => el.setAttribute('aria-invalid', 'true'));
      missing[0].focus();
      gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      setNote('Please add your name and a valid email so we can send the bid.');
      return;
    }

    const endpoint = form.dataset.endpoint;
    label.textContent = 'Sending…';
    btn.disabled = true;
    try {
      if (endpoint) {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(String(res.status));
        setNote('Thanks — your request is in. We’ll be in touch shortly.');
        form.reset();
      } else {
        const lines = [
          `Name: ${data.name}`, `Company: ${data.company || '-'}`, `Email: ${data.email}`, `Phone: ${data.phone || '-'}`,
          `Service: ${data.service}`, `Location: ${data.location || '-'}`, `Approx. sq ft: ${data.sqft || '-'}`, '', data.details || '',
        ];
        const href = `mailto:hi@verilyclean.net?subject=${encodeURIComponent(`Bid request — ${data.service}`)}&body=${encodeURIComponent(lines.join('\n'))}`;
        window.location.href = href;
        setNote('Opening your email app with the details filled in. Prefer to talk? Call 425-609-0830.');
      }
      label.textContent = 'Request sent ✓';
    } catch {
      setNote('Something went wrong. Please call 425-609-0830 or email hi@verilyclean.net.');
      label.textContent = 'Request my bid';
    } finally {
      btn.disabled = false;
      setTimeout(() => { label.textContent = 'Request my bid'; }, 4000);
    }
  });
}

// Runs on LinkedIn. While the Easy Apply window is open it shows "Fill with
// PrimoBoost". A click fills the questions it has answers for from the profile
// saved in the popup, and outlines in amber what is left for the user.
// It never presses Next, Review or Submit: those stay the user's clicks.
// The only things it clicks are radio buttons for answers it chose.
(() => {
  const { answerFor, pickOption, numberOf } = globalThis.PBMatch;
  const AMBER = '3px solid #f59e0b';
  const MODAL = '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]';
  let armed = false; // after the first fill, each new step is filled too

  const modal = () => document.querySelector(MODAL);

  // LinkedIn repeats label text for screen readers: "Email Email" -> "Email".
  function clean(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const half = t.slice(0, Math.floor(t.length / 2)).trim();
    return half && t === `${half} ${half}` ? half : t;
  }

  function labelOf(el) {
    const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    const ids = el.getAttribute('aria-labelledby');
    return clean(byFor?.textContent
      || el.closest('label')?.textContent
      || (ids && ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' '))
      || el.getAttribute('aria-label') || el.placeholder || '');
  }

  const visible = (el) => el.getClientRects().length > 0;

  function hasValue(el) {
    if (el.tagName === 'SELECT') return !!el.value && !/select an option/i.test(el.options[el.selectedIndex]?.text || '');
    return el.value.trim() !== '';
  }

  // React keeps its own copy of the value; the prototype setter plus real events
  // make it see the change, as if typed.
  function setValue(el, value) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const mark = (el, needsUser) => { el.style.outline = needsUser ? AMBER : ''; el.style.outlineOffset = needsUser ? '2px' : ''; };

  async function fill() {
    const root = modal();
    if (!root) return;
    const { profile } = await chrome.storage.local.get('profile');
    if (!profile?.fullName) return say('Add your details first: click the PrimoBoost icon in the toolbar.');
    let filled = 0;
    let left = 0;

    for (const group of root.querySelectorAll('fieldset')) {
      const radios = [...group.querySelectorAll('input[type="radio"]')];
      if (!radios.length || !visible(group)) continue;
      if (radios.some((radio) => radio.checked)) { mark(group, false); continue; }
      const texts = radios.map(labelOf);
      const choice = pickOption(texts, answerFor(clean(group.querySelector('legend')?.textContent), profile));
      if (choice) { radios[texts.indexOf(choice)].click(); mark(group, false); filled++; } else { mark(group, true); left++; }
    }

    const fields = root.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]), textarea, select');
    for (const el of fields) {
      if (!visible(el) || el.disabled || el.readOnly) continue;
      if (hasValue(el)) { mark(el, false); continue; } // LinkedIn's own prefill, or the user's typing, wins
      const answer = answerFor(labelOf(el), profile);
      let value = answer;
      if (el.tagName === 'SELECT') {
        const options = [...el.options].filter((option) => option.value && !/select an option/i.test(option.text));
        const text = pickOption(options.map((option) => option.text.trim()), answer);
        value = options.find((option) => option.text.trim() === text)?.value || '';
      } else if (el.type === 'number' || /numeric/i.test(el.id)) {
        value = numberOf(answer);
      }
      if (!value) { mark(el, true); left++; continue; }
      setValue(el, value);
      filled++;
      // A city box only offers suggestions; the user still picks one.
      mark(el, el.getAttribute('role') === 'combobox');
    }
    armed = true;
    say(`Filled ${filled}. ${left ? `${left} in amber are yours.` : ''} Check, then press LinkedIn's button yourself.`);
  }

  // The floating button, in a shadow root so LinkedIn's styles leave it alone.
  const host = document.createElement('primoboost-fill');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    div { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 260px; font: 14px/1.4 system-ui, sans-serif; }
    button { border: 0; border-radius: 999px; padding: 10px 16px; background: #0f766e; color: #fff; font: 600 14px system-ui, sans-serif;
      cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
    p { margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: #fff; color: #1f2937; box-shadow: 0 6px 20px rgba(0,0,0,.2); }
    p:empty { display: none; }
  </style><div><button type="button">Fill with PrimoBoost</button><p></p></div>`;
  const note = shadow.querySelector('p');
  shadow.querySelector('button').addEventListener('click', fill);
  function say(text) { note.textContent = text; }

  // Show the button only while the Easy Apply window is open.
  setInterval(() => {
    const open = !!modal();
    if (open && !host.isConnected) document.documentElement.append(host);
    if (!open && host.isConnected) { host.remove(); say(''); armed = false; }
  }, 700);

  // The user moved to the next step: fill it once LinkedIn has drawn it.
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!armed || !button || !modal()?.contains(button)) return;
    const words = `${button.getAttribute('aria-label') || ''} ${button.textContent}`;
    if (/next|review|continue/i.test(words) && !/submit/i.test(words)) setTimeout(fill, 1000);
  }, true);
})();

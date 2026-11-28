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

  // ------------------------------------------------------------------
  // The user's OWN profile, only when the PrimoBoost site asked for it.
  // background.js opened linkedin.com/in/me/ in this tab and hands the job
  // to this tab once. Import reads what is on the page (the only click is
  // About's "see more"). Fill clicks the pencil of the one section asked for,
  // fills the field and stops: Save stays the user's click.
  // LinkedIn changes its page often; every lookup has a fallback, and when
  // nothing matches it says so instead of guessing.
  const P = globalThis.PBProfile;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(find, ms = 15000) {
    for (let t = 0; t <= ms; t += 300) { const found = find(); if (found) return found; await sleep(300); }
    return null;
  }
  const isProfilePage = () => /^\/in\/[^/]+\/?$/.test(location.pathname);
  const COULD_NOT_READ = "Couldn't read your profile. Use the PDF upload instead.";

  function sectionOf(id, heading) {
    const byAnchor = document.getElementById(id)?.closest('section');
    if (byAnchor) return byAnchor;
    return [...document.querySelectorAll('main section, section')].find((s) => {
      const h = s.querySelector('h2');
      return h && clean(h.textContent).toLowerCase() === heading.toLowerCase();
    }) || null;
  }

  // LinkedIn puts the visible text in span[aria-hidden="true"] (and a copy for
  // screen readers beside it). Fall back to the plain text when that is gone.
  function linesOf(el) {
    const spans = [...el.querySelectorAll('span[aria-hidden="true"]')].filter((s) => !s.querySelector('span[aria-hidden="true"]'));
    return P.cleanLines(spans.length ? spans.map((s) => s.innerText || s.textContent) : (el.innerText || '').split('\n'));
  }

  // Top-level items only; roles grouped under one company are nested lists.
  const itemsOf = (section) => [...section.querySelectorAll('li')]
    .filter((li) => !li.parentElement.closest('li') && visible(li) && li.innerText.trim());

  function readList(id, heading, found) {
    const section = sectionOf(id, heading);
    if (!section) return [];
    const more = [...section.querySelectorAll('a, button')].find((el) => /^show all\b/i.test(clean(el.textContent)));
    if (more) found.truncated.push(heading);
    if (more && id === 'skills') found.skillsTotal = P.showAllCount(clean(more.textContent));
    return itemsOf(section).map(linesOf).filter((lines) => lines.length);
  }

  async function readAbout() {
    const section = sectionOf('about', 'About');
    if (!section) return '';
    const toggle = [...section.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-expanded') !== 'true'
      && (b.classList.contains('inline-show-more-text__button') || /^(…\s*)?(see )?more$/i.test(clean(b.textContent))));
    if (toggle) { toggle.click(); await sleep(400); }
    const spans = [...section.querySelectorAll('span[aria-hidden="true"]')].map((s) => (s.innerText || '').trim());
    let text = spans.sort((a, b) => b.length - a.length)[0] || '';
    if (text.length < 40) text = (section.innerText || '').split('\n').slice(1).join('\n');
    return text.replace(/\s*…?\s*see (more|less)\s*$/i, '').trim();
  }

  async function importProfile() {
    if (!isProfilePage()) return { ok: false, error: 'LinkedIn did not open your profile. Sign in to LinkedIn in this browser, then try again.' };
    const h1 = await waitFor(() => document.querySelector('main h1') || document.querySelector('h1'));
    if (!h1) return { ok: false, error: COULD_NOT_READ };
    // Lower sections load as the page scrolls. Scrolling is not a click.
    for (let i = 0; i < 6; i += 1) { window.scrollBy(0, window.innerHeight); await sleep(400); }
    window.scrollTo(0, 0);
    await sleep(300);

    const name = clean(h1.innerText || h1.textContent);
    const top = h1.closest('section') || h1.parentElement;
    const fromLines = P.parseTopCard(P.cleanLines((top?.innerText || '').split('\n')), name);
    const found = { truncated: [], skillsTotal: 0 };
    const experience = readList('experience', 'Experience', found).flatMap(P.parseExperienceItem);
    const projects = readList('projects', 'Projects', found).flatMap(P.parseExperienceItem).map((e) => ({ ...e, org: e.org || 'Project' }));
    const profile = {
      name,
      headline: clean(top?.querySelector('.text-body-medium')?.textContent) || fromLines.headline,
      location: clean(top?.querySelector('.text-body-small.inline.t-black--light')?.textContent) || fromLines.location,
      about: await readAbout(),
      experience: [...experience, ...projects],
      education: readList('education', 'Education', found).map(P.parseEducationItem),
      skills: readList('skills', 'Skills', found).map((lines) => lines[0]),
      certifications: readList('licenses_and_certifications', 'Licenses & certifications', found).map((lines) => lines[0]),
      languages: readList('languages', 'Languages', found).map((lines) => lines[0]),
      profileUrl: `linkedin.com${location.pathname.replace(/\/$/, '')}`,
      skillsTotal: found.skillsTotal,
      truncated: found.truncated,
    };
    if (!profile.headline && !profile.about && !profile.experience.length) return { ok: false, error: COULD_NOT_READ };
    return { ok: true, profile };
  }

  function editButton(field) {
    if (field === 'headline') {
      return document.querySelector('a[href*="/edit/intro"], button[aria-label*="edit intro" i], a[aria-label*="edit intro" i]');
    }
    const about = sectionOf('about', 'About');
    return document.querySelector('a[href*="/edit/about"], a[href*="/edit/forms/summary"]')
      || about?.querySelector('a[aria-label*="edit" i], button[aria-label*="edit" i]');
  }

  function fieldIn(dialog, field) {
    const words = field === 'headline' ? /headline/i : /summary|about/i;
    const fields = [...dialog.querySelectorAll('textarea, input[type="text"], input:not([type])')].filter(visible);
    return fields.find((el) => words.test(`${el.id} ${el.name} ${labelOf(el)}`))
      || (field === 'about' ? dialog.querySelector('textarea') || dialog.querySelector('[contenteditable="true"]') : null);
  }

  async function fillOwnProfile(field, text) {
    const label = field === 'headline' ? 'headline' : 'About';
    if (!isProfilePage()) return notice(`Sign in to LinkedIn, open your profile, and paste your new ${label}.`, text);
    await waitFor(() => document.querySelector('main h1') || document.querySelector('h1'));
    const pencil = await waitFor(() => editButton(field), 8000);
    if (!pencil) return notice(`Couldn't find the edit button for your ${label}. Click the pencil next to it and paste this.`, text);
    pencil.click(); // opens the edit form the user asked to fill; nothing is saved
    const el = await waitFor(() => { const d = document.querySelector('[role="dialog"]'); return d && fieldIn(d, field); }, 8000);
    if (!el) return notice(`The ${label} form didn't open as expected. Paste this into it.`, text);
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('selectAll');
      document.execCommand('insertText', false, text);
    } else {
      setValue(el, text);
    }
    el.style.outline = '3px solid #10b981';
    el.style.outlineOffset = '2px';
    el.scrollIntoView({ block: 'center' });
    notice('PrimoBoost filled this. Review and click Save.');
  }

  // A note at the top of the page; with text, also a Copy button.
  function notice(message, text = '') {
    document.querySelector('primoboost-note')?.remove();
    const box = document.createElement('primoboost-note');
    const root = box.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      div { position: fixed; top: 72px; left: 50%; transform: translateX(-50%); z-index: 2147483647; width: min(520px, calc(100vw - 32px));
        padding: 14px 16px; border-radius: 12px; background: #0f766e; color: #fff; font: 14px/1.45 system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
      p { margin: 0 24px 0 0; font-weight: 600; }
      textarea { display: block; width: 100%; box-sizing: border-box; margin-top: 10px; min-height: 90px; border: 0; border-radius: 8px; padding: 8px; font: 13px/1.4 system-ui, sans-serif; }
      button { margin-top: 10px; border: 0; border-radius: 999px; padding: 8px 14px; background: #fff; color: #0f766e; font: 600 13px system-ui, sans-serif; cursor: pointer; }
      .x { position: absolute; top: 4px; right: 6px; margin: 0; padding: 4px 8px; background: transparent; color: #fff; font-size: 18px; }
    </style><div role="status"><button class="x" type="button" aria-label="Close">×</button><p></p></div>`;
    const div = root.querySelector('div');
    root.querySelector('p').textContent = message;
    root.querySelector('.x').addEventListener('click', () => box.remove());
    if (text) {
      const area = document.createElement('textarea');
      area.readOnly = true;
      area.value = text;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; } catch { area.select(); }
      });
      div.append(area, copy);
    }
    document.documentElement.append(box);
  }

  chrome.runtime.sendMessage({ type: 'linkedin-job' }).then(async (job) => {
    if (job?.kind === 'import') {
      const result = await importProfile().catch(() => ({ ok: false, error: COULD_NOT_READ }));
      if (!result.ok) notice(result.error);
      chrome.runtime.sendMessage({ type: 'linkedin-profile', ...result });
    } else if (job?.kind === 'fill') {
      await fillOwnProfile(job.field, job.text);
    }
  }).catch(() => undefined);
})();

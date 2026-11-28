// Holds the one application the user last opened, in memory until Chrome closes.
// Session storage is out of reach of web pages, and of the content scripts too,
// so a page cannot read it and the form page has to ask here.
//
// It also runs the two LinkedIn jobs the PrimoBoost site asks for: read the
// user's own profile, or put a rewritten headline/About into their own edit
// form. It opens linkedin.com/in/me/ (always the signed-in user's profile) in a
// new tab; linkedin.js in that tab, and only that tab, picks up the job once.
const LINKEDIN_ME = 'https://www.linkedin.com/in/me/';
const JOB_MAX_AGE = 3 * 60 * 1000;
const isLinkedIn = (url) => /^https:\/\/www\.linkedin\.com\//.test(url || '');

async function startLinkedIn(message, sender) {
  const kind = message.kind;
  const field = message.field;
  if (!sender.tab?.id || isLinkedIn(sender.url)) return { ok: false, error: 'Not allowed from here.' };
  if (kind !== 'import' && !(kind === 'fill' && (field === 'headline' || field === 'about') && typeof message.text === 'string' && message.text.trim())) {
    return { ok: false, error: 'Nothing to send to LinkedIn.' };
  }
  const tab = await chrome.tabs.create({ url: LINKEDIN_ME });
  await chrome.storage.session.set({
    linkedinJob: {
      kind, field, text: kind === 'fill' ? message.text.slice(0, 2600) : '', id: String(message.id || ''),
      tabId: tab.id, siteTabId: sender.tab.id, at: Date.now(), taken: false,
    },
  });
  return { ok: true };
}

async function takeJob(sender) {
  const { linkedinJob: job } = await chrome.storage.session.get('linkedinJob');
  if (!job || job.taken || job.tabId !== sender.tab?.id || Date.now() - job.at > JOB_MAX_AGE) return null;
  await chrome.storage.session.set({ linkedinJob: { ...job, taken: true } });
  return { kind: job.kind, field: job.field, text: job.text };
}

async function returnProfile(message, sender) {
  const { linkedinJob: job } = await chrome.storage.session.get('linkedinJob');
  if (!job || job.kind !== 'import' || job.tabId !== sender.tab?.id) return;
  await chrome.storage.session.remove('linkedinJob');
  await chrome.tabs.sendMessage(job.siteTabId, {
    type: 'linkedin-profile', id: job.id, ok: !!message.ok, profile: message.ok ? message.profile : null, error: message.error || '',
  }).catch(() => undefined); // the PrimoBoost tab was closed
  await chrome.tabs.update(job.siteTabId, { active: true }).catch(() => undefined);
  if (message.ok) await chrome.tabs.remove(job.tabId).catch(() => undefined); // the tab we opened; on failure leave it so they can see why
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'prepare') {
    chrome.storage.session.set({ prepared: message.prepared }).then(() => reply(true));
    return true;
  }
  if (message?.type === 'prepared') {
    chrome.storage.session.get('prepared').then(({ prepared }) => reply(prepared ?? null));
    return true;
  }
  if (message?.type === 'linkedin-start') {
    startLinkedIn(message, sender).then(reply, () => reply({ ok: false, error: 'The extension could not open LinkedIn.' }));
    return true;
  }
  if (message?.type === 'linkedin-job' && isLinkedIn(sender.url)) {
    takeJob(sender).then(reply, () => reply(null));
    return true;
  }
  if (message?.type === 'linkedin-profile' && isLinkedIn(sender.url)) {
    returnProfile(message, sender);
    return false;
  }
  return false;
});

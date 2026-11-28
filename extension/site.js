// Runs on PrimoBoost only. It tells the site the extension is here, and passes on
// the details the site prepares for one application. No password or login token
// ever comes through here.
// It also relays the LinkedIn Profile Optimizer's two asks (import my profile,
// fill my headline/About) to background.js, and the imported profile back.
document.documentElement.dataset.primoboostExtension = '1';

const toSite = (data) => window.postMessage({ source: 'primoboost-extension', ...data }, location.origin);

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (data?.source !== 'primoboost-site') return;
  if (data.type === 'prepare') chrome.runtime.sendMessage({ type: 'prepare', prepared: data.prepared });
  if (data.type === 'linkedin-import' || data.type === 'linkedin-fill') {
    chrome.runtime.sendMessage({
      type: 'linkedin-start', kind: data.type === 'linkedin-import' ? 'import' : 'fill', field: data.field, text: data.text, id: data.id,
    })
      .then((r) => toSite({ type: 'linkedin-started', id: data.id, ok: !!r?.ok, error: r?.error || '' }))
      .catch(() => toSite({ type: 'linkedin-started', id: data.id, ok: false, error: 'The PrimoBoost extension did not answer. Reload this page and try again.' }));
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'linkedin-profile') {
    toSite({ type: 'linkedin-profile', id: message.id, ok: message.ok, profile: message.profile, error: message.error });
  }
});

// Runs on PrimoBoost only. It tells the site the extension is here, and passes on
// the details the site prepares for one application. No password or login token
// ever comes through here.
document.documentElement.dataset.primoboostExtension = '1';

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (event.data?.source !== 'primoboost-site' || event.data.type !== 'prepare') return;
  chrome.runtime.sendMessage({ type: 'prepare', prepared: event.data.prepared });
});

// The profile LinkedIn Easy Apply is filled from, kept in chrome.storage.local.
// Only the named fields are kept; nothing here is a password or a login token.
const form = document.getElementById('profile');
const status = document.getElementById('status');
const FIELDS = [...form.elements].filter((el) => el.name).map((el) => el.name);

function show(profile) {
  for (const name of FIELDS) if (profile?.[name] != null) form.elements[name].value = String(profile[name]);
}

chrome.storage.local.get('profile').then(({ profile }) => show(profile));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const profile = Object.fromEntries(FIELDS.map((name) => [name, form.elements[name].value.trim().slice(0, 300)]));
  await chrome.storage.local.set({ profile });
  status.textContent = 'Saved.';
});

// The site hands the extension the user's details when they press "Open the
// form" on My Auto Applications (see site.js / background.js). Reuse those.
document.getElementById('copy').addEventListener('click', async () => {
  const prepared = await chrome.runtime.sendMessage({ type: 'prepared' });
  if (!prepared?.profile) {
    status.textContent = 'Nothing from PrimoBoost yet. Open any application on primoboostai.in (My Auto Applications, "Open the form"), or type your details here.';
    return;
  }
  show(prepared.profile);
  status.textContent = 'Copied. Check the fields, then press Save.';
});

// Holds the one application the user last opened, in memory until Chrome closes.
// Session storage is out of reach of web pages, and of the content scripts too,
// so a page cannot read it and the form page has to ask here.
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'prepare') {
    chrome.storage.session.set({ prepared: message.prepared }).then(() => reply(true));
    return true;
  }
  if (message?.type === 'prepared') {
    chrome.storage.session.get('prepared').then(({ prepared }) => reply(prepared ?? null));
    return true;
  }
  return false;
});

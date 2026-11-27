// Runs on Google Forms, in the user's own browser, where they are already signed
// in. It offers to fill the form from their PrimoBoost details and reports what is
// left. Nothing here presses Next or Submit: that is always the user's click.
import { isPrefilled, needsEmailTick, prefillLink, questionsOf, readLoadData, reportOn } from '../../supabase/functions/_shared/googleForm.ts';

declare const chrome: any;

interface Prepared {
  role: string;
  company: string;
  profile: any;
  saved: Record<string, string>;
  resumeUrl?: string;
}

const STYLE = `
  :host { all: initial; }
  div.box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px; box-sizing: border-box;
    padding: 14px 16px; border-radius: 12px; background: #fff; color: #1f2937; box-shadow: 0 8px 28px rgba(0,0,0,.25);
    font: 14px/1.45 system-ui, sans-serif; }
  h1 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: #0f766e; }
  p { margin: 0 0 8px; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  button, a.button { display: inline-block; border: 0; border-radius: 8px; padding: 8px 12px; background: #0f766e; color: #fff;
    font: 600 14px system-ui, sans-serif; text-decoration: none; cursor: pointer; }
`;

/** The application the site prepared. The site may still be sending it as this page loads. */
async function preparedApplication(): Promise<Prepared | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const prepared = await chrome.runtime.sendMessage({ type: 'prepared' });
    if (prepared) return prepared;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return null;
}

function show(build: (box: HTMLElement) => void) {
  const host = document.createElement('primoboost-helper');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const box = document.createElement('div');
  box.className = 'box';
  const title = document.createElement('h1');
  title.textContent = 'PrimoBoost';
  box.append(title);
  build(box);
  root.append(style, box);
  document.documentElement.append(host);
}

// Words from the page go in as text, never as markup: a form's author wrote them.
const line = (box: HTMLElement, text: string) => {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  box.append(paragraph);
};

async function start() {
  if (!location.pathname.endsWith('/viewform')) return;
  const scripts = [...document.scripts].map((script) => script.textContent || '');
  const data = readLoadData(scripts);
  const questions = questionsOf(data);
  if (!questions.length) return;
  const prepared = await preparedApplication();
  if (!prepared) return;

  // Google wipes the address of a signed-in form as it loads. This is the one it opened with.
  const opened = performance.getEntriesByType('navigation')[0]?.name ?? location.href;
  if (!isPrefilled(opened)) {
    show((box) => {
      line(box, `Fill this form for ${prepared.role} at ${prepared.company}?`);
      const fill = document.createElement('button');
      fill.textContent = 'Fill the form';
      fill.addEventListener('click', () => {
        location.assign(prefillLink(location.href, questions, prepared.profile, prepared.saved));
      });
      box.append(fill);
    });
    return;
  }

  const { filled, left, uploads } = reportOn(opened, questions);
  show((box) => {
    line(box, `Filled ${filled} answer${filled === 1 ? '' : 's'}.`);
    if (left.length) {
      line(box, 'Left for you:');
      const list = document.createElement('ul');
      for (const label of left.slice(0, 6)) {
        const item = document.createElement('li');
        item.textContent = label;
        list.append(item);
      }
      box.append(list);
      if (left.length > 6) line(box, `and ${left.length - 6} more.`);
    }
    if (uploads.length) {
      line(box, `Attach your resume to: ${uploads.join(', ')}.`);
      if (prepared.resumeUrl) {
        const download = document.createElement('a');
        download.className = 'button';
        download.href = prepared.resumeUrl;
        download.target = '_blank';
        download.rel = 'noopener noreferrer';
        download.textContent = 'Download resume';
        box.append(download);
      }
    }
    if (needsEmailTick(data)) line(box, 'Tick the box beside your email at the top of the form.');
    line(box, 'Check every answer, then press Submit yourself.');
  });
}

start();

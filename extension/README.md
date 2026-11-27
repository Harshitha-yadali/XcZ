# PrimoBoost Auto Apply Helper

Fills LinkedIn Easy Apply and Google Form job applications in the user's own Chrome, where they are
already signed in. Google does not let a server sign in for them, so this is the
only way to fill forms that ask for a Google account.

## Try it

1. `npm run extension:build`
2. In Chrome, open `chrome://extensions` and turn on Developer mode.
3. Press **Load unpacked** and choose this `extension` folder.

## How it works

1. On My Auto Applications, the user presses **Open the form**. The site passes the
   extension their details for that one application.
2. The form opens in their browser. A small box offers **Fill the form**.
3. The extension builds Google's own pre-filled link, so Google fills the form.
4. The user adds anything left, attaches their resume, and presses Submit.

## LinkedIn Easy Apply

Load unpacked as above (no build needed for this part; `linkedin.js`,
`match.js`, `popup.*` are plain JS). After editing files, press the reload
arrow on the extension's card in `chrome://extensions`.

1. Click the PrimoBoost icon in the toolbar. Type your details (name, email,
   phone, city, years of experience, notice period, current and expected CTC,
   LinkedIn and portfolio URLs) and press **Save**. **Copy from PrimoBoost**
   fills the box from the last application you opened on primoboostai.in.
   The details stay in this browser (`chrome.storage.local`).
2. On LinkedIn, open a job and press **Easy Apply**. Upload or choose your
   resume on LinkedIn as usual.
3. Press **Fill with PrimoBoost** (bottom right). It fills what it knows and
   outlines in amber what is left for you, including a city box where you
   still pick a suggestion.
4. Check the answers and press LinkedIn's **Next** / **Review** yourself. Each
   new step fills itself after that. Press **Submit** yourself.

Rules (in `match.js`, checked by `node extension/match.test.mjs`): name, email,
phone, city, LinkedIn/portfolio, years of experience (the total, also for
"years with React?" questions), notice period, CTC; "authorized to work in
India" = Yes, "need sponsorship" = No. Anything else is left to you. It never
overwrites a field that already has a value, and never ticks a checkbox.

## What it never does

- It never presses Next, Review, Submit or Send on LinkedIn, and never ticks a
  checkbox. The only clicks are on radio buttons for answers it chose.
- It never signs in anywhere, never solves a captcha.
- It never sees a password or a login token.
- It never presses Next or Submit.
- It only runs on PrimoBoost, Google Forms and LinkedIn. Google Form details stay in memory
  until Chrome closes; the LinkedIn profile stays in this browser until you change it.

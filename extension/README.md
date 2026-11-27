# PrimoBoost Auto Apply Helper

Fills Google Form job applications in the user's own Chrome, where they are
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

## What it never does

- It never sees a password or a login token.
- It never presses Next or Submit.
- It only runs on PrimoBoost and on Google Forms, and keeps its data in memory
  until Chrome closes.

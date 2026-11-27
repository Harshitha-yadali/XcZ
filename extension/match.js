// Decides what goes into one LinkedIn Easy Apply question, from the profile the
// user saved in the popup. Pure: no DOM, no chrome.*, so `node extension/match.test.mjs`
// can check it. Rules follow profileAnswer/pickOption in
// supabase/functions/_shared/applyForm.ts (copied, not imported: that file is
// TypeScript and other work edits it). Unknown question = '' = left for the user.
(() => {
  const answerKey = (label) => String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160);

  // Somebody else's details, or a wish rather than a fact.
  const NOT_THE_APPLICANT = /father|mother|parent|guardian|spouse|husband|wife|emergency|refer|manager|supervisor|recruiter|alternate|secondary|preferred|desired|home|native|permanent/;
  const OTHER_COUNTRY = /united states|\busa?\b|\buk\b|united kingdom|canada|europe|\beu\b|australia|singapore|germany|\buae\b|dubai|netherlands|ireland/;

  /** The answer as text, or '' when the profile does not hold it. */
  function answerFor(label, profile) {
    const key = answerKey(label);
    const p = profile || {};
    if (!key) return '';

    // Questions LinkedIn asks in long form. Checked before the short-label rules.
    if (/sponsor/.test(key)) return OTHER_COUNTRY.test(key) ? '' : 'No';
    if (/authori[sz]ed to work|(legally|eligible|allowed|permitted) to work|work (permit|authori[sz]ation)|right to work/.test(key)) {
      return OTHER_COUNTRY.test(key) ? '' : 'Yes';
    }
    if (/notice period|\bnotice\b/.test(key)) return p.noticePeriod || '';
    if (/expected|desired (ctc|salary|compensation)/.test(key) && /ctc|salary|compensation|package|lpa/.test(key)) return p.expectedCtc || '';
    if (/current|present|last drawn/.test(key) && /ctc|salary|compensation|package|lpa/.test(key)) return p.currentCtc || '';
    // "How many years of work experience do you have with React?" gets the total.
    // ponytail: per-skill years not stored; the user corrects these before Submit.
    if (/years?\b.*\bexperience|experience.*\byears?\b/.test(key)) return p.yearsExperience || '';

    // Contact fields have short labels; a long one only mentions "name" or "city".
    if (key.split(' ').length > 6 || NOT_THE_APPLICANT.test(key)) return '';
    const [first, ...rest] = String(p.fullName || '').trim().split(/\s+/);
    if (/first name|given name/.test(key)) return first || '';
    if (/last name|surname|family name/.test(key)) return rest.join(' ');
    if (/\bname\b/.test(key) && !/company|employer|school|university|college/.test(key)) return String(p.fullName || '').trim();
    if (/e ?mail/.test(key)) return p.email || '';
    if (/country code|dial code/.test(key)) return p.phone ? 'India' : '';
    if (/phone|mobile|contact (number|no)\b/.test(key)) return p.phone || '';
    if (/linkedin/.test(key)) return p.linkedin || '';
    if (/github/.test(key)) return p.github || '';
    if (/portfolio|website|personal (site|url)/.test(key)) return p.portfolio || '';
    if (/\b(city|location)\b/.test(key)) return p.location || '';
    return '';
  }

  /** Exact, then whole words, then substring: "India" finds "India (+91)" before "British Indian Ocean Territory". */
  function pickOption(options, answer) {
    const wanted = answerKey(answer);
    if (!wanted) return '';
    const words = new RegExp(`(^| )${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    return options.find((option) => answerKey(option) === wanted)
      ?? options.find((option) => words.test(answerKey(option)))
      ?? options.find((option) => answerKey(option).includes(wanted))
      ?? '';
  }

  /** "3.5 years" -> "3.5", "12 LPA" -> "12"; '' when there is no number. */
  const numberOf = (answer) => (String(answer || '').match(/\d+(\.\d+)?/) || [''])[0];

  globalThis.PBMatch = { answerKey, answerFor, pickOption, numberOf };
})();

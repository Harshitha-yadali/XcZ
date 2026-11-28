// Pure text helpers for reading the user's own LinkedIn profile page. No DOM
// here: linkedin.js collects the visible lines of each section item and these
// turn them into entries. Checked by `node extension/profile.test.mjs`.
(() => {
  const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  const DATE = new RegExp(`^(?:${MONTH}\\s+)?\\d{4}\\s*[-–—]\\s*(?:present|(?:${MONTH}\\s+)?\\d{4})`, 'i');
  const NOISE = /^(?:…|\.\.\.)?\s*(?:see|show)\s+(?:more|less|all|credential|project)\b|^…\s*more$|^skills?:|^\d+\s+endorsements?$|^endorsed by\b/i;
  const LOCATION_WORDS = /\b(india|remote|on-site|onsite|hybrid|area)\b/i;
  const CITY_STATE = /^[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}(?:, [A-Z][a-z]+(?: [A-Z][a-z]+){0,2}){1,2}$/;
  const PRONOUNS = /^(?:he|she|they|ze)\/\w+$/i;

  // LinkedIn repeats text for screen readers: "About About" -> "About".
  function clean(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const half = t.slice(0, Math.floor(t.length / 2)).trim();
    return half && t === `${half} ${half}` ? half : t;
  }

  /** Trimmed, de-noised lines with repeats next to each other dropped. */
  function cleanLines(texts) {
    const out = [];
    for (const raw of texts) {
      const line = clean(raw);
      if (!line || line === '·' || NOISE.test(line) || line === out[out.length - 1]) continue;
      out.push(line);
    }
    return out;
  }

  const isDate = (line) => DATE.test(line);
  const isLocation = (line) => line.length <= 80 && !/[.!?]$/.test(line) && (LOCATION_WORDS.test(line) || CITY_STATE.test(line));
  const beforeDot = (line) => String(line || '').split(' · ')[0].trim();

  function description(lines) {
    const body = lines.filter((l) => !isDate(l));
    if (body.length && isLocation(body[0])) body.shift();
    return body.join(' ').trim();
  }

  /**
   * One Experience item. Single role: Title / Company · Full-time / dates / location / text.
   * Several roles at one company: Company / 3 yrs / Title / dates / location / text / Title / dates ...
   */
  function parseExperienceItem(lines) {
    const dates = lines.map((l, i) => (isDate(l) ? i : -1)).filter((i) => i > 0);
    if (!lines.length) return [];
    if (!dates.length) return [{ title: lines[0], org: beforeDot(lines[1]), dates: '', description: description(lines.slice(2)) }];
    if (dates.length === 1 && dates[0] <= 2) {
      const d = dates[0];
      return [{ title: lines[0], org: d === 2 ? beforeDot(lines[1]) : '', dates: beforeDot(lines[d]), description: description(lines.slice(d + 1)) }];
    }
    const org = beforeDot(lines[0]);
    return dates.map((d, k) => ({
      title: lines[d - 1],
      org,
      dates: beforeDot(lines[d]),
      description: description(lines.slice(d + 1, k + 1 < dates.length ? dates[k + 1] - 1 : lines.length)),
    }));
  }

  /** "School, Degree, 2018 - 2022" from School / Degree / dates / Grade ... */
  function parseEducationItem(lines) {
    const date = lines.find(isDate);
    const degree = lines[1] && !isDate(lines[1]) && !/^(grade|activities)\b/i.test(lines[1]) ? lines[1] : '';
    return [lines[0], degree, date && beforeDot(date)].filter(Boolean).join(', ');
  }

  /** Headline and location from the top card's lines, when LinkedIn's class names are gone. */
  function parseTopCard(lines, name) {
    let i = lines.findIndex((l) => l === name);
    i = i < 0 ? 0 : i + 1;
    while (i < lines.length && (PRONOUNS.test(lines[i]) || /^·?\s*(1st|2nd|3rd|you)$/i.test(lines[i]) || /verif/i.test(lines[i]))) i += 1;
    const headline = lines[i] || '';
    const contact = lines.findIndex((l) => /^contact info$/i.test(l));
    let location = contact > i ? lines[contact - 1] : '';
    if (!location) location = lines.slice(i + 1).find(isLocation) || '';
    return { headline, location };
  }

  /** 25 from "Show all 25 skills"; 0 when there is no number. */
  const showAllCount = (text) => Number((String(text || '').match(/show all (\d+)/i) || [])[1] || 0);

  globalThis.PBProfile = { clean, cleanLines, isDate, isLocation, parseExperienceItem, parseEducationItem, parseTopCard, showAllCount };
})();

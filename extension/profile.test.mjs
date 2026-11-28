// node extension/profile.test.mjs
import assert from 'node:assert/strict';
import './profile.js';

const { cleanLines, parseExperienceItem, parseEducationItem, parseTopCard, showAllCount } = globalThis.PBProfile;

// Screen-reader repeats, noise and duplicates go.
assert.deepEqual(cleanLines(['About About', '  ', '·', 'Data Analyst', 'Data Analyst', '…see more', 'Skills: SQL · Python', 'Show all 25 skills']),
  ['About', 'Data Analyst']);

// Single role.
assert.deepEqual(parseExperienceItem(cleanLines([
  'Data Analyst Intern', 'Acme Analytics · Internship', 'Jan 2024 - Jun 2024 · 6 mos', 'Bengaluru, Karnataka, India · On-site',
  'Built 12 Power BI dashboards for the sales team.', 'Skills: Power BI · SQL',
])), [{ title: 'Data Analyst Intern', org: 'Acme Analytics', dates: 'Jan 2024 - Jun 2024', description: 'Built 12 Power BI dashboards for the sales team.' }]);

// Two roles at one company.
assert.deepEqual(parseExperienceItem([
  'Infosys', 'Full-time · 3 yrs 2 mos',
  'Senior Engineer', 'Apr 2023 - Present · 1 yr 8 mos', 'Pune, Maharashtra, India', 'Led a team of 4.',
  'Engineer', 'Sep 2021 – Mar 2023 · 1 yr 7 mos', 'Wrote APIs in Java.',
]), [
  { title: 'Senior Engineer', org: 'Infosys', dates: 'Apr 2023 - Present', description: 'Led a team of 4.' },
  { title: 'Engineer', org: 'Infosys', dates: 'Sep 2021 – Mar 2023', description: 'Wrote APIs in Java.' },
]);

// Project-style item: title then dates, no company.
assert.deepEqual(parseExperienceItem(['Sales Dashboard', 'Mar 2023 - Apr 2023', 'Cleaned 10k rows in Python.']),
  [{ title: 'Sales Dashboard', org: '', dates: 'Mar 2023 - Apr 2023', description: 'Cleaned 10k rows in Python.' }]);
assert.deepEqual(parseExperienceItem([]), []);

assert.equal(parseEducationItem(['ABC Institute of Technology', 'B.Tech, Computer Science', '2019 - 2023', 'Grade: 8.4']),
  'ABC Institute of Technology, B.Tech, Computer Science, 2019 - 2023');
assert.equal(parseEducationItem(['XYZ School', 'Grade: 92%']), 'XYZ School');

assert.deepEqual(parseTopCard(['Riya Test', 'She/Her', 'Aspiring Data Analyst | SQL | Python', 'ABC Institute of Technology', 'Hyderabad, Telangana, India', 'Contact info', '500+ connections'], 'Riya Test'),
  { headline: 'Aspiring Data Analyst | SQL | Python', location: 'Hyderabad, Telangana, India' });
assert.deepEqual(parseTopCard(['Riya Test', 'Student at ABC', 'Chennai, Tamil Nadu, India'], 'Riya Test'),
  { headline: 'Student at ABC', location: 'Chennai, Tamil Nadu, India' });

assert.equal(showAllCount('Show all 25 skills'), 25);
assert.equal(showAllCount('Skills'), 0);

console.log('profile.test.mjs: all checks passed');

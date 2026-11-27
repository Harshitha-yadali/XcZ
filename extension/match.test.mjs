// node extension/match.test.mjs
import assert from 'node:assert/strict';
import './match.js';

const { answerFor, pickOption, numberOf } = globalThis.PBMatch;

const p = {
  fullName: 'Asha Rani Kumar', email: 'asha@example.com', phone: '9876543210', location: 'Bengaluru',
  yearsExperience: '3', noticePeriod: '30 days', currentCtc: '8 LPA', expectedCtc: '12 LPA',
  linkedin: 'https://linkedin.com/in/asha', portfolio: 'https://asha.dev',
};

assert.equal(answerFor('First name', p), 'Asha');
assert.equal(answerFor('Last name', p), 'Rani Kumar');
assert.equal(answerFor('Mobile phone number', p), '9876543210');
assert.equal(answerFor('Phone country code', p), 'India');
assert.equal(answerFor('Email address', p), 'asha@example.com');
assert.equal(answerFor('City', p), 'Bengaluru');
assert.equal(answerFor('Portfolio URL', p), 'https://asha.dev');
assert.equal(answerFor('How many years of work experience do you have with React.js?', p), '3');
assert.equal(answerFor('What is your notice period?', p), '30 days');
assert.equal(answerFor('Current CTC (in LPA)', p), '8 LPA');
assert.equal(answerFor('What is your expected CTC?', p), '12 LPA');
assert.equal(answerFor('Are you legally authorized to work in India?', p), 'Yes');
assert.equal(answerFor('Are you legally authorized to work in the United States?', p), '');
assert.equal(answerFor('Will you now or in the future require sponsorship for employment visa status?', p), 'No');
// Left for the user: someone else's details, a wish, consent, unknown questions.
assert.equal(answerFor('Reference name', p), '');
assert.equal(answerFor('Preferred location', p), '');
assert.equal(answerFor('Are you comfortable commuting to this job\'s location?', p), '');
assert.equal(answerFor('Company name', p), '');
assert.equal(answerFor('Notice period', {}), '');

assert.equal(pickOption(['Yes', 'No'], 'Yes'), 'Yes');
assert.equal(pickOption(['British Indian Ocean Territory (+246)', 'India (+91)'], 'India'), 'India (+91)');
assert.equal(pickOption(['Immediate', '15 days', '30 days', '60 days'], '30 days'), '30 days');
assert.equal(pickOption(['A', 'B'], 'C'), '');
assert.equal(numberOf('3.5 years'), '3.5');
assert.equal(numberOf('12 LPA'), '12');
assert.equal(numberOf('Immediate'), '');

console.log('match.js: all checks passed');

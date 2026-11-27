import { describe, expect, it } from 'vitest';
import { isPrefilled, needsEmailTick, prefillLink, questionsOf, readLoadData, reportOn } from './googleForm.ts';

const profile = {
  fullName: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210',
  linkedin: '', github: '', location: 'Hyderabad', college: 'Example University',
};
const page = 'https://docs.google.com/forms/d/e/abc/viewform';

// The shape Google writes into the page, cut down to what is read.
const data = [null, [null, [
  [1, 'Full Name', null, 0, [[101, null, 1]]],
  [2, 'College Name', null, 0, [[102, null, 1]]],
  [3, 'Graduation Year', null, 3, [[103, [['2027'], ['2028']], 1]]],
  [4, 'Available from September', null, 2, [[104, [['Yes'], ['No']], 1]]],
  [5, 'Languages', null, 4, [[105, [['English'], ['Hindi'], ['French']], 0]]],
  [6, 'A section heading', null, 8, null],
  [7, 'Resume', null, 13, [[107, null, 1]]],
  [8, 'Shift by day', null, 7, [[108, [['Day'], ['Night']], 1], [109, [['Day'], ['Night']], 1]]],
]]];

describe('readLoadData', () => {
  it('finds the form among the page\'s scripts', () => {
    expect(readLoadData(['var other = 1;', `var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};`])).toEqual(data);
  });

  it('gives up quietly on a page that has changed', () => {
    expect(readLoadData(['var other = 1;'])).toBeNull();
    expect(readLoadData(['var FB_PUBLIC_LOAD_DATA_ = [broken];'])).toBeNull();
    expect(questionsOf(null)).toEqual([]);
    expect(questionsOf([null, 'not a list'])).toEqual([]);
  });
});

describe('prefillLink', () => {
  const questions = questionsOf(data);
  const link = (saved = {}) => new URL(prefillLink(page, questions, profile, saved));

  it('skips what is not a question', () => {
    expect(questions.map((question) => question.label)).not.toContain('A section heading');
  });

  it('answers from the profile, on the form\'s own address', () => {
    const url = link();
    expect(url.origin + url.pathname).toBe(page);
    expect(url.searchParams.get('usp')).toBe('pp_url');
    expect(url.searchParams.get('entry.101')).toBe('Asha Verma');
    expect(url.searchParams.get('entry.102')).toBe('Example University');
    expect(url.searchParams.get('emailAddress')).toBe('asha@example.com');
  });

  it('uses saved answers only where they are one of the choices', () => {
    expect(link({ 'graduation year': '2028' }).searchParams.get('entry.103')).toBe('2028');
    expect(link({ 'graduation year': '2031' }).searchParams.has('entry.103')).toBe(false);
  });

  it('sends each ticked box on its own', () => {
    expect(link({ languages: 'English | Hindi | Klingon' }).searchParams.getAll('entry.105')).toEqual(['English', 'Hindi']);
  });

  it('never guesses a choice nobody has answered', () => {
    expect(link().searchParams.has('entry.104')).toBe(false);
  });

  it('leaves a date alone unless Google could read it', () => {
    const asked = questionsOf([null, [null, [[1, 'Date of Birth', null, 9, [[201, null, 1]]]]]]);
    expect(new URL(prefillLink(page, asked, profile, { 'date of birth': '12 May 2002' })).searchParams.has('entry.201')).toBe(false);
    expect(new URL(prefillLink(page, asked, profile, { 'date of birth': '2002-05-12' })).searchParams.get('entry.201')).toBe('2002-05-12');
  });
});

describe('isPrefilled', () => {
  it('knows a filled form after Google tidies its address', () => {
    expect(isPrefilled(`${page}?usp=pp_url`)).toBe(true);
    expect(isPrefilled(`${page}?emailAddress=a%40b.com&entry.101=Asha`)).toBe(true);
    expect(isPrefilled(`${page}?entry.101=Asha`)).toBe(true);
  });

  it('knows a form nobody has filled', () => {
    expect(isPrefilled(page)).toBe(false);
    expect(isPrefilled(`${page}?usp=sf_link`)).toBe(false);
  });
});

describe('needsEmailTick', () => {
  const withSettings = (settings: unknown) => [null, [null, [], null, null, null, null, null, null, null, null, settings]];

  it('reads the setting as real forms write it', () => {
    expect(needsEmailTick(withSettings([null, null, null, 2, null, null, 2]))).toBe(true);
    expect(needsEmailTick(withSettings([1, 1, 0, 2, null, 1, 1]))).toBe(false);
  });

  it('says nothing about a form it cannot read', () => {
    expect(needsEmailTick(null)).toBe(false);
    expect(needsEmailTick(withSettings(null))).toBe(false);
  });
});

describe('reportOn', () => {
  it('says what was filled, what is left, and what must be attached by hand', () => {
    const questions = questionsOf(data);
    expect(reportOn(prefillLink(page, questions, profile, {}), questions)).toEqual({
      filled: 2,
      left: ['Graduation Year', 'Available from September', 'Shift by day'],
      uploads: ['Resume'],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { categorizeSkill, formatSkillName } from './skillsTaxonomy';

describe('categorizeSkill', () => {
  it.each([
    ['Java', 'Programming Languages'], ['JavaScript', 'Programming Languages'], ['SQL', 'Programming Languages'],
    ['ReactJS', 'Frontend Technologies'], ['Spring Boot', 'Backend Technologies'], ['REST APIs', 'Backend Technologies'],
    ['MySQL 8', 'Databases'], ['JUnit5', 'Testing & QA'], ['CI/CD', 'Cloud & DevOps'], ['Power BI', 'Data Science & ML'],
    ['Cloud storage', null],
  ])('%s -> %s', (skill, category) => expect(categorizeSkill(skill)).toBe(category));

  it('writes product names properly', () => expect(formatSkillName('mongodb')).toBe('MongoDB'));
});

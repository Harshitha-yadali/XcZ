import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResumeData } from '../../types/resume';
import BoostQuestionsModal from './BoostQuestionsModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Synthetic fresher resume: no real person.
const resume: ResumeData = {
  name: 'Test Candidate',
  email: 'test@example.com',
  phone: '9000000002',
  linkedin: '',
  github: '',
  careerObjective: 'Computer Science graduate seeking a backend developer role.',
  education: [{ degree: 'B.Tech in Computer Science', school: 'Example Institute', year: '2025' }],
  workExperience: [],
  projects: [{ title: 'Campus Event Portal', techStack: ['Django', 'MySQL'], bullets: ['Built an event registration portal with Django and MySQL for college clubs.'] }],
  skills: [{ category: 'Technical Skills', count: 3, list: ['Python', 'Django', 'MySQL'] }],
  certifications: [],
};
const jd = 'Job Title: Junior Backend Developer\nRequired skills: Python, Django, REST API, PostgreSQL, Docker, AWS, Linux.';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { act(() => root.unmount()); container.remove(); });

function mount(tier: 'quick' | 'smart' | 'deep', onContinue = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(React.createElement(BoostQuestionsModal, {
    resume, jobDescription: jd, candidateType: 'fresher', tier, beforeRun: true, onContinue, onClose: vi.fn(),
  })));
  return onContinue;
}
const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
const click = (el: Element | undefined) => act(() => { (el as HTMLElement).click(); });

describe('BoostQuestionsModal before a paid run', () => {
  it('Deep: no Skip, Continue needs an answer, then shows the prediction before paying', () => {
    const onContinue = mount('deep');
    expect(button('Skip')).toBeUndefined();
    expect(button('Continue')!.disabled).toBe(true);

    const none = [...container.querySelectorAll('label')].find(l => l.textContent?.includes('I have none of these'))!;
    click(none.querySelector('input')!);
    expect(button('Continue')!.disabled).toBe(false);

    click(button('Continue'));
    expect(onContinue).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Max possible for this job: ~\d+/);
    expect(container.textContent).toMatch(/target 90/);
    expect(container.textContent).toContain('Your plan to close the gap');

    click(button('Confirm more'));
    expect(container.textContent).toContain('Tick the skills you actually have');
    click(button('Continue'));
    click(button('Continue anyway'));
    expect(onContinue).toHaveBeenCalledWith(null);
  });

  it('Smart keeps Skip and also shows the prediction', () => {
    const onContinue = mount('smart');
    expect(button('Skip')).toBeDefined();
    click(button('Continue'));
    expect(container.textContent).toMatch(/target 80|Reaches the 80 target/);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('Quick keeps Skip and goes straight on', () => {
    const onContinue = mount('quick');
    expect(button('Skip')).toBeDefined();
    click(button('Continue'));
    expect(onContinue).toHaveBeenCalledWith(null);
  });
});

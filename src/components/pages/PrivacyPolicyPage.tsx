import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

const sections = [
  {
    title: 'Information We Collect',
    paragraphs: ['When you use the platform, we may collect:'],
    bullets: [
      'Resume files uploaded by users',
      'Job descriptions entered by users',
      'Account and profile information such as your name, email address, phone number, education, skills and links',
      'Job applications you make through the platform and the answers you give for them',
      'If you choose to save one for Auto Apply, the username and password for a job site. The password is encrypted before it is stored',
      'Payment records. Card and bank details are handled by our payment provider',
    ],
  },
  {
    title: 'How We Use Your Information',
    paragraphs: ['The information you provide is used only for:'],
    bullets: [
      'Generating optimized resumes based on job descriptions',
      'Filling and submitting job applications when you ask us to',
      'Improving the functionality and performance of the platform',
      'Providing customer support if required',
    ],
  },
  {
    title: 'Data Sharing',
    paragraphs: [
      'Primoboost AI does not sell or rent user data, and does not share it with recruiters unless you apply to a job through the platform.',
      'Your resume and job description are used only for generating the requested output. When you apply through the platform, your application is sent to that employer or its job site.',
    ],
  },
  {
    title: 'AI Processing',
    paragraphs: [
      'To generate optimized resumes, user data is sent to third-party AI service providers for processing. Their own terms govern how they handle that data.',
    ],
  },
  {
    title: 'Data Storage',
    paragraphs: [
      'We store your profile, optimization history (including the resume text and job description), resumes prepared for applications, and applications in your account, so that you can return to them. Parts of the service that do not need this data process it without storing it.',
    ],
  },
  {
    title: 'User Rights',
    paragraphs: [
      'Users may request deletion of their data at any time by contacting our support team.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'We implement reasonable security measures to protect user data from unauthorized access.',
    ],
  },
];

export const PrivacyPolicyPage: React.FC = () => (
  <LegalPageLayout
    title="Privacy Policy"
    description="Read how PrimoBoost AI collects, processes, protects, and handles resume data, job descriptions, and account information."
    canonical="/privacy-policy"
    eyebrow="Legal"
    badgeLabel="Privacy Policy"
    effectiveDate="November 2026"
    intro="Primoboost AI respects your privacy and is committed to protecting your personal information."
    sections={sections}
  />
);

export default PrivacyPolicyPage;

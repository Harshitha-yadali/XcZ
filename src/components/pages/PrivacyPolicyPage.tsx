import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

const sections = [
  {
    title: 'Information We Collect',
    paragraphs: ['When you use the platform, we may collect:'],
    bullets: [
      'Resume files uploaded by users',
      'Job descriptions entered by users',
      'Basic account information such as email address if account creation is required',
    ],
  },
  {
    title: 'How We Use Your Information',
    paragraphs: ['The information you provide is used only for:'],
    bullets: [
      'Generating optimized resumes based on job descriptions',
      'Improving the functionality and performance of the platform',
      'Providing customer support if required',
    ],
  },
  {
    title: 'Data Sharing',
    paragraphs: [
      'Primoboost AI does not sell, rent, or share user data with any external organizations or recruiters.',
      'Your resume and job description are used only for generating the requested output.',
    ],
  },
  {
    title: 'AI Processing',
    paragraphs: [
      'To generate optimized resumes, user data may be temporarily processed by secure AI service providers. These providers process data only for generating results and do not store or use the information for other purposes.',
    ],
  },
  {
    title: 'Data Storage',
    paragraphs: [
      'Uploaded resumes and job descriptions are processed temporarily and are not permanently stored on our servers.',
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
    effectiveDate="March 2026"
    intro="Primoboost AI respects your privacy and is committed to protecting your personal information."
    sections={sections}
  />
);

export default PrivacyPolicyPage;

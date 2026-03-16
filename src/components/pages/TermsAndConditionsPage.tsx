import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

const sections = [
  {
    title: 'Service Description',
    paragraphs: [
      'Primoboost AI provides an AI-powered resume optimization tool that helps users improve their resumes based on job descriptions.',
    ],
  },
  {
    title: 'User Responsibility',
    paragraphs: [
      'Users are responsible for ensuring that all information included in their resumes is accurate and truthful.',
      'Primoboost AI does not verify or validate the accuracy of resume content.',
    ],
  },
  {
    title: 'No Employment Guarantee',
    paragraphs: [
      'Using Primoboost AI does not guarantee job interviews, employment, or hiring outcomes.',
    ],
  },
  {
    title: 'Intellectual Property',
    paragraphs: [
      'All platform content, design, and software used in Primoboost AI are the property of the platform and may not be copied or distributed without permission.',
    ],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      'Primoboost AI is not responsible for hiring decisions made by employers or recruiters.',
    ],
  },
  {
    title: 'Changes to Terms',
    paragraphs: [
      'These terms may be updated periodically. Continued use of the platform indicates acceptance of any changes.',
    ],
  },
];

export const TermsAndConditionsPage: React.FC = () => (
  <LegalPageLayout
    title="Terms & Conditions"
    description="Review the terms that govern access to and use of PrimoBoost AI, including service scope, user responsibilities, and liability limits."
    canonical="/terms-and-conditions"
    eyebrow="Legal"
    badgeLabel="Terms & Conditions"
    effectiveDate="March 2026"
    intro="By accessing and using Primoboost AI, you agree to the following terms."
    sections={sections}
  />
);

export default TermsAndConditionsPage;

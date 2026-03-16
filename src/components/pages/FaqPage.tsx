import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

const faqs = [
  {
    question: 'What is Primoboost AI?',
    answer:
      'Primoboost AI is an AI-powered tool that helps optimize resumes based on a specific job description to improve ATS compatibility and recruiter shortlisting chances.',
  },
  {
    question: 'How does Primoboost AI work?',
    answer:
      'Users upload their resume and paste the job description. The system analyzes both and generates an optimized resume aligned with the job requirements.',
  },
  {
    question: 'Will the platform change my experience or add fake information?',
    answer:
      'No. Primoboost AI only improves wording, structure, and formatting. It does not create fake experience.',
  },
  {
    question: 'Is my resume data safe?',
    answer:
      'Yes. Your resume and job description are used only to generate the optimized resume and are not shared or sold to any third parties.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'Users can upload resumes in PDF or DOCX format.',
  },
  {
    question: 'Can I download the optimized resume?',
    answer: 'Yes. After processing, the optimized resume can be downloaded.',
  },
  {
    question: 'Does Primoboost AI guarantee a job or interview?',
    answer:
      'No. The platform improves resume quality but cannot guarantee interviews or job offers.',
  },
];

export const FaqPage: React.FC = () => (
  <LegalPageLayout
    title="Frequently Asked Questions"
    description="Answers to common questions about PrimoBoost AI, resume optimization, data safety, supported formats, and platform usage."
    canonical="/faq"
    eyebrow="Support"
    badgeLabel="FAQ"
    intro="Everything users typically ask before they upload a resume, run an optimization, or evaluate how PrimoBoost AI handles their data and outputs."
    faqs={faqs}
  />
);

export default FaqPage;

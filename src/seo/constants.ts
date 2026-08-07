export const SITE_URL = 'https://primoboost.ai';
export const SITE_NAME = 'PrimoBoost AI';
export const DEFAULT_OG_IMAGE =
  'https://res.cloudinary.com/dlkovvlud/image/upload/w_1200,h_630,c_fill,g_auto,b_rgb:0a1e1e/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg';
export const LOGO_IMAGE =
  'https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg';
export const DEFAULT_TITLE = 'Free ATS Resume Checker & AI Resume Optimizer | PrimoBoost AI';
export const DEFAULT_DESCRIPTION =
  'Check your resume against any job description for free, identify ATS issues, and fix them with PrimoBoost AI — built for job seekers in India.';
export const SOCIAL_PROFILES = [
  'https://instagram.com/primoboostai',
  'https://linkedin.com/company/primoboost-ai',
];

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

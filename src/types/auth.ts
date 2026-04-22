// Import resume types for user profile
import { Education, WorkExperience, Skill, Project, Certification } from './resume';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  username?: string;
  referralCode?: string;
  isVerified: boolean;
  createdAt: string;
  lastLogin: string;
  hasSeenProfilePrompt?: boolean;
  resumesCreatedCount?: number;
  role?: 'client' | 'admin' | 'referral_admin';
  // NEW: Resume-related details
  resumeHeadline?: string;
  currentLocation?: string;
  educationDetails?: Education[];
  experienceDetails?: WorkExperience[];
  skillsDetails?: Skill[];
  projectsDetails?: Project[];
  certificationsDetails?: Certification[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
}

export interface SignupCredentials {
  email: string;
}

export interface EmailOtpCredentials {
  email: string;
  otp: string;
}

export interface ForgotPasswordData {
  email: string;
}

interface ResetPasswordData {
  password: string;
  confirmPassword: string;
}

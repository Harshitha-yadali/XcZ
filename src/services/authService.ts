// src/services/authService.ts
import { User, LoginCredentials, SignupCredentials, EmailOtpCredentials } from '../types/auth';
import { supabase } from '../lib/supabaseClient';
import { deviceTrackingService } from './deviceTrackingService';

class AuthService {
  // Add a static variable to track the last time device activity was logged
  private static lastDeviceActivityLog: number = 0;
  private static readonly DEVICE_ACTIVITY_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private getFallbackName(email: string): string {
    const localPart = this.normalizeEmail(email).split('@')[0] || 'User';
    return localPart.replace(/[._-]+/g, ' ').trim() || 'User';
  }

  // MODIFIED: Updated isValidGmail to validate any email address
  private isValidEmail(email: string): boolean {
    console.log('DEBUG: isValidEmail received email:', email);
    const trimmedEmail = (email || '').trim();
    console.log('DEBUG: isValidEmail trimmedEmail:', trimmedEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // General email regex
    const isValid = emailRegex.test(trimmedEmail);
    console.log('DEBUG: isValidEmail regex test result:', isValid);
    return isValid;
  }

  private async sendEmailOtp(email: string, shouldCreateUser: boolean): Promise<string> {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) throw new Error('Email address is required.');
    if (!this.isValidEmail(normalizedEmail)) throw new Error('Please enter a valid email address.');

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser,
        emailRedirectTo: window.location.origin,
        ...(shouldCreateUser
          ? {
              data: {
                full_name: this.getFallbackName(normalizedEmail),
              },
            }
          : {}),
      },
    });

    if (error) {
      console.error('AuthService: signInWithOtp error:', error);
      if (!shouldCreateUser && (error.message.includes('User not found') || error.message.includes('Signups not allowed for otp'))) {
        throw new Error('No account found with this email. Please sign up first.');
      }
      if (error.message.includes('rate limit') || error.message.includes('Too many requests')) {
        throw new Error('Too many OTP requests. Please wait a moment and try again.');
      }
      throw new Error(error.message);
    }

    return normalizedEmail;
  }

  async login(credentials: LoginCredentials): Promise<void> {
    console.log('AuthService: Starting OTP login for email:', credentials.email);
    await this.sendEmailOtp(credentials.email, false);
    console.log('AuthService: Login OTP sent successfully.');
  }

  async signup(credentials: SignupCredentials): Promise<{ needsVerification: boolean; email: string }> {
    console.log('AuthService: Starting OTP signup for email:', credentials.email);
    const email = await this.sendEmailOtp(credentials.email, true);
    console.log('AuthService: Signup OTP sent successfully.');
    return {
      needsVerification: true,
      email,
    };
  }

  private async ensureUserProfileForOtpUser(userId: string, email: string): Promise<{ created: boolean; displayName: string }> {
    const fallbackName = this.getFallbackName(email);
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email_address')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('AuthService: Error checking user profile:', fetchError);
      throw new Error(fetchError.message);
    }

    if (!existingProfile) {
      const { error: insertError } = await supabase.from('user_profiles').insert({
        id: userId,
        full_name: fallbackName,
        email_address: email,
        role: 'client',
        has_seen_profile_prompt: false,
        resumes_created_count: 0,
      });

      if (insertError) {
        console.error('AuthService: Error creating OTP user profile:', insertError);
        throw new Error(insertError.message);
      }

      return { created: true, displayName: fallbackName };
    }

    const updates: Record<string, string> = {};
    if (!existingProfile.full_name) updates.full_name = fallbackName;
    if (!existingProfile.email_address) updates.email_address = email;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('AuthService: Error updating OTP user profile:', updateError);
        throw new Error(updateError.message);
      }
    }

    return {
      created: false,
      displayName: existingProfile.full_name || fallbackName,
    };
  }

  private async sendWelcomeEmail(userId: string, recipientEmail: string, recipientName: string): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          userId,
          recipientEmail,
          recipientName,
        },
      });

      if (error) {
        console.error('AuthService: Welcome email failed:', error);
      }
    } catch (emailError) {
      console.warn('AuthService: Failed to send welcome email:', emailError);
    }
  }

  async verifyEmailOtp(credentials: EmailOtpCredentials): Promise<User> {
    const email = this.normalizeEmail(credentials.email);
    const otp = (credentials.otp || '').trim();

    if (!email) throw new Error('Email address is required.');
    if (!this.isValidEmail(email)) throw new Error('Please enter a valid email address.');
    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Enter the 6-digit code sent to your email.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    if (error) {
      console.error('AuthService: verifyOtp error:', error);
      if (error.message.includes('Token has expired')) {
        throw new Error('This OTP has expired. Please request a new one.');
      }
      if (error.message.includes('Invalid token')) {
        throw new Error('Invalid OTP. Please check the code and try again.');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('OTP verification failed. Please try again.');
    }

    const { created, displayName } = await this.ensureUserProfileForOtpUser(data.user.id, email);

    if (created) {
      await this.sendWelcomeEmail(data.user.id, email, displayName);
    }

    try {
      const deviceId = await deviceTrackingService.registerDevice(data.user.id);
      if (deviceId && data.session) {
        await deviceTrackingService.logActivity(
          data.user.id,
          'login',
          {
            loginMethod: 'email_otp',
            success: true
          },
          deviceId
        );
        AuthService.lastDeviceActivityLog = Date.now();
      }
    } catch (deviceError) {
      console.warn('AuthService: Device tracking failed during OTP verification:', deviceError);
    }

    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('OTP verified, but we could not load your account. Please try again.');
    }

    return user;
  }

  public async fetchUserProfile(userId: string): Promise<{
    full_name: string,
    email_address: string,
    phone?: string,
    linkedin_profile_url?: string,
    github_profile_url?: string,
    username?: string,
    referral_code?: string,
    has_seen_profile_prompt?: boolean,
    resumes_created_count?: number,
    role?: 'client' | 'admin',
    resume_headline?: string,
    current_location?: string,
    education_details?: any,
    experience_details?: any,
    skills_details?: any,
    certifications_details?: any,
    projects_details?: any
  } | null> {
    console.log('AuthService: Fetching user profile for user ID:', userId);
    try {
      const { data, error }
        = await supabase
        .from('user_profiles')
        .select('full_name, email_address, phone, linkedin_profile_url, github_profile_url, username, referral_code, has_seen_profile_prompt, resumes_created_count, role, resume_headline, current_location, education_details, experience_details, skills_details, certifications_details, projects_details')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('AuthService: Error fetching user profile from DB:', error);
        return null;
      }
      console.log('AuthService: User profile fetched from DB:', data ? data.full_name : 'none');
      return data;
    } catch (error) {
      console.error('AuthService: Error in fetchUserProfile catch block:', error);
      return null;
    }
  }

  // Streamlined getCurrentUser to primarily handle session validity and return full user object
  async getCurrentUser(): Promise<User | null> {
    console.log('AuthService: Starting getCurrentUser (streamlined)...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('AuthService: getSession error in getCurrentUser:', error);
        return null;
      }

      if (!session?.user) {
        console.log('AuthService: No user in session in getCurrentUser.');
        return null;
      }
      console.log('AuthService: Session found. User ID:', session.user.id);

      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now + 300) { // Refresh if expires in 5 minutes
        console.log('AuthService: Session expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.error('AuthService: Session refresh failed:', refreshError);
          if (refreshError?.message === "Invalid Refresh Token: Refresh Token Not Found") {
            console.warn('AuthService: Invalid refresh token detected. Forcing logout.');
            await supabase.auth.signOut();
          }
          return null;
        }
        console.log('AuthService: ✅ Session refreshed successfully in getCurrentUser.');
        session.user = refreshData.session.user; // Update user object from refreshed session
      }

      // Update device activity for current session, but only if interval has passed
      const currentTime = Date.now();
      if (currentTime - AuthService.lastDeviceActivityLog > AuthService.DEVICE_ACTIVITY_LOG_INTERVAL_MS) {
        try {
          console.log('AuthService: Attempting device activity update...');
          const deviceId = await deviceTrackingService.registerDevice(session.user.id);
          if (deviceId) {
            await deviceTrackingService.logActivity(session.user.id, 'session_activity', {
              action: 'session_check',
              timestamp: new Date().toISOString()
            }, deviceId);
            AuthService.lastDeviceActivityLog = currentTime; // Update last log time
            console.log('AuthService: Device activity updated.');
          } else {
            console.warn('AuthService: Device ID not obtained for activity update.');
          }
        } catch (deviceError) {
          console.warn('AuthService: Device activity update failed during session check:', deviceError);
        }
      } else {
        console.log('AuthService: Skipping device activity update (interval not passed).');
      }

      // Fetch the full profile using the new public method
      const profile = await this.fetchUserProfile(session.user.id);
      console.log('AuthService: User profile fetched for getCurrentUser. Profile:', profile ? profile.full_name : 'none');

      const isAdmin = session.user.email === 'primoboostai@gmail.com';
const profileRole = profile?.role || (isAdmin ? 'admin' : 'client');

      const userResult: User = {
        id: session.user.id,
        name: profile?.full_name || session.user.email?.split('@')[0] || 'User',
        email: profile?.email_address || session.user.email!,
        phone: profile?.phone || undefined,
        linkedin: profile?.linkedin_profile_url || undefined,
        github: profile?.github_profile_url || undefined,
        referralCode: profile?.referral_code || undefined,
        username: profile?.username || undefined,
        isVerified: session.user.email_confirmed_at !== null,
        createdAt: session.user.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        hasSeenProfilePrompt: profile?.has_seen_profile_prompt || false,
        resumesCreatedCount: profile?.resumes_created_count || 0,
        role: profileRole as 'admin' | 'client',
        resumeHeadline: profile?.resume_headline || undefined,
        currentLocation: profile?.current_location || undefined,
        educationDetails: profile?.education_details || undefined,
        experienceDetails: profile?.experience_details || undefined,
        skillsDetails: profile?.skills_details || undefined,
        certificationsDetails: profile?.certifications_details || undefined,
        projectsDetails: profile?.projects_details || undefined
      };
      console.log('AuthService: getCurrentUser completed. Returning user data.');
      return userResult;
    } catch (error) {
      console.error('AuthService: Error in getCurrentUser:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    console.log('AuthService: Starting logout process...');
    // Capture session info BEFORE signing out
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const accessToken = session?.access_token;

    console.log('AuthService: Calling supabase.auth.signOut() first for immediate UI feedback.');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('AuthService: supabase.auth.signOut() failed:', error);
      throw new Error('Failed to sign out. Please try again.');
    }

    console.log('AuthService: supabase.auth.signOut() completed. Now handling device tracking.');
    try {
      if (userId && accessToken) {
        console.log('AuthService: Previous session info captured, attempting to log logout activity.');
        const deviceId = await deviceTrackingService.registerDevice(userId); // Use captured userId
        if (deviceId) {
          await deviceTrackingService.logActivity(userId, 'logout', { // Use captured userId
            logoutMethod: 'manual',
            timestamp: new Date().toISOString()
          }, deviceId);
          console.log('AuthService: Logout activity logged. Ending session via device tracking service.');
          await deviceTrackingService.endSession(accessToken, 'logout'); // Use captured accessToken
        } else {
          console.warn('AuthService: Device ID not obtained, skipping device tracking session end.');
        }
      } else {
        console.log('AuthService: No active session info to log for device tracking after sign out.');
      }
    } catch (deviceError) {
      console.warn('AuthService: Failed to log logout activity or end session via device tracking:', deviceError);
    }
    console.log('AuthService: Logout process finished.');
  }

async forgotPassword(email: string): Promise<void> {
  console.log('AuthService: Starting forgotPassword for email:', email);

  if (!this.isValidEmail(email)) {
    throw new Error('Please enter a valid email address.');
  }

  // Check rate limit before sending reset email
  try {
    const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc(
      'check_password_reset_rate_limit',
      { p_email: email }
    );

    if (rateLimitError) {
      console.error('AuthService: Rate limit check error:', rateLimitError);
      // Continue even if rate limit check fails
    } else if (rateLimitCheck && !rateLimitCheck.allowed) {
      const minutes = Math.ceil(rateLimitCheck.retry_after_seconds / 60);
      throw new Error(
        `Too many password reset attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }

  // Get the current origin for redirect URL
 const redirectUrl = `${window.location.origin}/reset-password`;

  console.log('AuthService: Password reset redirect URL:', redirectUrl);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  // Log the attempt
  try {
    await supabase.rpc('log_password_reset_attempt', {
      p_email: email,
      p_ip_address: null, // Could be captured from client if needed
      p_user_agent: navigator.userAgent,
      p_success: error === null
    });
  } catch (logError) {
    console.warn('AuthService: Failed to log password reset attempt:', logError);
  }

  if (error) {
    console.error('AuthService: resetPasswordForEmail error:', error);
    throw new Error(error.message);
  }

  console.log('AuthService: Password reset email sent successfully.');
}

  async resetPassword(newPassword: string): Promise<{ user: User | null; autoLoginSuccess: boolean }> {
    console.log('AuthService: Starting resetPassword...');
    
    // Validate access token from URL first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('AuthService: No valid session found for password reset:', sessionError);
      throw new Error('Invalid or expired reset link. Please request a new password reset.');
    }

    const passwordValidation = this.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) throw new Error(passwordValidation.message!);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error('AuthService: updateUser error during password reset:', error);
      throw new Error(error.message);
    }

    console.log('AuthService: Password reset successful.');
    
    // User is already authenticated after password reset, fetch their profile
    const user = await this.getCurrentUser();
    
    return {
      user,
      autoLoginSuccess: !!user
    };
  }

  async verifyEmail(token: string): Promise<void> {
    console.log('AuthService: Verifying email with token');
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    });
    if (error) {
      console.error('AuthService: Email verification error:', error);
      throw new Error(error.message);
    }
    console.log('AuthService: Email verified successfully');
  }

  async refreshUserProfile(userId: string): Promise<User | null> {
    console.log('AuthService: Refreshing user profile for user ID:', userId);
    const profile = await this.fetchUserProfile(userId);
    if (!profile) {
      console.warn('AuthService: Could not fetch profile for refreshUserProfile.');
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('AuthService: No session found during refreshUserProfile.');
      return null;
    }

    const isAdmin = session.user.email === 'primoboostai@gmail.com';
const profileRole = profile?.role || (isAdmin ? 'admin' : 'client');

    const userResult: User = {
      id: session.user.id,
      name: profile.full_name || session.user.email?.split('@')[0] || 'User',
      email: profile.email_address || session.user.email!,
      phone: profile.phone || undefined,
      linkedin: profile.linkedin_profile_url || undefined,
      github: profile.github_profile_url || undefined,
      referralCode: profile.referral_code || undefined,
      username: profile.username || undefined,
      isVerified: session.user.email_confirmed_at !== null,
      createdAt: session.user.created_at || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      hasSeenProfilePrompt: profile.has_seen_profile_prompt || false,
      resumesCreatedCount: profile.resumes_created_count || 0,
      role: profileRole as 'admin' | 'client',
      resumeHeadline: profile.resume_headline || undefined,
      currentLocation: profile.current_location || undefined,
      educationDetails: profile.education_details || undefined,
      experienceDetails: profile.experience_details || undefined,
      skillsDetails: profile.skills_details || undefined,
      certificationsDetails: profile.certifications_details || undefined,
      projectsDetails: profile.projects_details || undefined
    };

    console.log('AuthService: refreshUserProfile completed.');
    return userResult;
  }

  async updateUserProfile(userId: string, updates: {
    full_name?: string;
    email_address?: string;
    phone?: string;
    linkedin_profile?: string;
    github_profile?: string;
    has_seen_profile_prompt?: boolean;
    resume_headline?: string;
    current_location?: string;
    education_details?: any;
    experience_details?: any;
    skills_details?: any;
    projects_details?: any;
    certifications_details?: any;
  }): Promise<void> {
    console.log('AuthService: Starting updateUserProfile for user ID:', userId, 'updates:', updates);
    try {
      const dbUpdates: { [key: string]: any } = {
  full_name: updates.full_name,
  email_address: updates.email_address,
  phone: updates.phone,
  linkedin_profile_url: updates.linkedin_profile, // FIXED: Correct column name
  github_profile_url: updates.github_profile, // FIXED: Correct column name (was wellfound_profile)
  has_seen_profile_prompt: updates.has_seen_profile_prompt,
  resume_headline: updates.resume_headline,
  current_location: updates.current_location,
  education_details: updates.education_details,
  experience_details: updates.experience_details,
  skills_details: updates.skills_details,
  projects_details: updates.projects_details,
  certifications_details: updates.certifications_details,
  profile_updated_at: new Date().toISOString(),
};

Object.keys(dbUpdates).forEach((key) => {
  if (dbUpdates[key] === undefined) {
    delete dbUpdates[key];
  }
});

      const { error } = await supabase
        .from('user_profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        console.error('AuthService: Error updating user profile in DB:', error);
        throw new Error('Failed to update profile');
      }
      console.log('AuthService: User profile updated successfully in DB.');
    } catch (error) {
      console.error('AuthService: Error in updateUserProfile catch block:', error);
      throw error;
    }
  }

  async markProfilePromptSeen(userId: string): Promise<void> {
    console.log('AuthService: Marking profile prompt as seen for user ID:', userId);
    try {
       await this.updateUserProfile(userId, {
        has_seen_profile_prompt: true
      });
      console.log('AuthService: Profile prompt marked as seen successfully.');
    } catch (error) {
      console.error('AuthService: Error marking profile prompt as seen:', error);
      throw new Error('Failed to update profile prompt status');
    }
  }

  async ensureValidSession(): Promise<boolean> {
    console.log('AuthService: Starting ensureValidSession...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('AuthService: getSession result - session:', session ? 'exists' : 'null', 'error:', error);

      if (error) {
        console.error('AuthService: Session check failed in ensureValidSession:', error);
        console.log('AuthService: Returning false due to getSession error.');
        return false;
      }

      if (!session?.user) {
        console.log('AuthService: No session found in ensureValidSession.');
        return false;
      }

      console.log('AuthService: Session exists. Checking expiration...');
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now + 300) {
        console.log('AuthService: Session expiring soon, attempting refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.error('AuthService: Session refresh failed in ensureValidSession:', refreshError);
          console.log('AuthService: Returning false due to session refresh error.');
          if (refreshError?.message === "Invalid Refresh Token: Refresh Token Not Found") {
            console.warn('AuthService: Invalid refresh token detected. Forcing logout.');
            await supabase.auth.signOut();
          }
          return false;
        }
        console.log('AuthService: ✅ Session refreshed successfully in ensureValidSession.');
      } else {
        console.log('AuthService: Session is valid and not expiring soon.');
      }

      console.log('AuthService: ensureValidSession completed. Returning true.');
      return true;
    } catch (error) {
      console.error('AuthService: Error in ensureValidSession:', error);
      console.log('AuthService: Returning false due to catch block error.');
      return false;
    }
  }

  // Return total resumes created (app-wide)
  async getGlobalResumesCreatedCount(): Promise<number> {
    console.log('AuthService: Fetching global resumes created count...');
    try {
      const { data, error } = await supabase
        .from('app_metrics')
        .select('metric_value')
        .eq('metric_name', 'total_resumes_created')
        .single();
      
      if (error) {
        console.error('AuthService: Error fetching global resumes count:', error);
        return 50000; // Return default if fetch fails
      }
      
      console.log('AuthService: Global resumes count fetched successfully:', data.metric_value);
      return data.metric_value;
    } catch (error) {
      console.error('AuthService: Error in getGlobalResumesCreatedCount catch block:', error);
      return 50000; // Return default if fetch fails
    }
  }

  // Increment current user's resume count (user_profiles.resumes_created_count)
  async incrementResumesCreatedCount(userId: string): Promise<number> {
    try {
      const profile = await this.fetchUserProfile(userId);
      const current = profile?.resumes_created_count ?? 0;
      const next = current + 1;

      const { error } = await supabase
        .from('user_profiles')
        .update({ resumes_created_count: next })
        .eq('id', userId);

      if (error) {
        console.error('AuthService: Failed to update resumes_created_count:', error);
        throw new Error(error.message);
      }

      console.log('AuthService: resumes_created_count incremented to', next);
      return next;
    } catch (err) {
      console.error('AuthService: Error incrementing user resumes count:', err);
      throw err;
    }
  }

  // Increment global metric total_resumes_created in app_metrics
  async incrementGlobalResumesCreatedCount(): Promise<number> {
    try {
      console.log('AuthService: Incrementing global resumes created count via RPC...');
      const { data, error } = await supabase.rpc('increment_total_resumes_created');

      if (error) {
        console.error('AuthService: Failed to increment total_resumes_created via RPC:', error);
        throw new Error(error.message);
      }

      const newCount = typeof data === 'number' ? data : Number(data ?? 0);
      console.log('AuthService: total_resumes_created incremented to', newCount);
      return newCount;
    } catch (err) {
      console.error('AuthService: Error incrementing global resumes count:', err);
      throw err;
    }
  }

}

export const authService = new AuthService();

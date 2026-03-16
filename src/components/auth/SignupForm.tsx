import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, UserPlus, AlertCircle, Loader2, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { EmailOtpCredentials, SignupCredentials } from '../../types/auth';

const signupSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .refine((email) => email.includes('@') && email.split('@')[1]?.includes('.'), {
      message: 'Please enter a valid email address with @ and domain',
    }),
});

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin }) => {
  const { signup, verifyEmailOtp } = useAuth();
  const { isChristmasMode } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignupCredentials>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupCredentials) => {
    setIsLoading(true);
    setError(null);
    setOtpError(null);

    try {
      if (!otpSent) {
        const result = await signup(data);
        setSentEmail(result.email);
        setOtpSent(true);
        setOtp('');
      } else {
        const otpPayload: EmailOtpCredentials = {
          email: sentEmail || data.email,
          otp,
        };
        await verifyEmailOtp(otpPayload);
        setIsSuccess(true);
      }
    } catch (err) {
      let errorMessage = otpSent ? 'Code verification failed. Please try again.' : 'Could not send the sign-up email. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('6-digit OTP') || err.message.includes('Invalid OTP') || err.message.includes('expired')) {
          setOtpError(err.message);
          errorMessage = '';
        } else {
          errorMessage = err.message;
        }
      }

      if (errorMessage) {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const email = sentEmail || getValues('email');
    if (!email) return;

    setIsLoading(true);
    setError(null);
    setOtpError(null);

    try {
      const result = await signup({ email });
      setSentEmail(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass = `w-full pl-12 pr-4 py-3.5 rounded-xl transition-all duration-200 text-white placeholder-slate-500 border-2 border-slate-700 bg-slate-800/50 focus:bg-slate-800 hover:border-slate-600 ${
    isChristmasMode
      ? 'focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
      : 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  }`;

  const inputErrorClass = 'border-2 border-red-500/50 bg-red-500/10 focus:border-red-500 focus:ring-2 focus:ring-red-500/20';

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
          isChristmasMode
            ? 'bg-green-500/20 border border-green-500/30'
            : 'bg-emerald-500/20 border border-emerald-500/30'
        }`}>
          <CheckCircle className={`w-8 h-8 ${isChristmasMode ? 'text-green-400' : 'text-emerald-400'}`} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Code Verified!</h2>
        <p className="text-slate-400">Creating your session now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-500" />
            </div>
            <input
              {...register('email')}
              type="email"
              placeholder="your.email@example.com"
              disabled={otpSent}
              className={errors.email ? `w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-slate-500 ${inputErrorClass}` : inputBaseClass}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            We will send a 6-digit sign-up code to this address.
          </p>
          {errors.email && (
            <p className="mt-2 text-sm text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.email.message}
            </p>
          )}
        </div>

        {otpSent && (
          <div className={`p-4 rounded-xl border ${
            isChristmasMode
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <p className="text-sm text-slate-200">
              We sent a 6-digit sign-up code to <strong className="text-white">{sentEmail}</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Enter the 6-digit code below to continue.
            </p>
          </div>
        )}

        {otpSent && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              6-Digit Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-slate-500" />
              </div>
              <input
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setOtpError(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                className={`${otpError ? `w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-slate-500 ${inputErrorClass}` : inputBaseClass}`}
              />
            </div>
            {otpError && (
              <p className="mt-2 text-sm text-red-400 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {otpError}
              </p>
            )}
          </div>
        )}

        {otpSent && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
                setOtpError(null);
                setError(null);
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isLoading}
              className={`font-medium transition-colors ${
                isChristmasMode ? 'text-green-400 hover:text-green-300' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Resend Email
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center space-x-2 mt-2 ${
            isLoading
              ? 'bg-slate-700 cursor-not-allowed'
              : isChristmasMode
                ? 'bg-gradient-to-r from-red-500 via-emerald-500 to-green-600 hover:shadow-lg hover:shadow-green-500/30 active:scale-[0.98]'
                : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{otpSent ? 'Verifying Code...' : 'Sending Email...'}</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>{otpSent ? 'Verify 6-Digit Code' : 'Send Sign-Up Email'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className={`text-center pt-4 border-t ${
        isChristmasMode ? 'border-green-500/20' : 'border-emerald-500/20'
      }`}>
        <p className="text-slate-400 text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className={`font-semibold transition-colors ${
              isChristmasMode ? 'text-green-400 hover:text-green-300' : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );
};

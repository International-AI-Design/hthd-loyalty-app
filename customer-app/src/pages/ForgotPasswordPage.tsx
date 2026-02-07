import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Alert } from '../components/ui';
import { passwordResetApi } from '../lib/api';

// Form schemas for each step
const identifierSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
});

const resetSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type IdentifierFormData = z.infer<typeof identifierSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

type Step = 'identifier' | 'reset' | 'success';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('identifier');
  const [serverError, setServerError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState<string>('');

  // Form hooks
  const identifierForm = useForm<IdentifierFormData>({
    resolver: zodResolver(identifierSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  // Step 1: Request reset code
  const onRequestCode = async (data: IdentifierFormData) => {
    setServerError(null);
    const trimmedIdentifier = data.identifier.trim();

    const { error } = await passwordResetApi.forgotPassword(trimmedIdentifier);

    if (error) {
      setServerError(error);
      return;
    }

    setIdentifier(trimmedIdentifier);
    setStep('reset');
  };

  // Step 2: Verify code and reset password
  const onResetPassword = async (data: ResetFormData) => {
    setServerError(null);

    // First verify the code
    const verifyResult = await passwordResetApi.verifyResetCode(identifier, data.code);

    if (verifyResult.error) {
      setServerError(verifyResult.error);
      return;
    }

    if (!verifyResult.data?.resetToken) {
      setServerError('Verification failed. Please try again.');
      return;
    }

    // Then reset the password
    const resetResult = await passwordResetApi.resetPassword(
      verifyResult.data.resetToken,
      data.password
    );

    if (resetResult.error) {
      setServerError(resetResult.error);
      return;
    }

    setStep('success');
  };

  // Navigate to login
  const goToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-warm-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brand-navy font-heading">
              {step === 'success' ? 'Password Updated!' : 'Reset Your Password'}
            </h1>
            {step !== 'success' && (
              <p className="text-gray-600 mt-2">
                {step === 'identifier' && 'Enter your email or phone number'}
                {step === 'reset' && 'Check your email for a 6-digit reset code'}
              </p>
            )}
          </div>

          {/* Error message */}
          {serverError && (
            <Alert variant="error" className="mb-6">
              {serverError}
            </Alert>
          )}

          {/* Step 1: Identifier */}
          {step === 'identifier' && (
            <form onSubmit={identifierForm.handleSubmit(onRequestCode)} className="space-y-4">
              <div>
                <Input
                  label="Email or Phone Number"
                  type="text"
                  placeholder="john@example.com or (555) 123-4567"
                  autoComplete="email"
                  {...identifierForm.register('identifier')}
                  error={identifierForm.formState.errors.identifier?.message}
                />
                <p className="text-sm text-gray-500 mt-2">
                  We'll send a reset code to your email on file.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={identifierForm.formState.isSubmitting}
              >
                Send Reset Code
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-brand-blue hover:text-brand-blue-dark"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: Code + Password */}
          {step === 'reset' && (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <Alert variant="info" className="mb-4">
                Check your email for a 6-digit reset code.
              </Alert>

              <Input
                label="6-Digit Code"
                type="text"
                placeholder="123456"
                maxLength={6}
                autoComplete="one-time-code"
                {...resetForm.register('code')}
                error={resetForm.formState.errors.code?.message}
              />

              <Input
                label="New Password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...resetForm.register('password')}
                error={resetForm.formState.errors.password?.message}
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                {...resetForm.register('confirmPassword')}
                error={resetForm.formState.errors.confirmPassword?.message}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={resetForm.formState.isSubmitting}
              >
                Reset Password
              </Button>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep('identifier');
                    setServerError(null);
                    resetForm.reset();
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Use different email/phone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServerError(null);
                    identifierForm.handleSubmit(onRequestCode)();
                  }}
                  className="text-sm text-brand-blue hover:text-brand-blue-dark"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-brand-soft-green rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-brand-navy">
                  Password updated successfully!
                </h2>
                <p className="text-gray-600 mt-2">
                  You can now sign in with your new password.
                </p>
              </div>

              <Button onClick={goToLogin} className="w-full" size="lg">
                Back to Login
              </Button>
            </div>
          )}

          {/* Footer links */}
          {step !== 'success' && (
            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-600">
                Remember your password?{' '}
                <Link to="/login" className="text-brand-blue hover:text-brand-blue-dark font-medium">
                  Sign in
                </Link>
              </p>
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-brand-blue hover:text-brand-blue-dark font-medium">
                  Create one
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Earn points on every visit and redeem for grooming discounts!
        </p>
      </div>
    </div>
  );
}

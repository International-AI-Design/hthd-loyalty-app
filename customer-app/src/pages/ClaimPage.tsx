import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Alert } from '../components/ui';
import { claimApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// Form schemas for each step
const lookupSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
});

const verifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type LookupFormData = z.infer<typeof lookupSchema>;
type VerifyFormData = z.infer<typeof verifySchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

type Step = 'lookup' | 'verify' | 'password' | 'success';

interface DogData {
  id: string;
  name: string;
  breed: string | null;
}

interface VisitData {
  id: string;
  visit_date: string;
  service_type: string;
  description: string | null;
  amount: number;
}

interface CustomerData {
  id: string;
  firstName: string;
  lastName: string;
  emailMasked: string;
  pointsBalance: number;
  dogs: DogData[];
  recentVisits: VisitData[];
}

export function ClaimPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('lookup');
  const [serverError, setServerError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Form hooks for each step
  const lookupForm = useForm<LookupFormData>({
    resolver: zodResolver(lookupSchema),
  });

  const verifyForm = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Step 1: Lookup account
  const onLookup = async (data: LookupFormData) => {
    setServerError(null);

    // Trim whitespace from identifier (handles copy/paste issues)
    const identifier = data.identifier.trim();

    const { data: response, error } = await claimApi.lookup(identifier);

    if (error) {
      setServerError(error);
      return;
    }

    if (response && response.found) {
      setCustomerData({
        id: response.customer.id,
        firstName: response.customer.first_name,
        lastName: response.customer.last_name,
        emailMasked: response.customer.email_masked,
        pointsBalance: response.customer.points_balance,
        dogs: response.customer.dogs || [],
        recentVisits: response.customer.recent_visits || [],
      });
      setStep('verify');
    }
  };

  // Send verification code
  const sendCode = async () => {
    if (!customerData) return;

    setIsSendingCode(true);
    setServerError(null);

    const { error } = await claimApi.sendCode(customerData.id);

    if (error) {
      setServerError(error);
    } else {
      setCodeSent(true);
    }

    setIsSendingCode(false);
  };

  // Step 2: Verify code
  const onVerify = async (data: VerifyFormData) => {
    if (!customerData) return;

    setServerError(null);

    // Just validate the code format and move to password step
    // The actual verification happens when setting password
    setStep('password');
    // Store the code for the final step
    verifyForm.setValue('code', data.code);
  };

  // Step 3: Set password and complete claim
  const onSetPassword = async (data: PasswordFormData) => {
    if (!customerData) return;

    setServerError(null);
    const code = verifyForm.getValues('code');

    const { data: response, error } = await claimApi.verify(
      customerData.id,
      code,
      data.password
    );

    if (error) {
      // If code is invalid, go back to verify step
      if (error.toLowerCase().includes('code')) {
        setStep('verify');
      }
      setServerError(error);
      return;
    }

    if (response && response.success) {
      // Log the user in
      login(response.token, response.customer);
      setStep('success');
    }
  };

  // Go to dashboard after success
  const goToDashboard = () => {
    // Set first-login flag for walkthrough
    localStorage.setItem('hthd_first_login', 'true');
    // Claimed accounts are returning customers — show 'Welcome back'
    localStorage.setItem('hthd_has_visited', 'true');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-brand-warm-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brand-navy font-heading">
              {step === 'success' ? 'Welcome!' : 'Claim Your Account'}
            </h1>
            {step !== 'success' && (
              <p className="text-gray-600 mt-2">
                {step === 'lookup' && 'Enter your phone or email to find your account'}
                {step === 'verify' && 'Enter the verification code sent to your email'}
                {step === 'password' && 'Create a password to secure your account'}
              </p>
            )}
          </div>

          {/* Error message */}
          {serverError && (
            <Alert variant="error" className="mb-6">
              {serverError}
            </Alert>
          )}

          {/* Step 1: Lookup */}
          {step === 'lookup' && (
            <form onSubmit={lookupForm.handleSubmit(onLookup)} className="space-y-4">
              <Input
                label="Email or Phone"
                type="text"
                placeholder="john@example.com or (555) 123-4567"
                autoComplete="email"
                {...lookupForm.register('identifier')}
                error={lookupForm.formState.errors.identifier?.message}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={lookupForm.formState.isSubmitting}
              >
                Find My Account
              </Button>
            </form>
          )}

          {/* Step 2: Verify Code */}
          {step === 'verify' && customerData && (
            <div className="space-y-6">
              {/* Customer preview card */}
              <div className="bg-brand-soft-cream rounded-xl p-6">
                <p className="text-lg text-brand-navy text-center">
                  Hi <span className="font-bold">{customerData.firstName}</span>!
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-brand-blue">
                    {customerData.pointsBalance.toLocaleString()}
                  </span>
                  <span className="text-gray-600">points waiting</span>
                </div>

                {/* Dogs preview */}
                {customerData.dogs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-brand-blue/20">
                    <p className="text-sm text-gray-600 text-center mb-2">Your pups:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {customerData.dogs.map((dog) => (
                        <span
                          key={dog.id}
                          className="bg-white px-3 py-1 rounded-full text-sm font-medium text-brand-navy"
                        >
                          {dog.name}
                          {dog.breed && <span className="text-gray-400 ml-1">({dog.breed})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent visits preview */}
                {customerData.recentVisits.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-brand-blue/20">
                    <p className="text-sm text-gray-600 text-center mb-2">Recent visits:</p>
                    <div className="space-y-2">
                      {customerData.recentVisits.slice(0, 3).map((visit) => (
                        <div
                          key={visit.id}
                          className="bg-white rounded-lg px-3 py-2 flex justify-between items-center text-sm"
                        >
                          <div>
                            <span className="capitalize text-brand-navy">
                              {visit.service_type}
                            </span>
                            <span className="text-gray-400 ml-2">
                              {new Date(visit.visit_date).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-gray-600">${visit.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500 mt-4 text-center">
                  Code will be sent to {customerData.emailMasked}
                </p>
              </div>

              {!codeSent ? (
                <Button
                  onClick={sendCode}
                  className="w-full"
                  size="lg"
                  isLoading={isSendingCode}
                >
                  Send Verification Code
                </Button>
              ) : (
                <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-4">
                  <Alert variant="success" className="mb-4">
                    Code sent! Check your email.
                  </Alert>

                  <Input
                    label="6-Digit Code"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    autoComplete="one-time-code"
                    {...verifyForm.register('code')}
                    error={verifyForm.formState.errors.code?.message}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={verifyForm.formState.isSubmitting}
                  >
                    Verify Code
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setCodeSent(false);
                      sendCode();
                    }}
                    className="w-full text-sm text-brand-blue hover:text-brand-blue-dark"
                    disabled={isSendingCode}
                  >
                    Resend code
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('lookup');
                  setCustomerData(null);
                  setCodeSent(false);
                  setServerError(null);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Use a different email or phone
              </button>
            </div>
          )}

          {/* Step 3: Set Password */}
          {step === 'password' && customerData && (
            <form onSubmit={passwordForm.handleSubmit(onSetPassword)} className="space-y-4">
              <div className="bg-brand-soft-cream rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 text-center">
                  Creating account for <span className="font-medium">{customerData.firstName} {customerData.lastName}</span>
                </p>
              </div>

              <Input
                label="Password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...passwordForm.register('password')}
                error={passwordForm.formState.errors.password?.message}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                {...passwordForm.register('confirmPassword')}
                error={passwordForm.formState.errors.confirmPassword?.message}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={passwordForm.formState.isSubmitting}
              >
                Complete Setup
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('verify');
                  setServerError(null);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Go back
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && customerData && (
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
                  Welcome, {customerData.firstName}!
                </h2>
                <p className="text-gray-600 mt-2">
                  Your account is all set up and ready to go.
                </p>
              </div>

              <div className="bg-brand-soft-cream rounded-xl p-6">
                <p className="text-gray-600">Your points balance:</p>
                <p className="text-4xl font-bold text-brand-blue">
                  {customerData.pointsBalance.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Ready to redeem for grooming discounts!
                </p>
              </div>

              <Button onClick={goToDashboard} className="w-full" size="lg">
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Footer links */}
          {step !== 'success' && (
            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-blue hover:text-brand-blue-dark font-medium">
                  Sign in
                </Link>
              </p>
              <p className="text-gray-600">
                New customer?{' '}
                <Link to="/register" className="text-brand-blue hover:text-brand-blue-dark font-medium">
                  Register
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Earn points on every visit and redeem for grooming discounts!
        </p>

        <p className="mt-6 text-center text-xs text-gray-400">
          <Link to="/privacy" className="hover:text-brand-blue">Privacy Policy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-brand-blue">Terms & Conditions</Link>
        </p>
      </div>
    </div>
  );
}

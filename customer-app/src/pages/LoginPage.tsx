import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Alert, Checkbox } from '../components/ui';
import { authApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember_me: false,
    },
  });

  const onSubmit = async (formData: LoginFormData) => {
    setServerError(null);

    const identifier = formData.identifier.trim();
    const isEmail = identifier.includes('@');
    const loginData = isEmail
      ? { email: identifier, password: formData.password }
      : { phone: identifier, password: formData.password };

    const { data, error, details } = await authApi.login(loginData);

    if (error) {
      const errorDetails = details as { unclaimed?: boolean; redirect?: string } | undefined;
      if (errorDetails?.unclaimed) {
        navigate('/claim');
        return;
      }
      setServerError(error);
      return;
    }

    if (data) {
      localStorage.setItem('hthd_has_visited', 'true');
      login(data.token, data.customer);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-brand-cream flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-full mb-4">
            <span className="text-3xl">🐾</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-brand-forest">Happy Tail</h1>
          <p className="text-brand-forest-muted mt-1">Welcome back to the pack</p>
        </div>

        <div className="bg-white rounded-3xl shadow-warm-lg p-7 border border-brand-sand/30">
          {serverError && (
            <Alert variant="error" className="mb-5">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email or Phone"
              type="text"
              placeholder="john@example.com or (555) 123-4567"
              autoComplete="username"
              {...register('identifier')}
              error={errors.identifier?.message}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />

            <div className="flex items-center justify-between">
              <Checkbox label="Remember me" {...register('remember_me')} />
              <Link
                to="/forgot-password"
                className="text-sm text-brand-primary hover:text-brand-primary-dark font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-brand-forest-muted">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-brand-primary hover:text-brand-primary-dark font-semibold">
              Create one
            </Link>
          </p>

          <div className="mt-5 pt-5 border-t border-brand-sand">
            <p className="text-center text-brand-forest-muted">
              Received an invite?{' '}
              <Link to="/claim" className="text-brand-primary hover:text-brand-primary-dark font-semibold">
                Claim your account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-brand-forest-muted">
          Earn points on every visit and redeem for grooming discounts!
        </p>

        <p className="mt-6 text-center text-xs text-brand-forest-muted/60">
          <Link to="/privacy" className="hover:text-brand-primary">Privacy Policy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-brand-primary">Terms & Conditions</Link>
        </p>
      </div>
    </div>
  );
}

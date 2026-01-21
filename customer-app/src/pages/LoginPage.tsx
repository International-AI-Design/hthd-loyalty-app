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

    // Determine if identifier is email or phone
    const isEmail = formData.identifier.includes('@');
    const loginData = isEmail
      ? { email: formData.identifier, password: formData.password }
      : { phone: formData.identifier, password: formData.password };

    const { data, error } = await authApi.login(loginData);

    if (error) {
      setServerError(error);
      return;
    }

    if (data) {
      login(data.token, data.customer);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-brand-warm-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brand-navy font-heading">Happy Tail Happy Dog</h1>
            <p className="text-gray-600 mt-2">Sign in to your loyalty account</p>
          </div>

          {serverError && (
            <Alert variant="error" className="mb-6">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-brand-teal hover:text-brand-teal-dark font-medium">
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Earn points on every visit and redeem for grooming discounts!
        </p>
      </div>
    </div>
  );
}

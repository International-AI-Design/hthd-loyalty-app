import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Alert } from '../components/ui';
import { authApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const registerSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    referral_code: z
      .string()
      .regex(/^HT-[A-Z0-9]{6}$/, 'Invalid referral code format')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (formData: RegisterFormData) => {
    setServerError(null);

    // Trim whitespace from text fields (handles copy/paste issues)
    const { data, error } = await authApi.register({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
      referral_code: formData.referral_code?.trim() || undefined,
    });

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
            <p className="text-gray-600 mt-2">Create your loyalty account</p>
          </div>

          {serverError && (
            <Alert variant="error" className="mb-6">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                {...register('first_name')}
                error={errors.first_name?.message}
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                {...register('last_name')}
                error={errors.last_name?.message}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="(555) 123-4567"
              {...register('phone')}
              error={errors.phone?.message}
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              {...register('password')}
              error={errors.password?.message}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              {...register('confirm_password')}
              error={errors.confirm_password?.message}
            />

            <Input
              label="Referral Code (optional)"
              placeholder="HT-XXXXXX"
              {...register('referral_code')}
              error={errors.referral_code?.message}
            />

            <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-teal hover:text-brand-teal-dark font-medium">
              Sign in
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

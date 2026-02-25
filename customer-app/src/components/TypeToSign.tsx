import { useState } from 'react';
import { Button, Input } from './ui';

interface TypeToSignProps {
  onSign: (typedName: string) => void;
  signing?: boolean;
}

export function TypeToSign({ onSign, signing }: TypeToSignProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length > 0) {
      onSign(name.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-body font-medium text-brand-forest">
        Type your full name to sign
      </label>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your full name"
        className="font-heading text-lg"
        autoComplete="name"
      />
      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full"
        disabled={name.trim().length === 0 || signing}
        isLoading={signing}
      >
        Sign Agreement
      </Button>
    </form>
  );
}

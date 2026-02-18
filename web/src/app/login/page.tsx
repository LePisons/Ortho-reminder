'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from "@/lib/utils";
import Link from 'next/link';
/* eslint-disable-next-line @next/next/no-img-element */

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Login failed');
      }

      await res.json();
      login();
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-pixel-beige)] font-[family-name:var(--font-pixel)] gap-8">
      
      {/* Logo Container */}
      <div className="flex h-[30vh] w-full items-center justify-center">
        <img 
          src="/OrthoLogo.png" 
          alt="Ortho Logo" 
          className="h-full w-full object-contain [image-rendering:pixelated]" 
        />
      </div>

      <div className="w-full max-w-md border-4 border-[var(--color-pixel-dark-green)] bg-white p-8 shadow-[8px_8px_0_0_var(--color-pixel-brown)]">

        <h2 className="mb-6 text-center text-2xl font-bold text-[var(--color-pixel-dark-green)]">LOGIN</h2>
        {error && <p className="mb-4 text-center text-[var(--color-pixel-brown)] font-bold">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[var(--color-pixel-dark-green)] mb-1">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full border-2 border-[var(--color-pixel-dark-green)] bg-white p-2 text-[var(--color-pixel-dark-green)] placeholder-[var(--color-pixel-dark-green)]/50 focus:border-[var(--color-pixel-orange)] focus:outline-none focus:ring-0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--color-pixel-dark-green)] mb-1">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full border-2 border-[var(--color-pixel-dark-green)] bg-white p-2 text-[var(--color-pixel-dark-green)] placeholder-[var(--color-pixel-dark-green)]/50 focus:border-[var(--color-pixel-orange)] focus:outline-none focus:ring-0"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[var(--color-pixel-dark-green)] border-2 border-[var(--color-pixel-dark-green)] py-2 text-[var(--color-pixel-beige)] font-bold shadow-[4px_4px_0_0_black] hover:translate-y-1 hover:shadow-none hover:bg-[var(--color-pixel-brown)] transition-all active:translate-y-1 active:shadow-none"
          >
            ENTER
          </button>
        </form>
        <p className="mt-6 text-center text-sm font-bold text-[var(--color-pixel-dark-green)]">
          NO ACCOUNT?{' '}
          <Link href="/register" className="text-[var(--color-pixel-orange)] hover:underline">
            REGISTER
          </Link>
        </p>
      </div>
    </div>
  );
}

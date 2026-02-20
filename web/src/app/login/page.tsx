'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from "@/lib/utils";
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left split - Image Background */}
      <div 
        className="hidden lg:block lg:flex-1 bg-cover bg-center bg-no-repeat relative bg-[#8b5cf6]"
        style={{ backgroundImage: "url('/Login/Login.png')" }}
      >
        <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />
      </div>

      {/* Right split - Form */}
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white relative">
        
        {/* Decorative Welcome Pill */}
        <div className="absolute top-12 left-0 inline-flex items-center rounded-r-full bg-[#8b5cf6] px-8 py-3 text-lg font-medium text-white shadow-md">
          Welcome back
        </div>

        <div className="mx-auto w-full max-w-sm lg:w-[400px] mt-16 lg:mt-0">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-700 text-center mb-10">
              Login your account
            </h2>
          </div>

          <div className="mt-8">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="block text-sm font-semibold text-gray-500 mb-2">Username</label>
                <div className="space-y-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-gray-900 focus:border-[#8b5cf6] focus:outline-none focus:ring-0 sm:text-sm transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-500 mb-2">Password</label>
                <div className="space-y-1">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-gray-900 focus:border-[#8b5cf6] focus:outline-none focus:ring-0 sm:text-sm transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col items-center space-y-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-48 mx-auto justify-center rounded-3xl bg-[#a78bfa] px-8 py-3 text-md font-bold text-white shadow-lg shadow-[#a78bfa]/30 hover:bg-[#8b5cf6] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6] transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>

                <div className="text-xs font-semibold text-gray-500">
                  <Link href="/register" className="hover:text-[#8b5cf6] transition-colors">
                    Create Account
                  </Link>
                </div>
                
                <div className="pt-4 border-b border-gray-700 w-32 flex justify-center pb-1">
                  <Link href="/forgot-password" className="text-xs font-semibold text-gray-600 hover:text-[#8b5cf6] transition-colors">
                    Forgot Password?
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNorthwestern, setIsNorthwestern] = useState<boolean | null>(null);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistData, setWaitlistData] = useState({
    name: '',
    organization: '',
    reason: '',
  });
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const checkEmailDomain = (email: string) => {
    if (!email) {
      setIsNorthwestern(null);
      setShowWaitlistForm(false);
      return;
    }

    const isNW = email.toLowerCase().endsWith('@northwestern.edu');
    setIsNorthwestern(isNW);
    setShowWaitlistForm(!isNW);
  };

  const handleWaitlistSubmit = async () => {
    if (!waitlistData.name || !waitlistData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: waitlistData.name,
          organization: waitlistData.organization,
          reason: waitlistData.reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setWaitlistSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join waitlist');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Create Account
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Northwestern Access Banner */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-center">
            <p className="text-sm text-gray-300">
              🎓 Open to <span className="font-semibold text-purple-300">Northwestern University</span> community members.
              <br />
              <span className="text-xs text-gray-400">
                Non-NW email? You'll be prompted to join our waitlist.
              </span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const emailValue = e.target.value;
                setEmail(emailValue);
                checkEmailDomain(emailValue);
              }}
              onBlur={(e) => checkEmailDomain(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
              placeholder="you@northwestern.edu"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be a northwestern.edu email address
            </p>
          </div>

          {/* Northwestern Email Indicator */}
          {isNorthwestern === true && (
            <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Northwestern email verified
            </div>
          )}

          {/* Waitlist Form Transition */}
          {showWaitlistForm && (
            <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 animate-fade-in">
              <h3 className="text-lg font-semibold text-white mb-2">
                Not part of Northwestern? Join Our Waitlist!
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Help us keep Code Vision free for Northwestern students by joining our waitlist.
                We'll notify you when we expand access to other institutions.
              </p>

              {!waitlistSuccess ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-dark w-full px-4 py-3 rounded-lg"
                      value={waitlistData.name}
                      onChange={(e) => setWaitlistData({ ...waitlistData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Organization / School
                    </label>
                    <input
                      type="text"
                      className="input-dark w-full px-4 py-3 rounded-lg"
                      placeholder="Optional"
                      value={waitlistData.organization}
                      onChange={(e) => setWaitlistData({ ...waitlistData, organization: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Why are you interested? *
                    </label>
                    <textarea
                      required
                      rows={3}
                      className="input-dark w-full px-4 py-3 rounded-lg resize-none"
                      placeholder="Tell us about your use case..."
                      value={waitlistData.reason}
                      onChange={(e) => setWaitlistData({ ...waitlistData, reason: e.target.value })}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleWaitlistSubmit}
                    disabled={loading}
                    className="btn-primary w-full px-6 py-3 text-white font-medium rounded-lg"
                  >
                    {loading ? 'Joining...' : 'Join Waitlist'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">You're on the waitlist!</h4>
                  <p className="text-sm text-gray-400">
                    We'll email you at <span className="text-purple-300">{email}</span> when we expand access.
                  </p>
                </div>
              )}
            </div>
          )}

          {!showWaitlistForm && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-dark w-full rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input-dark w-full rounded-lg px-4 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-lg text-white font-medium"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

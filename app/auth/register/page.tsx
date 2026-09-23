'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const registration = await response.json()

      if (!response.ok) {
        setError(registration.error ?? 'Failed to create account')
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Failed to create account')
      } else {
        // Full navigation so server components (e.g. the homepage hero) re-render with
        // the new auth cookie instead of a stale, pre-sign-in Router Cache entry.
        window.location.href = '/'
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter mb-2">
            ZU<span className="text-[var(--accent)]">N</span>O
          </h1>
          <p className="text-[var(--muted)] text-sm">Create your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 bg-[var(--accent)] text-white font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-[var(--accent)] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

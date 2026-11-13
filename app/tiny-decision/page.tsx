import type { Metadata } from 'next'
import TinyDecision from '@/components/TinyDecision'

export const metadata: Metadata = {
  title: 'Tiny Decision — Zuno',
  description: 'A little help choosing. Add your options, set the odds, and let chance decide.',
}

export default function TinyDecisionPage() {
  return <TinyDecision />
}

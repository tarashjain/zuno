'use client'

import { useRef, useState } from 'react'
import styles from './TinyDecision.module.css'

type Option = { id: number; label: string; probability: string }
const COLORS = ['#e8430a', '#62745c', '#b38a51', '#77738e', '#b66c70', '#507f89']
const format = (value: number) => Number(value.toFixed(2)).toString()

export default function TinyDecision() {
  const nextId = useRef(3)
  const [options, setOptions] = useState<Option[]>([
    { id: 1, label: '', probability: '50' },
    { id: 2, label: '', probability: '50' },
  ])
  const [custom, setCustom] = useState(false)
  const [result, setResult] = useState<{ label: string; probability: number; count: number } | null>(null)
  const probabilities = options.map(option => custom ? Number(option.probability) : 100 / options.length)
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  const validProbabilities = options.every((option, index) =>
    (!custom || option.probability.trim() !== '') && Number.isFinite(probabilities[index]) && probabilities[index] >= 0 && probabilities[index] <= 100
  )
  const validTotal = validProbabilities && Math.abs(total - 100) < 0.000001
  const named = options.every(option => option.label.trim())
  const ready = named && validTotal
  const probabilityError = custom && !validTotal
    ? !validProbabilities
      ? 'Enter a probability between 0% and 100% for every option.'
      : `Probabilities must total 100%. Your current total is ${Number(total.toFixed(6))}%.`
    : null

  function update(id: number, change: Partial<Option>) {
    setOptions(current => current.map(option => option.id === id ? { ...option, ...change } : option))
    setResult(null)
  }

  function changeMode(useCustom: boolean) {
    if (useCustom === custom) return
    if (useCustom) {
      const share = Math.floor(10000 / options.length) / 100
      setOptions(current => current.map((option, index) => ({
        ...option,
        probability: (index === current.length - 1 ? 100 - share * (current.length - 1) : share).toFixed(2),
      })))
    }
    setCustom(useCustom)
    setResult(null)
  }

  function addOption() {
    if (options.length >= 12) return
    const option = { id: nextId.current++, label: '', probability: '0' }
    setOptions(current => [...current, option])
    setResult(null)
  }

  function pick() {
    if (!ready) return
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * total
    let cumulative = 0
    const index = probabilities.findIndex(probability => {
      cumulative += probability
      return random < cumulative
    })
    if (index < 0) return
    setResult(previous => ({ label: options[index].label.trim(), probability: probabilities[index], count: (previous?.count ?? 0) + 1 }))
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 sm:px-6 md:py-16">
      <header className="mb-10 md:mb-14">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)] mb-4">A little less overthinking</p>
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter">Tiny Decision<span className="text-[var(--accent)]">.</span></h1>
        <p className="mt-5 text-[var(--muted)] text-lg max-w-lg">Big dinner debate. Small weekend plan. Put your options down and let chance take it from here.</p>
      </header>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <section aria-labelledby="options-title" className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-5 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 id="options-title" className="text-xl font-bold">What are the options?</h2>
            <span className="text-xs text-[var(--muted)] tabular-nums">{options.length} / 12</span>
          </div>

          <div className="flex p-1 bg-[var(--surface2)] rounded-xl mb-3" role="group" aria-label="Probability mode">
            {[false, true].map(mode => (
              <button key={String(mode)} type="button" onClick={() => changeMode(mode)} aria-pressed={custom === mode}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${custom === mode ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                {mode ? 'Custom chances' : 'Equal chances'}
              </button>
            ))}
          </div>
          <p id="chance-help" className="text-xs text-[var(--muted)] mb-6">{custom ? 'Set each percentage. Together, they should add up to 100%.' : 'Every option gets the same chance. Nice and fair.'}</p>

          <div className="space-y-3">
            {options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2 sm:gap-3">
                <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[index % COLORS.length] }} />
                <input aria-label={`Option ${index + 1}`} value={option.label} maxLength={120}
                  placeholder={`Option ${index + 1}${index === 0 ? ', e.g. Pizza' : index === 1 ? ', e.g. Sushi' : ''}`}
                  onChange={event => update(option.id, { label: event.target.value })}
                  className="min-w-0 flex-1 bg-[var(--paper)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                <div className="flex items-center gap-1 w-24 shrink-0 justify-end text-sm tabular-nums">
                  {custom ? <input type="number" min="0" max="100" step="0.01" aria-label={`Probability for option ${index + 1}`}
                    aria-invalid={!!probabilityError} aria-describedby={probabilityError ? 'chance-help probability-error' : 'chance-help'}
                    value={option.probability} onChange={event => update(option.id, { probability: event.target.value })}
                    className="w-[4.5rem] bg-[var(--paper)] border border-[var(--border)] rounded-xl px-2 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    : <span>{format(probabilities[index])}</span>}
                  <span className="text-[var(--muted)]">%</span>
                </div>
                <button type="button" disabled={options.length <= 2} aria-label={`Remove option ${index + 1}`}
                  onClick={() => { setOptions(current => current.filter(item => item.id !== option.id)); setResult(null) }}
                  className="w-8 h-11 shrink-0 rounded-lg text-xl text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--red)] disabled:opacity-25 disabled:cursor-not-allowed">×</button>
              </div>
            ))}
          </div>

          <button type="button" disabled={options.length >= 12}
            onClick={addOption}
            className="mt-4 w-full py-3 border border-dashed border-[var(--border)] rounded-xl text-sm font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed">+ Add an option</button>

          {probabilityError && (
            <p id="probability-error" role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--red)]">
              {probabilityError}
            </p>
          )}
        </section>

        <section aria-label="Random picker" className="lg:sticky lg:top-24 bg-[var(--surface2)] border border-[var(--border)] rounded-3xl p-6 sm:p-10 text-center overflow-hidden">
          <p className="text-xs uppercase tracking-[0.25em] font-bold text-[var(--muted)]">Leave a little to chance</p>
          <div key={result?.count ?? 0} className={`my-8 mx-auto w-20 h-20 rounded-3xl bg-[var(--paper)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] rotate-12 shadow-sm ${result ? styles.diceRoll : ''}`} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="currentColor" className="w-11 h-11"><circle cx="12" cy="12" r="3" /><circle cx="36" cy="12" r="3" /><circle cx="24" cy="24" r="3" /><circle cx="12" cy="36" r="3" /><circle cx="36" cy="36" r="3" /></svg>
          </div>
          <div className="min-h-36 flex flex-col justify-center" aria-live="polite" aria-atomic="true">
            {result ? <div key={result.count} className={styles.resultReveal}>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] mb-3">Fate has spoken. No take-backs.</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight break-words">{result.label}</h2>
              <p className="text-sm text-[var(--muted)] mt-4">{format(result.probability)}% chance. One less thing to think about.</p>
            </div> : <>
              <h2 className="text-3xl font-bold tracking-tight">A small leap of chance.</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">Your next move is waiting to be picked.</p>
            </>}
          </div>
          <button type="button" onClick={pick} disabled={!ready} className="mt-8 w-full rounded-2xl bg-[var(--accent)] text-white font-bold py-4 hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
            {result ? 'Pick again' : 'Make my decision'} <span aria-hidden="true">↗</span>
          </button>
          <p className="mt-4 text-xs text-[var(--muted)]">{!named ? 'Give every option a name to get started.' : !validTotal ? 'Adjust your chances to total 100%.' : 'A fresh, independent pick every time.'}</p>
        </section>
      </div>
    </main>
  )
}

import { num, safeDiv } from './helpers'
import type { Calculator } from './types'

export function loanPayment(principal: number, aprPercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = aprPercent / 100 / 12
  if (r === 0) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

export function duration(months: number): string {
  if (!Number.isFinite(months) || months < 0) return 'Never'
  const total = Math.ceil(months)
  const y = Math.floor(total / 12)
  const m = total % 12
  const parts = []
  if (y) parts.push(`${y} yr${y === 1 ? '' : 's'}`)
  if (m || !y) parts.push(`${m} mo`)
  return parts.join(' ')
}

export const loan: Calculator = {
  id: 'loan',
  group: 'Money',
  tab: 'Loan interest',
  title: 'Loan interest',
  blurb: 'The payment the dealer quotes, and what the money actually costs.',
  fields: [
    { key: 'price', label: 'Price', kind: 'money', default: 45000, step: 500 },
    { key: 'down', label: 'Down payment / trade', kind: 'money', default: 5000, step: 500 },
    { key: 'apr', label: 'Interest rate (APR)', kind: 'percent', default: 7.49, step: 0.01 },
    { key: 'months', label: 'Term', kind: 'count', default: 72, step: 12, suffix: 'months' },
  ],
  compute(v) {
    const principal = Math.max(0, num(v, 'price') - num(v, 'down'))
    const months = Math.round(num(v, 'months'))
    const pay = loanPayment(principal, num(v, 'apr'), months)
    const totalPaid = pay * months
    const interest = Math.max(0, totalPaid - principal)
    return [
      { label: 'Monthly payment', value: pay, kind: 'money', primary: true },
      { label: 'Bi-weekly equivalent', value: (pay * 12) / 26, kind: 'money' },
      { label: 'Borrowed', value: principal, kind: 'money', bar: safeDiv(principal, totalPaid) },
      { label: 'Total interest', value: interest, kind: 'money', bar: safeDiv(interest, totalPaid) },
      { label: 'All in, with down payment', value: totalPaid + num(v, 'down'), kind: 'money' },
      { label: 'Interest per $1 borrowed', value: safeDiv(interest, principal), kind: 'number', digits: 2 },
    ]
  },
}

export const inflation: Calculator = {
  id: 'inflation',
  group: 'Money',
  tab: 'Inflation',
  title: 'Inflation',
  blurb: 'What something will cost later, and what your money will be worth.',
  fields: [
    { key: 'amount', label: 'Amount today', kind: 'money', default: 1000, step: 10 },
    { key: 'rate', label: 'Inflation rate', kind: 'percent', default: 3, step: 0.1, help: 'Long run average in Canada and the US is a bit under 3%.' },
    { key: 'years', label: 'Years from now', kind: 'count', default: 10, step: 1, suffix: 'years' },
  ],
  compute(v) {
    const amt = num(v, 'amount')
    const r = num(v, 'rate') / 100
    const y = num(v, 'years')
    const factor = Math.pow(1 + r, y)
    return [
      { label: `In ${y} years`, value: amt * factor, kind: 'money', primary: true },
      { label: 'Price increase', value: amt * factor - amt, kind: 'money' },
      { label: 'What today\'s money will be worth', value: amt / factor, kind: 'money' },
      { label: 'Buying power lost', value: `${Math.round((1 - 1 / factor) * 100)}%`, kind: 'text' },
      { label: 'Prices double every', value: r > 0 ? `${(Math.log(2) / Math.log(1 + r)).toFixed(1)} years` : 'Never', kind: 'text' },
    ]
  },
}

export const breakEven: Calculator = {
  id: 'break-even',
  group: 'Money',
  tab: 'Break-even',
  title: 'Break-even',
  blurb: 'Pay more now to save later? See when it pays for itself.',
  fields: [
    { key: 'upfront', label: 'Upfront cost', kind: 'money', default: 8000, step: 100, help: 'EV premium, solar setup, a tune, whatever.' },
    { key: 'savings', label: 'Saves you per month', kind: 'money', default: 180, step: 5 },
    { key: 'extra', label: 'Adds per month', kind: 'money', default: 0, step: 5, help: 'Extra insurance, subscriptions, upkeep.' },
    { key: 'horizon', label: 'Keeping it for', kind: 'count', default: 8, step: 1, suffix: 'years' },
  ],
  compute(v) {
    const up = num(v, 'upfront')
    const net = num(v, 'savings') - num(v, 'extra')
    const months = net > 0 ? up / net : Infinity
    const horizon = num(v, 'horizon')
    const end = net * 12 * horizon - up
    return [
      { label: 'Pays for itself in', value: duration(months), kind: 'text', primary: true },
      { label: 'Net saving per month', value: net, kind: 'money' },
      { label: `Ahead after ${horizon} years`, value: end, kind: 'money', highlight: end > 0 },
      { label: 'Return', value: up > 0 ? `${Math.round((end / up) * 100)}%` : 'n/a', kind: 'text' },
    ]
  },
}

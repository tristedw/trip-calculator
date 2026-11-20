import './style.css'
import { calculators, defaultsFor, getCalculator, groups } from './lib/calculators'
import { currencySymbol, formatResult } from './lib/format'
import { sentenceKeys, sentences, toggleWords } from './lib/sentences'
import { currencies, decodeState, encodeState } from './lib/share'
import type { Calculator, Field, FieldKind, Result, Settings, Values, Vehicle } from './lib/types'
import { UNITS, fromDisplay, isDim, tidy, toDisplay, unitFor, unitSuffix } from './lib/units'

const SETTINGS_KEY = 'rcc:settings'
const MAX_VEHICLES = 6

const app = document.querySelector<HTMLDivElement>('#app')!
const settings: Settings = loadSettings()
const state = new Map<string, Values>()
let active: Calculator = calculators[0]
let lastResults: Result[] = []

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      units: raw.units && typeof raw.units === 'object' ? raw.units : {},
      currency: currencies.includes(raw.currency) ? raw.currency : 'CAD',
    }
  } catch {
    return { units: {}, currency: 'CAD' }
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // storage blocked, settings just won't stick
  }
}

const valuesFor = (calc: Calculator) => {
  if (!state.has(calc.id)) state.set(calc.id, defaultsFor(calc))
  return state.get(calc.id)!
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

// "Travel trailer" reads better mid sentence as "travel trailer", but leave "V8" and "AGM" alone
const inline = (label: string) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label)

const suffixFor = (f: Field) => f.suffix ?? unitSuffix(f.kind, settings.units, currencySymbol(settings.currency))

// converted values get rounded to what the unit can sensibly show, metric ones are left alone
function shownValue(kind: FieldKind, metric: number, fieldStep?: number): string {
  if (!isDim(kind) || unitFor(kind, settings.units) === UNITS[kind][0]) return String(tidy(toDisplay(kind, metric, settings.units)))
  const step = unitFor(kind, settings.units).step ?? fieldStep ?? 1
  return String(tidy(toDisplay(kind, metric, settings.units), (String(step).split('.')[1] ?? '').length))
}

// the unit after a number is a dropdown when there's more than one way to measure it
function unitHtml(kind: FieldKind, label: string): string {
  if (!isDim(kind)) return label ? `<span class="tok-unit${label === '°' ? ' deg' : ''}">${esc(label)}</span>` : ''
  const current = unitFor(kind, settings.units).id
  const sym = kind === 'fuelPrice' ? currencySymbol(settings.currency) : ''
  const opts = UNITS[kind]
    .map((u) => `<option value="${u.id}" ${u.id === current ? 'selected' : ''}>${esc(sym + u.label)}</option>`)
    .join('')
  return `<select class="tok-unit unit-pick" data-dim="${kind}" aria-label="Unit">${opts}</select>`
}

// size number inputs to their text so they sit in the sentence like words
const measure = document.createElement('canvas').getContext('2d')!
function fitWidth(el: HTMLInputElement) {
  const cs = getComputedStyle(el)
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const ls = parseFloat(cs.letterSpacing) || 0
  const text = el.value || '0'
  el.style.width = `${Math.ceil(measure.measureText(text).width + ls * text.length) + 2}px`
}

const fitAll = () => document.querySelectorAll<HTMLInputElement>('input[data-num]').forEach(fitWidth)

// "1 people" and "1 nights" read wrong
function countWord(suffix: string, n: number): string {
  if (n !== 1) return suffix
  if (suffix === 'people') return 'person'
  return /^[a-z]+s$/.test(suffix) ? suffix.slice(0, -1) : suffix
}

// ---------- shell ----------

function renderShell() {
  app.innerHTML = `
    <header class="top">
      <a class="wordmark" href="#${calculators[0].id}">Real Cost Calculator</a>
      <div class="settings">
        <label class="currency">
          <span class="sr-only">Currency</span>
          <select id="currency">${currencies.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        </label>
      </div>
    </header>
    <nav class="menu" aria-label="Calculators">
      ${groups
        .map(
          (g) => `
        <div class="menu-group">
          <span class="menu-label">${g}</span>
          <ul>
            ${calculators
              .filter((c) => c.group === g)
              .map((c) => `<li><a href="#${c.id}" data-tab="${c.id}">${c.tab}</a></li>`)
              .join('')}
          </ul>
        </div>`,
        )
        .join('')}
    </nav>
    <main id="panel"></main>
    <footer class="foot">
      <p>Rough numbers. How you drive, the weather and the hills all move them.</p>
      <p><a href="https://tristedw.ca">Tristan Edwards</a>, Kelowna. <a href="https://github.com/tristedw/trip-calculator" rel="noopener">Source</a></p>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>
  `

  app.querySelector('.menu')!.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-tab]')
    if (!a) return
    e.preventDefault()
    switchTo(a.dataset.tab!)
  })
  const cur = app.querySelector<HTMLSelectElement>('#currency')!
  cur.addEventListener('change', () => {
    settings.currency = cur.value
    saveSettings()
    renderPanel()
    updateHash()
  })
}

function syncChrome() {
  app.querySelector<HTMLSelectElement>('#currency')!.value = settings.currency
  app.querySelectorAll<HTMLAnchorElement>('[data-tab]').forEach((a) => {
    if (a.dataset.tab === active.id) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })
  document.title = `${active.title} | Real Cost Calculator`
}

function switchTo(id: string) {
  const calc = getCalculator(id)
  if (!calc) return
  active = calc
  syncChrome()
  renderPanel()
  updateHash()
  document.querySelector<HTMLElement>('#panel h1')?.focus({ preventScroll: true })
}

// ---------- the sentence ----------

function tokenHtml(f: Field, values: Values, showUnit: boolean): string {
  const v = values[f.key]
  const id = `f-${f.key}`

  if (f.kind === 'toggle') {
    const words = toggleWords[f.key] ?? ['no', 'yes']
    return `<button type="button" class="tok tok-toggle" id="${id}" data-key="${f.key}" aria-pressed="${v ? 'true' : 'false'}" aria-label="${f.label}">${v ? words[1] : words[0]}</button>`
  }

  if (f.kind === 'select') {
    const opts = (f.options ?? [])
      .map((o) => `<option value="${o.value}" ${o.value === v ? 'selected' : ''}>${esc(inline(o.label))}</option>`)
      .join('')
    return `<span class="tok tok-select"><select id="${id}" data-key="${f.key}" aria-label="${f.label}">${opts}</select></span>`
  }

  const shown = shownValue(f.kind, Number(v) || 0, f.step)
  const unit = showUnit ? countWord(suffixFor(f), Number(shown)) : ''
  return `<span class="tok tok-num"><input id="${id}" data-key="${f.key}" data-num type="text" inputmode="decimal"
    autocomplete="off" spellcheck="false" aria-label="${f.label}${unit ? ` in ${unit}` : ''}" value="${shown}"
    style="width:${shown.length + 0.4}ch">${showUnit ? unitHtml(f.kind, unit) : ''}</span>`
}

function sentenceHtml(values: Values): string {
  const tpl = sentences[active.id] ?? '{=}'
  return tpl.replace(/\{([a-zA-Z@=]+)(!?)\}/g, (_, key: string, bang: string) => {
    if (key === '=') return '<output class="answer" id="answer"></output>'
    if (key === '@') return '<span class="answer-name" id="answer-name"></span>'
    const f = active.fields.find((x) => x.key === key)
    return f ? tokenHtml(f, values, !bang) : ''
  })
}

// ---------- details (fields that don't fit the sentence) ----------

function detailHtml(f: Field, values: Values): string {
  if (f.kind === 'vehicles') return vehiclesHtml(values[f.key] as Vehicle[])
  const help = f.help ? `<span class="detail-help">${f.help}</span>` : ''
  return `
    <div class="detail">
      <label class="detail-label" for="f-${f.key}">${f.label}</label>
      <span class="detail-input">${tokenHtml(f, values, true)}</span>
      ${help}
    </div>`
}

function vehiclesHtml(list: Vehicle[]): string {
  const rows = list
    .map((vh, i) => {
      const kind: FieldKind = vh.type === 'ev' ? 'evConsumption' : 'consumption'
      const shown = shownValue(kind, vh.consumption)
      return `
        <tr data-index="${i}">
          <td><input class="vname" type="text" value="${esc(vh.name)}" maxlength="40" data-vfield="name" aria-label="Vehicle ${i + 1} name"></td>
          <td>
            <span class="tok tok-select"><select data-vfield="type" aria-label="Vehicle ${i + 1} fuel">
              <option value="gas" ${vh.type === 'gas' ? 'selected' : ''}>gas</option>
              <option value="diesel" ${vh.type === 'diesel' ? 'selected' : ''}>diesel</option>
              <option value="ev" ${vh.type === 'ev' ? 'selected' : ''}>electric</option>
            </select></span>
          </td>
          <td class="num">
            <span class="tok tok-num"><input data-vfield="consumption" data-num type="text" inputmode="decimal" value="${shown}"
              style="width:${shown.length + 0.4}ch" aria-label="Vehicle ${i + 1} economy">${unitHtml(kind, '')}</span>
          </td>
          <td class="x"><button type="button" class="remove" data-remove="${i}" ${list.length <= 1 ? 'disabled' : ''} aria-label="Remove ${esc(vh.name || 'vehicle')}">Remove</button></td>
        </tr>`
    })
    .join('')
  return `
    <div class="vehicles">
      <table>
        <caption class="detail-label">Vehicles</caption>
        <tbody>${rows}</tbody>
      </table>
      <button type="button" class="link-btn" data-add ${list.length >= MAX_VEHICLES ? 'disabled' : ''}>Add a vehicle</button>
    </div>`
}

// ---------- panel ----------

function renderPanel() {
  const values = valuesFor(active)
  const inSentence = sentenceKeys(active.id)
  const details = active.fields.filter((f) => !inSentence.has(f.key))
  const notes = active.fields.filter((f) => inSentence.has(f.key) && f.help)
  const panel = app.querySelector<HTMLElement>('#panel')!

  panel.innerHTML = `
    <h1 tabindex="-1">${active.title}</h1>
    <form id="calc" autocomplete="off" novalidate>
      <p class="sentence">${sentenceHtml(values)}</p>
      ${notes.length ? `<ul class="notes">${notes.map((f) => `<li>${f.help}</li>`).join('')}</ul>` : ''}
      <p class="hint">Drag a number left or right, or click it and type.</p>
      <div class="lower">
        <section class="breakdown" aria-labelledby="bd-h">
          <h2 id="bd-h">Breakdown</h2>
          <div class="rows" id="rows"></div>
          <div class="actions">
            <button type="button" class="btn" data-share>Copy link</button>
            <button type="button" class="link-btn" data-copy>Copy as text</button>
            <button type="button" class="link-btn" data-print>Print</button>
            <button type="button" class="link-btn" data-reset>Reset</button>
          </div>
        </section>
        ${
          details.length
            ? `<section class="details" aria-labelledby="dt-h">
                <h2 id="dt-h">Details</h2>
                ${details.map((f) => detailHtml(f, values)).join('')}
              </section>`
            : ''
        }
      </div>
    </form>
  `
  bindPanel(panel)
  renderResults(false)
  fitAll()
  // Poppins may still be loading on first paint
  document.fonts?.ready.then(fitAll)
}

function bindPanel(panel: HTMLElement) {
  const form = panel.querySelector<HTMLFormElement>('#calc')!
  form.addEventListener('submit', (e) => e.preventDefault())
  form.addEventListener('input', onInput)
  form.addEventListener('change', onChange)
  form.addEventListener('click', onClick)
  form.addEventListener('keydown', onKey)
  form.addEventListener('pointerdown', onPointerDown)
  form.addEventListener('focusout', (e) => {
    // tidy up whatever was typed once the field is left
    const el = e.target as HTMLInputElement
    if (el.matches('input[data-num]')) {
      el.value = el.value.trim() === '' || !Number.isFinite(parseFloat(el.value)) ? '0' : String(tidy(parseFloat(el.value)))
      fitWidth(el)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  panel.querySelector('[data-share]')!.addEventListener('click', share)
  panel.querySelector('[data-copy]')!.addEventListener('click', () => copy(summary(), 'Copied as text'))
  panel.querySelector('[data-print]')!.addEventListener('click', () => window.print())
  panel.querySelector('[data-reset]')!.addEventListener('click', () => {
    state.set(active.id, defaultsFor(active))
    renderPanel()
    updateHash()
  })
}

function fieldFor(el: HTMLElement) {
  return active.fields.find((f) => f.key === el.dataset.key)
}

function setNumber(el: HTMLInputElement, shown: number) {
  const values = valuesFor(active)
  if (el.dataset.vfield === 'consumption') {
    const row = el.closest<HTMLElement>('tr')!
    const vh = (values.vehicles as Vehicle[])[Number(row.dataset.index)]
    vh.consumption = Math.max(0, fromDisplay(vh.type === 'ev' ? 'evConsumption' : 'consumption', shown, settings.units))
    return
  }
  const f = fieldFor(el)
  if (!f) return
  values[f.key] = Math.max(f.min ?? 0, fromDisplay(f.kind, shown, settings.units))
  // typing over a preset value turns the preset to custom
  const preset = active.fields.find((x) => x.options?.some((o) => o.sets && f.key in o.sets))
  if (preset && values[preset.key] !== 'custom') {
    values[preset.key] = 'custom'
    const sel = document.querySelector<HTMLSelectElement>(`#f-${preset.key}`)
    if (sel) sel.value = 'custom'
  }
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  if (el.dataset.vfield === 'name') {
    const row = el.closest<HTMLElement>('tr')!
    ;(valuesFor(active).vehicles as Vehicle[])[Number(row.dataset.index)].name = el.value
    return commit()
  }
  if (!el.matches('input[data-num]')) return
  fitWidth(el)
  const n = parseFloat(el.value)
  if (!Number.isFinite(n)) return
  setNumber(el, n)
  syncCountWord(el, n)
  commit()
}

function syncCountWord(el: HTMLInputElement, n: number) {
  const f = fieldFor(el)
  const unit = el.parentElement?.querySelector('span.tok-unit')
  if (f?.suffix && unit) unit.textContent = countWord(f.suffix, n)
}

function onChange(e: Event) {
  const el = e.target as HTMLSelectElement
  const values = valuesFor(active)
  if (el.dataset.dim) {
    settings.units = { ...settings.units, [el.dataset.dim]: el.value }
    saveSettings()
    renderPanel()
    return updateHash()
  }
  if (el.dataset.vfield === 'type') {
    const row = el.closest<HTMLElement>('tr')!
    const vh = (values.vehicles as Vehicle[])[Number(row.dataset.index)]
    const wasEv = vh.type === 'ev'
    vh.type = el.value as Vehicle['type']
    if (wasEv !== (vh.type === 'ev')) vh.consumption = vh.type === 'ev' ? 18 : 10
    renderPanel()
    return commit()
  }
  if (el.tagName !== 'SELECT') return
  const f = fieldFor(el)
  if (!f) return
  values[f.key] = el.value
  const opt = f.options?.find((o) => o.value === el.value)
  if (opt?.sets) {
    Object.assign(values, opt.sets)
    renderPanel()
  }
  commit()
}

function onClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!btn) return
  const values = valuesFor(active)

  if (btn.classList.contains('tok-toggle')) {
    const key = btn.dataset.key!
    values[key] = !values[key]
    const words = toggleWords[key] ?? ['no', 'yes']
    btn.textContent = values[key] ? words[1] : words[0]
    btn.setAttribute('aria-pressed', String(values[key]))
    return commit()
  }

  const list = values.vehicles as Vehicle[] | undefined
  if (!list) return
  if (btn.hasAttribute('data-add') && list.length < MAX_VEHICLES) {
    list.push({ name: `Vehicle ${list.length + 1}`, type: 'gas', consumption: 10 })
    renderPanel()
    commit()
    const names = document.querySelectorAll<HTMLInputElement>('.vname')
    names[names.length - 1]?.select()
  } else if (btn.dataset.remove !== undefined && list.length > 1) {
    list.splice(Number(btn.dataset.remove), 1)
    renderPanel()
    commit()
  }
}

function stepFor(el: HTMLInputElement): number {
  if (el.dataset.vfield === 'consumption') {
    const row = el.closest<HTMLElement>('tr')!
    const vh = (valuesFor(active).vehicles as Vehicle[])[Number(row.dataset.index)]
    return unitFor(vh.type === 'ev' ? 'evConsumption' : 'consumption', settings.units).step ?? 0.1
  }
  const f = fieldFor(el)
  if (!f) return 1
  return (isDim(f.kind) ? unitFor(f.kind, settings.units).step : undefined) ?? f.step ?? 1
}

const decimalsOf = (n: number) => (String(n).split('.')[1] ?? '').length

function nudge(el: HTMLInputElement, steps: number, from?: number) {
  const step = stepFor(el)
  const base = from ?? (parseFloat(el.value) || 0)
  const f = fieldFor(el)
  const min = f?.min ?? 0
  const next = Math.max(min, Number((base + steps * step).toFixed(Math.max(decimalsOf(step), decimalsOf(base)))))
  el.value = String(next)
  fitWidth(el)
  setNumber(el, next)
  syncCountWord(el, next)
  commit()
}

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLInputElement
  if (!el.matches('input[data-num]')) return
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    nudge(el, (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
  } else if (e.key === 'Enter') {
    el.blur()
  }
}

// drag a number left or right to scrub it, click without moving to type
function onPointerDown(e: PointerEvent) {
  const el = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-num]')
  if (!el || e.button !== 0 || e.pointerType === 'touch' || document.activeElement === el) return
  e.preventDefault()
  const startX = e.clientX
  const start = parseFloat(el.value) || 0
  let moved = false
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    if (!moved && Math.abs(dx) < 4) return
    if (!moved) {
      moved = true
      document.body.classList.add('scrubbing')
      el.classList.add('is-scrubbing')
    }
    nudge(el, Math.round(dx / 6), start)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    document.body.classList.remove('scrubbing')
    el.classList.remove('is-scrubbing')
    if (!moved) {
      el.focus()
      el.select()
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function commit() {
  renderResults(true)
  updateHash()
}

// ---------- results ----------

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
let answerShown: { kind: string; value: number } | null = null
let tween = 0

function renderAnswer(primary: Result | undefined, animate: boolean) {
  const out = document.querySelector<HTMLElement>('#answer')
  const name = document.querySelector<HTMLElement>('#answer-name')
  if (name) name.textContent = primary ? primary.label : ''
  if (!out) return
  cancelAnimationFrame(tween)
  if (!primary) {
    out.textContent = ''
    return
  }
  if (typeof primary.value !== 'number') {
    out.textContent = formatResult(primary, settings)
    answerShown = null
    return
  }
  const to = primary.value
  const from = animate && answerShown && answerShown.kind === primary.kind ? answerShown.value : to
  answerShown = { kind: primary.kind, value: to }
  if (from === to || reducedMotion.matches) {
    out.textContent = formatResult(primary, settings)
    return
  }
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / 260)
    const v = from + (to - from) * (1 - Math.pow(1 - t, 3))
    out.textContent = formatResult({ ...primary, value: v }, settings)
    if (t < 1) tween = requestAnimationFrame(step)
  }
  tween = requestAnimationFrame(step)
}

function renderResults(animate: boolean) {
  const rows = document.querySelector<HTMLElement>('#rows')
  if (!rows) return
  lastResults = active.compute(valuesFor(active))
  const primary = lastResults.find((r) => r.primary)
  renderAnswer(primary, animate)
  const rest = lastResults.filter((r) => r !== primary)
  rows.innerHTML = rest
    .map((r) => {
      const long = typeof r.value === 'string' && r.value.length > 26
      const bar =
        r.bar !== undefined
          ? `<span class="bar" aria-hidden="true"><span style="width:${Math.min(1, Math.max(0, r.bar)) * 100}%"></span></span>`
          : ''
      return `
        <div class="row${r.highlight ? ' is-best' : ''}${long ? ' is-long' : ''}">
          <span class="row-label">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span>
          <span class="row-value">${esc(formatResult(r, settings))}</span>
          ${bar}
        </div>`
    })
    .join('')
}

// ---------- share ----------

function shareUrl() {
  return `${location.origin}${location.pathname}${encodeState(active.id, valuesFor(active), settings)}`
}

function updateHash() {
  const hash = encodeState(active.id, valuesFor(active), settings)
  if (location.hash !== hash) history.replaceState(null, '', hash)
}

function summary(): string {
  const values = valuesFor(active)
  const lines = [active.title, '']
  for (const f of active.fields) {
    const v = values[f.key]
    if (f.kind === 'vehicles') {
      for (const vh of v as Vehicle[]) {
        const kind: FieldKind = vh.type === 'ev' ? 'evConsumption' : 'consumption'
        lines.push(`${vh.name} (${vh.type}): ${tidy(toDisplay(kind, vh.consumption, settings.units), 1)} ${unitSuffix(kind, settings.units, '')}`)
      }
    } else if (f.kind === 'toggle') {
      lines.push(`${f.label}: ${v ? 'yes' : 'no'}`)
    } else if (f.kind === 'select') {
      lines.push(`${f.label}: ${f.options?.find((o) => o.value === v)?.label ?? v}`)
    } else {
      lines.push(`${f.label}: ${tidy(toDisplay(f.kind, Number(v), settings.units), 2)} ${suffixFor(f)}`.trim())
    }
  }
  lines.push('')
  for (const r of lastResults) lines.push(`${r.label}: ${formatResult(r, settings)}`)
  lines.push('', shareUrl())
  return lines.join('\n')
}

async function share() {
  const url = shareUrl()
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: active.title, url })
      return
    } catch {
      // cancelled, copy instead
    }
  }
  copy(url, 'Link copied')
}

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast(msg)
  } catch {
    window.prompt('Copy this:', text)
  }
}

let toastTimer = 0
function toast(msg: string) {
  const el = app.querySelector<HTMLElement>('.toast')!
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600)
}

// ---------- boot ----------

function applyHash() {
  const decoded = decodeState(location.hash)
  if (!decoded) return false
  Object.assign(settings, decoded.settings)
  state.set(decoded.calcId, decoded.values)
  active = getCalculator(decoded.calcId)!
  return true
}

renderShell()
applyHash()
syncChrome()
renderPanel()

window.addEventListener('hashchange', () => {
  if (applyHash()) {
    syncChrome()
    renderPanel()
  }
})

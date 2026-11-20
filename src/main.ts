import './style.css'
import { calculators, defaultsFor, getCalculator, groups } from './lib/calculators'
import { currencySymbol, formatResult } from './lib/format'
import { currencies, decodeState, encodeState } from './lib/share'
import type { Calculator, Field, Result, Settings, Values, Vehicle } from './lib/types'
import { fromDisplay, tidy, toDisplay, unitSuffix } from './lib/units'

const SETTINGS_KEY = 'rcc:settings'
const MAX_VEHICLES = 6

const app = document.querySelector<HTMLDivElement>('#app')!

const settings: Settings = loadSettings()
const state = new Map<string, Values>()
let active: Calculator = calculators[0]

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      units: raw.units === 'imperial' ? 'imperial' : 'metric',
      currency: currencies.includes(raw.currency) ? raw.currency : 'CAD',
    }
  } catch {
    return { units: 'metric', currency: 'CAD' }
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // private mode, whatever
  }
}

const valuesFor = (calc: Calculator) => {
  if (!state.has(calc.id)) state.set(calc.id, defaultsFor(calc))
  return state.get(calc.id)!
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

// ---------- shell ----------

function renderShell() {
  app.innerHTML = `
    <header class="top">
      <div class="brand">
        <svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="7" y="6" width="17" height="28" rx="2.5" />
          <rect class="glass" x="10" y="9.5" width="11" height="8" rx="1" />
          <path class="hose" d="M24 13h4.5a2.5 2.5 0 0 1 2.5 2.5V27a2 2 0 0 0 4 0V14l-3-3" />
          <rect x="5" y="33" width="21" height="3" rx="1" />
        </svg>
        <div>
          <h1>Real Cost Calculator</h1>
          <p class="tagline">A ridiculously simple calculator for real-world expenses.</p>
        </div>
      </div>
      <div class="settings">
        <div class="seg" role="group" aria-label="Units">
          <button type="button" data-units="metric">Metric</button>
          <button type="button" data-units="imperial">Imperial</button>
        </div>
        <label class="currency">
          <span class="sr-only">Currency</span>
          <select id="currency">${currencies.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
        </label>
      </div>
    </header>
    <div class="layout">
      <nav class="tabs" role="tablist" aria-label="Calculators" aria-orientation="vertical">
        ${groups
          .map(
            (g) => `
          <div class="group" role="presentation">
            <span class="group-label" role="presentation">${g}</span>
            ${calculators
              .filter((c) => c.group === g)
              .map((c) => `<button type="button" role="tab" id="tab-${c.id}" data-tab="${c.id}" aria-controls="panel">${c.tab}</button>`)
              .join('')}
          </div>`,
          )
          .join('')}
      </nav>
      <main id="panel" role="tabpanel" class="panel"></main>
    </div>
    <footer class="foot">
      <p>Estimates, not gospel. Real economy depends on how you drive, the weather and the hills.</p>
      <p>Built by <a href="https://tristedw.ca">Tristan Edwards</a> in Kelowna, BC. <a href="https://tristedw.ca/projects/trip-calculator/">About this project</a>. <a href="https://github.com/tristedw/trip-calculator" rel="noopener">Source on GitHub</a>.</p>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>
  `

  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) =>
    btn.addEventListener('click', () => switchTo(btn.dataset.tab!)),
  )
  app.querySelector('.tabs')!.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent
    const fwd = ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
    if (!fwd && ev.key !== 'ArrowLeft' && ev.key !== 'ArrowUp') return
    ev.preventDefault()
    const i = calculators.indexOf(active)
    const next = calculators[(i + (fwd ? 1 : -1) + calculators.length) % calculators.length]
    switchTo(next.id)
    app.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus()
  })
  app.querySelectorAll<HTMLButtonElement>('[data-units]').forEach((btn) =>
    btn.addEventListener('click', () => {
      settings.units = btn.dataset.units === 'imperial' ? 'imperial' : 'metric'
      saveSettings()
      syncSettingsUi()
      renderPanel()
    }),
  )
  const cur = app.querySelector<HTMLSelectElement>('#currency')!
  cur.addEventListener('change', () => {
    settings.currency = cur.value
    saveSettings()
    renderPanel()
  })
}

function syncSettingsUi() {
  app.querySelectorAll<HTMLButtonElement>('[data-units]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.units === settings.units)),
  )
  app.querySelector<HTMLSelectElement>('#currency')!.value = settings.currency
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === active.id
    b.setAttribute('aria-selected', String(on))
    b.tabIndex = on ? 0 : -1
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

function switchTo(id: string) {
  const calc = getCalculator(id)
  if (!calc || calc === active) return
  active = calc
  syncSettingsUi()
  renderPanel()
  updateHash()
}

// ---------- form ----------

function fieldHtml(f: Field, values: Values): string {
  const sym = currencySymbol(settings.currency)
  const help = f.help ? `<small class="help">${f.help}</small>` : ''
  const id = `f-${f.key}`

  if (f.kind === 'toggle') {
    return `
      <label class="field toggle" for="${id}">
        <span class="label">${f.label}</span>
        <input type="checkbox" role="switch" id="${id}" name="${f.key}" ${values[f.key] ? 'checked' : ''} />
        <span class="switch" aria-hidden="true"></span>
      </label>`
  }

  if (f.kind === 'select') {
    const opts = (f.options ?? [])
      .map((o) => `<option value="${o.value}" ${o.value === values[f.key] ? 'selected' : ''}>${o.label}</option>`)
      .join('')
    return `
      <label class="field" for="${id}">
        <span class="label">${f.label}</span>
        <select id="${id}" name="${f.key}">${opts}</select>
        ${help}
      </label>`
  }

  if (f.kind === 'vehicles') return vehiclesHtml(values[f.key] as Vehicle[])

  const shown = tidy(toDisplay(f.kind, Number(values[f.key]) || 0, settings.units))
  const suffix = f.suffix ?? unitSuffix(f.kind, settings.units, sym)
  return `
    <label class="field" for="${id}">
      <span class="label">${f.label}</span>
      <span class="input">
        <input type="number" inputmode="decimal" id="${id}" name="${f.key}" value="${shown}"
          min="${f.min ?? 0}" step="${f.kind === 'consumption' && settings.units === 'imperial' ? 0.1 : (f.step ?? 'any')}" />
        ${suffix ? `<span class="suffix">${suffix}</span>` : ''}
      </span>
      ${help}
    </label>`
}

function vehiclesHtml(list: Vehicle[]): string {
  const rows = list
    .map((vh, i) => {
      const kind = vh.type === 'ev' ? 'evConsumption' : 'consumption'
      const shown = tidy(toDisplay(kind, vh.consumption, settings.units))
      return `
        <div class="vehicle" data-index="${i}">
          <input class="vname" type="text" aria-label="Vehicle ${i + 1} name" value="${esc(vh.name)}" maxlength="40" data-vfield="name" />
          <select aria-label="Vehicle ${i + 1} fuel" data-vfield="type">
            <option value="gas" ${vh.type === 'gas' ? 'selected' : ''}>Gas</option>
            <option value="diesel" ${vh.type === 'diesel' ? 'selected' : ''}>Diesel</option>
            <option value="ev" ${vh.type === 'ev' ? 'selected' : ''}>Electric</option>
          </select>
          <span class="input">
            <input type="number" inputmode="decimal" min="0" step="0.1" aria-label="Vehicle ${i + 1} economy" value="${shown}" data-vfield="consumption" />
            <span class="suffix">${unitSuffix(kind, settings.units, '')}</span>
          </span>
          <button type="button" class="icon" data-remove="${i}" aria-label="Remove ${esc(vh.name || 'vehicle')}" ${list.length <= 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>`
    })
    .join('')
  return `
    <fieldset class="field vehicles">
      <legend class="label">Vehicles</legend>
      ${rows}
      <button type="button" class="add" data-add ${list.length >= MAX_VEHICLES ? 'disabled' : ''}>+ Add vehicle</button>
    </fieldset>`
}

function renderPanel() {
  const values = valuesFor(active)
  const panel = app.querySelector<HTMLElement>('#panel')!
  panel.setAttribute('aria-labelledby', `tab-${active.id}`)
  panel.innerHTML = `
    <section class="sheet">
      <h2>${active.title}</h2>
      <p class="blurb">${active.blurb}</p>
      <form id="calc-form" autocomplete="off" novalidate>
        ${active.fields.map((f) => fieldHtml(f, values)).join('')}
      </form>
      <button type="button" class="text-btn" data-reset>Reset to defaults</button>
    </section>
    <aside class="pump" aria-label="Results">
      <div class="readout" aria-live="polite">
        <span class="readout-label"></span>
        <div class="lcd"></div>
      </div>
      <ul class="rows"></ul>
      <div class="share">
        <button type="button" class="btn-yellow" data-share>Share link</button>
        <button type="button" class="btn-dark" data-copy>Copy summary</button>
        <button type="button" class="btn-dark" data-print>Print</button>
      </div>
    </aside>
  `
  lcdShown = null
  bindForm(panel)
  renderResults()
}

function bindForm(panel: HTMLElement) {
  const form = panel.querySelector<HTMLFormElement>('#calc-form')!
  form.addEventListener('submit', (e) => e.preventDefault())
  form.addEventListener('input', onInput)
  form.addEventListener('change', onChange)
  form.addEventListener('click', onVehicleButtons)
  panel.querySelector('[data-reset]')!.addEventListener('click', () => {
    state.set(active.id, defaultsFor(active))
    renderPanel()
    updateHash()
  })
  panel.querySelector('[data-share]')!.addEventListener('click', share)
  panel.querySelector('[data-copy]')!.addEventListener('click', () => copy(summary(), 'Summary copied'))
  panel.querySelector('[data-print]')!.addEventListener('click', () => window.print())
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const values = valuesFor(active)

  if (el.dataset.vfield) {
    const row = el.closest<HTMLElement>('.vehicle')!
    const list = values.vehicles as Vehicle[]
    const vh = list[Number(row.dataset.index)]
    if (el.dataset.vfield === 'name') vh.name = el.value
    if (el.dataset.vfield === 'consumption') {
      const kind = vh.type === 'ev' ? 'evConsumption' : 'consumption'
      vh.consumption = fromDisplay(kind, parseFloat(el.value) || 0, settings.units)
    }
    return commit()
  }

  const f = active.fields.find((x) => x.key === el.name)
  if (!f || f.kind === 'select' || f.kind === 'toggle') return
  const n = parseFloat(el.value)
  values[f.key] = Number.isFinite(n) ? Math.max(f.min ?? 0, fromDisplay(f.kind, n, settings.units)) : 0

  // editing a preset value by hand means it's custom now
  const preset = active.fields.find((x) => x.options?.some((o) => o.sets && f.key in o.sets))
  if (preset && values[preset.key] !== 'custom') {
    values[preset.key] = 'custom'
    const sel = document.querySelector<HTMLSelectElement>(`#f-${preset.key}`)
    if (sel) sel.value = 'custom'
  }
  commit()
}

function onChange(e: Event) {
  const el = e.target as HTMLInputElement | HTMLSelectElement
  const values = valuesFor(active)

  if (el.dataset.vfield === 'type') {
    const row = el.closest<HTMLElement>('.vehicle')!
    const vh = (values.vehicles as Vehicle[])[Number(row.dataset.index)]
    const was = vh.type
    vh.type = el.value as Vehicle['type']
    // swapping between fuel and electric needs a sane starting number
    if ((was === 'ev') !== (vh.type === 'ev')) vh.consumption = vh.type === 'ev' ? 18 : 10
    renderPanel()
    return commit()
  }

  const f = active.fields.find((x) => x.key === el.name)
  if (!f) return
  if (f.kind === 'toggle') {
    values[f.key] = (el as HTMLInputElement).checked
  } else if (f.kind === 'select') {
    values[f.key] = el.value
    const opt = f.options?.find((o) => o.value === el.value)
    if (opt?.sets) {
      Object.assign(values, opt.sets)
      renderPanel()
    }
  }
  commit()
}

function onVehicleButtons(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!btn) return
  const list = valuesFor(active).vehicles as Vehicle[]
  if (btn.hasAttribute('data-add') && list.length < MAX_VEHICLES) {
    list.push({ name: `Vehicle ${list.length + 1}`, type: 'gas', consumption: 10 })
  } else if (btn.dataset.remove !== undefined && list.length > 1) {
    list.splice(Number(btn.dataset.remove), 1)
  } else {
    return
  }
  renderPanel()
  commit()
  if (btn.hasAttribute('data-add')) {
    const names = document.querySelectorAll<HTMLInputElement>('.vname')
    names[names.length - 1]?.select()
  }
}

function commit() {
  renderResults()
  updateHash()
}

// ---------- results ----------

const LCD_CELLS = 6
let lastResults: Result[] = []
let lcdShown: { kind: string; value: number } | null = null
let tween = 0
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

// split "$1,234.56/km" into prefix, digits the LCD font can draw, and suffix
function splitReadout(text: string) {
  const m = text.match(/^(.*?)(-?[\d,]*\.?\d+)(.*)$/)
  if (!m) return null
  return { pre: m[1].trim(), digits: m[2].replace(/,/g, ''), post: m[3].trim() }
}

function lcdHtml(r: Result, value: number): string {
  const text = formatResult({ ...r, value }, settings)
  const parts = typeof r.value === 'number' ? splitReadout(text) : null
  if (!parts) return `<span class="lcd-text">${esc(text)}</span>`
  // pumps show a fixed row of digits, the unused ones just stay dark.
  // in DSEG '!' is a blank cell the same width as a digit
  const cells = parts.digits.replace('.', '').length
  const pad = '!'.repeat(Math.max(0, LCD_CELLS - cells))
  const lit = pad + parts.digits
  const ghost = lit.replace(/[\d!-]/g, '8')
  return `
    ${parts.pre ? `<span class="lcd-unit pre">${esc(parts.pre)}</span>` : ''}
    <span class="lcd-digits"><span class="ghost" aria-hidden="true">${ghost}</span><span class="lit">${lit}</span></span>
    ${parts.post ? `<span class="lcd-unit post">${esc(parts.post)}</span>` : ''}`
}

function renderReadout(primary: Result | undefined) {
  const label = document.querySelector<HTMLElement>('.readout-label')
  const lcd = document.querySelector<HTMLElement>('.lcd')
  if (!label || !lcd) return
  cancelAnimationFrame(tween)
  if (!primary) {
    label.textContent = ''
    lcd.innerHTML = ''
    return
  }
  label.textContent = primary.label
  if (typeof primary.value !== 'number') {
    lcd.innerHTML = lcdHtml(primary, 0)
    lcdShown = null
    return
  }
  const to = primary.value
  const from = lcdShown && lcdShown.kind === primary.kind ? lcdShown.value : to
  lcdShown = { kind: primary.kind, value: to }
  if (from === to || reducedMotion.matches) {
    lcd.innerHTML = lcdHtml(primary, to)
    return
  }
  // tick up like a pump
  const start = performance.now()
  const dur = 420
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur)
    const eased = 1 - Math.pow(1 - t, 3)
    lcd.innerHTML = lcdHtml(primary, from + (to - from) * eased)
    if (t < 1) tween = requestAnimationFrame(step)
  }
  tween = requestAnimationFrame(step)
}

function renderResults() {
  const list = document.querySelector<HTMLElement>('.pump .rows')
  if (!list) return
  lastResults = active.compute(valuesFor(active))
  const primary = lastResults.find((r) => r.primary)
  const rest = lastResults.filter((r) => r !== primary)
  renderReadout(primary)
  list.innerHTML = rest
    .map(
      (r) => `
      <li class="${r.highlight ? 'best' : ''}${typeof r.value === 'string' && r.value.length > 22 ? ' stack' : ''}">
        <span class="row-label">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span>
        <span class="row-value">${formatResult(r, settings)}</span>
        ${r.bar !== undefined ? `<span class="gauge" aria-hidden="true"><span style="width:${Math.min(1, Math.max(0, r.bar)) * 100}%"></span></span>` : ''}
      </li>`,
    )
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
  const sym = currencySymbol(settings.currency)
  const lines = [active.title, '']
  for (const f of active.fields) {
    const v = values[f.key]
    if (f.kind === 'vehicles') {
      for (const vh of v as Vehicle[]) {
        const kind = vh.type === 'ev' ? 'evConsumption' : 'consumption'
        lines.push(`${vh.name} (${vh.type}): ${tidy(toDisplay(kind, vh.consumption, settings.units), 1)} ${unitSuffix(kind, settings.units, '')}`)
      }
    } else if (f.kind === 'toggle') {
      lines.push(`${f.label}: ${v ? 'yes' : 'no'}`)
    } else if (f.kind === 'select') {
      lines.push(`${f.label}: ${f.options?.find((o) => o.value === v)?.label ?? v}`)
    } else {
      lines.push(`${f.label}: ${tidy(toDisplay(f.kind, Number(v), settings.units), 2)} ${f.suffix ?? unitSuffix(f.kind, settings.units, sym)}`.trim())
    }
  }
  lines.push('')
  for (const r of lastResults) lines.push(`${r.label}: ${formatResult(r, settings)}`)
  lines.push('', shareUrl())
  return lines.join('\n')
}

async function share() {
  const url = shareUrl()
  const primary = lastResults.find((r) => r.primary)
  const text = primary ? `${active.title}: ${primary.label.toLowerCase()} ${formatResult(primary, settings)}` : active.title
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Real Cost Calculator', text, url })
      return
    } catch {
      // cancelled, fall back to clipboard
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
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800)
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
syncSettingsUi()
renderPanel()

window.addEventListener('hashchange', () => {
  if (applyHash()) {
    syncSettingsUi()
    renderPanel()
  }
})

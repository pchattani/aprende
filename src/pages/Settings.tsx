import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSettings, SESSION_COUNT, type Settings as SettingsState } from '../store/settings'
import { targetVoices, speak, sttSupported, ttsSupported } from '../engine/speech'
import { exportAll, importAll, resetAll, type Backup } from '../db/progress'
import { PageHeader, Button } from '../components/ui/basics'
import { pack, ui, LANGUAGE } from '../engine/loader'
import { COURSES, HUB_URL } from '../courses'

export default function Settings() {
  const s = useSettings()
  const nav = useNavigate()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [msg, setMsg] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const load = () => setVoices(targetVoices(pack.tts.lang))
    load()
    const t = setTimeout(load, 500)
    window.speechSynthesis?.addEventListener?.('voiceschanged', load)
    return () => {
      clearTimeout(t)
      window.speechSynthesis?.removeEventListener?.('voiceschanged', load)
    }
  }, [])

  const doExport = async () => {
    const b = await exportAll()
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aprende-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg(`Exported ${b.cards.length} items and ${b.reviews.length} reviews.`)
  }
  const doImport = async (file: File) => {
    try {
      const b = JSON.parse(await file.text()) as Backup
      await importAll(b)
      setMsg(`Imported ${b.cards.length} items. Your progress is restored.`)
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }
  const stt = sttSupported()

  return (
    <div className="pb-8">
      <PageHeader title="Settings" />
      <Section title="Learning">
        <Select label="Lesson length" hint="How many exercises a lesson session has." value={s.sessionLength} onChange={(v) => s.setSessionLength(v as SettingsState['sessionLength'])} options={[['short', `Short · ${SESSION_COUNT.short} exercises`], ['normal', `Normal · ${SESSION_COUNT.normal} exercises`], ['long', `Long · ${SESSION_COUNT.long} exercises`]]} />
        <Select label="Speaking exercises" hint={stt ? 'Uses your browser’s speech recognition. Nothing is sent to us.' : 'Speech recognition is not supported in this browser.'} value={stt ? s.speaking : 'off'} onChange={(v) => s.setSpeaking(v as SettingsState['speaking'])} options={[['off', 'Off'], ['some', 'Some · up to 2 per lesson'], ['lots', 'Lots · up to 3 per lesson, answer questions aloud']]} disabled={!stt} />
        <Toggle label="Keep my mistakes for later" hint="Wrong answers are pinned automatically for a focused re-test (Review → Pinned)." checked={s.autoPin} onChange={s.setAutoPin} />
        <Range label={`Daily practice goal: ${s.dailyMinutes} minutes`} min={5} max={40} step={5} value={s.dailyMinutes} onChange={s.setDailyMinutes} />
        {pack.variety.alternatives.length > 0 && (
          <Select label={`${LANGUAGE} variety`} value={s.variety || pack.variety.default} onChange={(v) => s.setVariety(v)} options={[[pack.variety.default, `${pack.variety.label} — default`], ...pack.variety.alternatives.map((a) => [a.code, `${a.label} (notes shown)`] as [string, string])]} />
        )}
        {pack.features.romanization !== 'none' && (
          <Toggle label="Show Jyutping" hint="Romanisation above every character. Turn it off to practise reading characters." checked={s.romanization} onChange={s.setRomanization} />
        )}
      </Section>
      <Section title="Just for fun">
        <Toggle label={`${ui.spicyName} 🌶️`} hint="Cheeky, flirty example sentences for grown-ups, mixed into lessons at your level. Off by default." checked={s.spicy} onChange={s.setSpicy} />
      </Section>
      <Section title="Sound and voice">
        <Toggle label="Sounds" hint="Feedback sounds and audio." checked={s.sound} onChange={s.setSound} />
        <Toggle label="Vibration" hint="A light buzz on right answers and streaks, on phones that support it." checked={s.vibration} onChange={s.setVibration} />
        <Range label={`Speech rate: ${s.ttsRate.toFixed(2)}× · slow button ${(s.ttsRate * 0.5).toFixed(2)}×, word by word`} min={0.4} max={1.3} step={0.05} value={s.ttsRate} onChange={s.setTtsRate} />
        {ttsSupported() ? (
          <>
            <Select label="Voice" value={s.voiceURI ?? ''} onChange={(v) => s.setVoice(v || undefined)} options={[['', 'Automatic (best es-ES voice)'], ...voices.map((v) => [v.voiceURI, `${v.name} (${v.lang})${v.localService ? '' : ' · online'}`] as [string, string])]} />
            <Button variant="ghost" className="mt-2 w-full" onClick={() => void speak(ui.voiceTest, { lang: pack.tts.lang, rate: s.ttsRate, voiceURI: s.voiceURI, preferred: pack.tts.preferredVoices })}>Test voice</Button>
            {voices.length === 0 && <p className="mt-2 text-xs text-muted">{ui.voiceHelp}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Text-to-speech is not available in this browser.</p>
        )}
      </Section>
      <Section title="Appearance">
        <Select label="Theme" value={s.theme} onChange={(v) => s.setTheme(v as 'system' | 'light' | 'dark')} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
      </Section>
      <Section title="Starting level">
        <p className="text-sm text-muted">Already know some {LANGUAGE}? Retake the placement test or pick the level where lessons should start. Earlier levels stay open for practice.</p>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => nav('/welcome')}>Change starting level</Button>
      </Section>
      <Section title="Backup">
        <p className="text-sm text-muted">Everything is stored on this device. Export a backup to move to another phone or computer.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => void doExport()}>Export</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>Import</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
        </div>
        {msg && <p className="mt-2 text-sm font-bold text-ok-600">{msg}</p>}
      </Section>
      <Section title="Danger zone">
        {!confirmReset ? (
          <Button variant="bad" className="w-full" onClick={() => setConfirmReset(true)}>Reset all progress</Button>
        ) : (
          <div>
            <p className="text-sm font-bold">This deletes every card, review and lesson record on this device. Export first if in doubt.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button variant="bad" onClick={async () => { await resetAll(); setConfirmReset(false); nav('/') }}>Yes, reset</Button>
            </div>
          </div>
        )}
      </Section>
      <Section title="Other languages">
        <p className="text-sm text-muted">The same journey, method and games in other languages. Each keeps its own journal on this device; the Pawsport hub shows them all.</p>
        <a href={HUB_URL} className="btn btn-ghost mt-2 w-full">All languages · Pawsport hub</a>
        <ul className="mt-2 grid gap-2">
          {COURSES.filter((c) => c.id !== pack.id).map((c) => (
            <li key={c.id}>
              <a href={c.href} className="tile flex items-center gap-3 py-2.5">
                <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{c.name}</span><span className="block text-xs text-muted">{c.native}</span></span>
                <span aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <p className="mt-6 text-center text-xs text-muted">{ui.appName} · open source · no accounts, no tracking, no AI, works offline.</p>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
        Pawsport is an independent project by an individual. It is not affiliated with, endorsed by or connected to Duolingo, Inc. or any other language-learning company, and uses none of their content or trademarks.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-6 w-11 appearance-none rounded-full bg-stone-300 transition checked:bg-ok-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5 disabled:opacity-40" />
    </label>
  )
}
function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block font-bold">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-brand-600)]" />
    </label>
  )
}
function Select({ label, hint, value, onChange, options, disabled }: { label: string; hint?: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block font-bold">{label}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-surface-2 p-2 disabled:opacity-50">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

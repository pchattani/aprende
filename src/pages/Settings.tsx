import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSettings } from '../store/settings'
import { spanishVoices, speak, sttSupported, ttsSupported } from '../engine/speech'
import { exportAll, importAll, resetAll, type Backup } from '../db/progress'
import { PageHeader, Button } from '../components/ui/basics'
import { pack } from '../engine/loader'

export default function Settings() {
  const s = useSettings()
  const nav = useNavigate()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [msg, setMsg] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const load = () => setVoices(spanishVoices())
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

  return (
    <div className="pb-8">
      <PageHeader title="Settings" />
      <Section title="Learning">
        <Toggle label="Hearts in lessons" hint="Three mistakes end a lesson. Turn off for a gentler mode." checked={s.hearts} onChange={s.setHearts} />
        <Toggle label="Speaking exercises" hint={sttSupported() ? 'Uses your browser’s speech recognition. Nothing is sent to us.' : 'Not supported in this browser.'} checked={s.speech && sttSupported()} onChange={s.setSpeech} disabled={!sttSupported()} />
        <Range label={`Daily goal: ${s.dailyGoal} XP`} min={10} max={100} step={10} value={s.dailyGoal} onChange={s.setDailyGoal} />
        <Select label="Spanish variety" value={s.variety} onChange={(v) => s.setVariety(v as 'es-ES' | 'es-419')} options={[['es-ES', 'Castilian (Spain) — default'], ['es-419', 'Latin American (notes shown)']]} />
      </Section>
      <Section title="Sound and voice">
        <Toggle label="Sounds" hint="Feedback sounds and audio." checked={s.sound} onChange={s.setSound} />
        <Range label={`Speech rate: ${s.ttsRate.toFixed(2)}×`} min={0.5} max={1.3} step={0.05} value={s.ttsRate} onChange={s.setTtsRate} />
        {ttsSupported() ? (
          <>
            <Select label="Voice" value={s.voiceURI ?? ''} onChange={(v) => s.setVoice(v || undefined)} options={[['', 'Automatic (best es-ES voice)'], ...voices.map((v) => [v.voiceURI, `${v.name} (${v.lang})${v.localService ? '' : ' · online'}`] as [string, string])]} />
            <Button variant="ghost" className="mt-2 w-full" onClick={() => void speak('Hola, ¿qué tal? Me llamo Aprende y voy a ayudarte con el español.', { lang: pack.tts.lang, rate: s.ttsRate, voiceURI: s.voiceURI, preferred: pack.tts.preferredVoices })}>Test voice</Button>
            {voices.length === 0 && <p className="mt-2 text-xs text-muted">No Spanish voice installed. On Windows add “Spanish (Spain)” speech in Settings → Time & Language; on Android install Google TTS Spanish; iOS and macOS include Mónica/Jorge.</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Text-to-speech is not available in this browser.</p>
        )}
      </Section>
      <Section title="Appearance">
        <Select label="Theme" value={s.theme} onChange={(v) => s.setTheme(v as 'system' | 'light' | 'dark')} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
      </Section>
      <Section title="Starting level">
        <p className="text-sm text-muted">Already know some Spanish? Retake the placement test or pick the level where lessons should start. Earlier levels stay open for practice.</p>
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
      <p className="mt-6 text-center text-xs text-muted">Aprende · open source · no accounts, no tracking, no AI, works offline.</p>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
        Aprende is an independent project by an individual. It is not affiliated with, endorsed by or connected to Duolingo, Inc. or any other language-learning company, and uses none of their content or trademarks.
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
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="block font-bold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-surface-2 p-2">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

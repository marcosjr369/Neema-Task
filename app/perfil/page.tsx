'use client'

import { useState } from 'react'
import {
  ArrowCounterClockwiseIcon, BellIcon, BellRingingIcon, BellSlashIcon, CheckIcon, LockIcon, MinusIcon,
  PencilSimpleIcon, PlusIcon, SpeakerHighIcon, SpeakerSlashIcon,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { useAccount } from '../context/AccountContext'
import { Settings } from '../types'
import { sounds } from '../lib/sounds'
import { POINTS_HELP } from '../lib/points'
import { achievementProgress, bestStreak, formatShort, levelInfo, sumSeconds, totalXp } from '../lib/stats'
import { achievements as listAchievements, isUnlocked } from '../lib/achievements'
import { REMINDER_INTERVALS } from '../lib/nudges'
import PushCard from '../components/account/PushCard'
import InstallCard from '../components/ui/InstallCard'
import Avatar from '../components/ui/Avatar'
import Modal from '../components/ui/Modal'
import AccountSection from './AccountSection'
import CompanyProfile from './CompanyProfile'
import { useOrg } from '../context/OrgContext'
import LogoutButton from '../components/account/LogoutButton'

type Tab = 'resumo' | 'definicoes' | 'conta'
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'definicoes', label: 'Definições' },
  { id: 'conta', label: 'Conta' },
]


function Stepper({
  label, value, unit, min, max, step, onChange,
}: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="font-bold text-body">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - step))} className="btn btn-ghost h-9 w-9 rounded-xl p-0 text-body" aria-label={`Diminuir ${label}`}>
          <MinusIcon size={16} />
        </button>
        <span className="w-16 text-center font-black text-ink">{value} <span className="text-xs text-muted">{unit}</span></span>
        <button onClick={() => onChange(Math.min(max, value + step))} className="btn btn-ghost h-9 w-9 rounded-xl p-0 text-body" aria-label={`Aumentar ${label}`}>
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, desc, on, onChange, icon }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer">
      <span className="text-muted">{icon}</span>
      <span className="flex-1">
        <span className="block font-bold text-body">{label}</span>
        {desc && <span className="block text-xs font-semibold text-muted">{desc}</span>}
      </span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

/** Cabeçalho: foto, nome editável, nível */
function ProfileHeader() {
  const { allSessions, tasks, history } = useApp()
  const { user, updateMe } = useAccount()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const xp = totalXp(allSessions, tasks, history)
  const lvl = levelInfo(xp)
  if (!user) return null

  const save = () => {
    setEditing(false)
    if (name.trim() && name.trim() !== user.name) updateMe({ name }).catch(() => setName(user.name))
  }

  return (
    <header className="px-4 pb-5 pt-6 lg:px-0">
      <div className="flex items-start gap-4">
        <div className="relative">
          <Avatar name={user.name} picture={user.picture} size={76} />
          <span className="absolute -bottom-1 -right-1 flex h-8 min-w-8 items-center justify-center rounded-xl border-2 border-white bg-brand px-1.5 text-sm font-black text-white">
            {lvl.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={save}
              onKeyDown={e => e.key === 'Enter' && save()}
              aria-label="Nome"
              autoFocus
              className="w-full rounded-lg bg-snow px-2 text-2xl font-black text-ink outline-none"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-2 text-left cursor-pointer">
              <span className="truncate text-2xl font-black text-ink">{user.name}</span>
              <PencilSimpleIcon size={18} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <p className="truncate text-sm font-semibold text-muted">
            {user.email} · desde {new Date(user.createdAt).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <LogoutButton variant="icon" />
      </div>
      <div className="mt-5">
        <div className="mb-1 flex justify-between text-sm font-extrabold">
          <span className="text-brand-dark">Nível {lvl.level}</span>
          <span className="text-muted">{xp} / {lvl.next} XP</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-line">
          <div className="relative h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${Math.max(lvl.progress * 100, 3)}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </header>
  )
}

function Summary() {
  const { allSessions, tasks, history } = useApp()
  const { hours, done, record } = achievementProgress(allSessions, tasks, history)
  const achievements = listAchievements(allSessions, tasks, history)
  const unlocked = achievements.filter(isUnlocked).length

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Horas', value: formatShort(hours * 3600), color: '#12B5A6' },
          { label: 'Concluídas', value: String(done), color: '#7B61FF' },
          { label: 'Recorde', value: `${record} d`, color: '#FF8A3D' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] font-extrabold uppercase text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-black text-ink">Conquistas</h2>
          <span className="text-sm font-bold text-muted">{unlocked}/{achievements.length}</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {achievements.map(a => {
            const ok = isUnlocked(a)
            const pct = Math.min(1, a.value / a.target)
            const AIcon = a.icon
            return (
              <li key={a.id} className="card flex items-center gap-4 p-4">
                <span
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: ok ? a.color : '#E9E7F2', boxShadow: `0 4px 0 ${ok ? '#0002' : '#D3D0E0'}`, color: ok ? '#fff' : '#B9B6CC' }}
                >
                  <AIcon size={30} weight={ok ? 'fill' : 'duotone'} />
                  {!ok && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-muted shadow">
                      <LockIcon size={12} weight="fill" />
                    </span>
                  )}
                  {ok && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white ring-2 ring-white">
                      <CheckIcon size={12} weight="bold" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-ink">{a.title}</div>
                  <div className="mb-1.5 text-xs font-semibold text-muted">{a.desc}</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct * 100}%`, background: ok ? a.color : '#FFC53D' }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted">{Math.floor(Math.min(a.value, a.target))}/{a.target}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card bg-snow p-4">
        <h2 className="mb-2 font-black text-ink">Como ganhas XP</h2>
        <ul className="space-y-1 text-sm font-semibold text-body">
          {POINTS_HELP.map(h => <li key={h}>• {h}</li>)}
        </ul>
      </section>
    </div>
  )
}

function Preferences() {
  const { settings, updateSettings, notificationPermission, requestNotifications, showToast } = useApp()
  const set = (patch: Partial<Settings>) => updateSettings(patch)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-black text-ink">Cronómetro e pausas</h2>
        <div className="card divide-y-2 divide-line">
          <Stepper label="Foco antes da pausa" value={settings.workMinutes} unit="min" min={5} max={180} step={5} onChange={v => set({ workMinutes: v })} />
          <Stepper label="Pausa curta" value={settings.shortBreakMinutes} unit="min" min={1} max={30} step={1} onChange={v => set({ shortBreakMinutes: v })} />
          <Stepper label="Pausa longa" value={settings.longBreakMinutes} unit="min" min={5} max={60} step={5} onChange={v => set({ longBreakMinutes: v })} />
          <Stepper label="Pausa longa a cada" value={settings.longBreakEvery} unit="blocos" min={1} max={10} step={1} onChange={v => set({ longBreakEvery: v })} />
          <Stepper label="Objetivo diário" value={settings.dailyGoalMinutes} unit="min" min={15} max={720} step={15} onChange={v => set({ dailyGoalMinutes: v })} />
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">O tempo de foco usado por omissão em novas tarefas. Cada tarefa pode ter o seu.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-ink">Alertas</h2>
        <div className="card divide-y-2 divide-line">
          <Toggle label="Alertas de pausa" desc="Avisa quando é hora de descansar" on={settings.breakAlerts} onChange={v => set({ breakAlerts: v })} icon={<BellIcon size={22} />} />
          <Toggle
            label="Sons"
            on={settings.sound}
            onChange={v => {
              set({ sound: v })
              if (v) sounds.backToWork()
            }}
            icon={settings.sound ? <SpeakerHighIcon size={22} /> : <SpeakerSlashIcon size={22} />}
          />
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-muted">{notificationPermission === 'granted' ? <BellIcon size={22} /> : <BellSlashIcon size={22} />}</span>
            <span className="flex-1">
              <span className="block font-bold text-body">Notificações do sistema</span>
              <span className="block text-xs font-semibold text-muted">
                {notificationPermission === 'granted'
                  ? 'Activadas'
                  : notificationPermission === 'denied'
                    ? 'Bloqueadas: activa nas definições do browser'
                    : notificationPermission === 'unsupported'
                      ? 'Não suportadas neste browser'
                      : 'Desactivadas'}
              </span>
            </span>
            {notificationPermission === 'default' && (
              <button onClick={requestNotifications} className="btn btn-accent px-3 py-2 text-xs">Activar</button>
            )}
          </div>
          <button
            onClick={() => {
              sounds.breakTime()
              showToast('Este é o som do alerta de pausa')
            }}
            className="w-full px-4 py-3 text-left text-sm font-extrabold uppercase tracking-wide text-accent cursor-pointer"
          >
            Testar som de alerta
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-black text-ink">Lembretes para voltar ao foco</h2>
        <p className="mb-3 text-sm font-semibold text-muted">
          Se ficares este tempo sem o cronómetro a correr, a Udacha fica triste e avisa-te.
        </p>
        <div className="card divide-y-2 divide-line">
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center gap-3">
              <BellRingingIcon size={22} className="text-muted" />
              <span className="font-bold text-body">Avisar depois de</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {REMINDER_INTERVALS.map(r => (
                <button
                  key={r.minutes}
                  onClick={() => set({ idleReminderMinutes: r.minutes })}
                  className={`chip justify-center px-1 text-xs ${settings.idleReminderMinutes === r.minutes ? 'border-brand! bg-brand-light! text-brand-dark!' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {settings.idleReminderMinutes > 0 && (
            <>
              <Stepper label="A partir das" value={settings.reminderStartHour} unit="h" min={0} max={settings.reminderEndHour - 1} step={1} onChange={v => set({ reminderStartHour: v })} />
              <Stepper label="Até às" value={settings.reminderEndHour} unit="h" min={settings.reminderStartHour + 1} max={24} step={1} onChange={v => set({ reminderEndHour: v })} />
            </>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">
          Com a app aberta, o aviso aparece no ecrã. Para receberes também com a app fechada, activa em baixo. Depois de cumprires a meta diária, a Udacha deixa-te em paz.
        </p>
        {settings.idleReminderMinutes > 0 && <div className="mt-3"><PushCard /></div>}
      </section>

      <InstallCard />
    </div>
  )
}

function AccountTab() {
  const { resetAll, showToast, orgMode } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="space-y-6">
      <AccountSection />
      {!orgMode && (
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">Zona de perigo</h2>
          <button onClick={() => setConfirmReset(true)} className="btn btn-ghost w-full text-danger">
            <ArrowCounterClockwiseIcon size={18} /> Apagar os meus dados pessoais
          </button>
        </section>
      )}
      {confirmReset && (
        <Modal
          title="Apagar tudo?"
          onClose={() => setConfirmReset(false)}
          footer={
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    await resetAll()
                    showToast('Dados apagados', 'danger')
                  } catch {
                    showToast('Não foi possível apagar. Tenta de novo.', 'danger')
                  }
                  setConfirmReset(false)
                }}
                className="btn btn-danger w-full"
              >
                Apagar tudo
              </button>
              <button onClick={() => setConfirmReset(false)} className="btn btn-ghost w-full">Cancelar</button>
            </div>
          }
        >
          <p className="font-semibold text-muted">
            As tarefas pessoais, o tempo registado e as definições são apagados da tua conta. Os dados das empresas não são afectados. Não dá para desfazer.
          </p>
        </Modal>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const org = useOrg()
  // a conta da empresa não tem progresso próprio: o perfil mostra a equipa
  return org?.isCompany ? <CompanyProfile /> : <PersonProfile />
}

function PersonProfile() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    return t && TABS.some(x => x.id === t) ? t : 'resumo'
  })

  return (
    <div>
      <ProfileHeader />
      <nav className="sticky top-0 z-20 flex gap-1 border-b-2 border-line bg-white/95 px-4 backdrop-blur lg:px-0" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-4 px-3 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors cursor-pointer sm:flex-none ${
              tab === t.id ? 'border-brand text-brand-dark' : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div key={tab} className="px-4 pb-6 pt-5 animate-fade-in lg:px-0">
        {tab === 'resumo' && <Summary />}
        {tab === 'definicoes' && <Preferences />}
        {tab === 'conta' && <AccountTab />}
      </div>
    </div>
  )
}

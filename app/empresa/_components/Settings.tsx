'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { GearSixIcon, PaletteIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { ListSkeleton } from '../../components/ui/Skeleton'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { ORG_SIZES, SECTORS } from '../../lib/org'
import { DEFAULT_DAILY_GOAL_HOURS } from '../../lib/records'
import { Busy } from '../../components/ui/Spinner'

function GeneralSettings() {
  const org = useOrgRequired()
  const { showToast } = useApp()
  const [name, setName] = useState(org.org.name)
  const [sector, setSector] = useState(org.org.sector)
  const [size, setSize] = useState(org.org.size ?? '')
  const [domain, setDomain] = useState(org.org.domain ?? '')
  const [hidden, setHidden] = useState(!!org.org.hideFromRanking)
  const [goal, setGoal] = useState(String(org.org.dailyGoalHours ?? DEFAULT_DAILY_GOAL_HOURS))
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(org.base, { method: 'PATCH', body: { name, sector, size, domain, hideFromRanking: hidden, dailyGoalHours: Number(goal.replace(',', '.')) } })
      await org.refresh()
      showToast('Definições guardadas', 'success')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível guardar as definições. Tenta outra vez.'), 'danger')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <div>
        <label className="label" htmlFor="s-name">Nome da empresa</label>
        <input id="s-name" className="input" value={name} onChange={e => setName(e.target.value)} required maxLength={80} />
      </div>
      <div>
        <span className="label">Sector</span>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map(s => (
            <button type="button" key={s} onClick={() => setSector(sector === s ? '' : s)} className={`chip ${sector === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Número de pessoas</span>
        <div className="flex flex-wrap gap-2">
          {ORG_SIZES.map(s => (
            <button type="button" key={s} onClick={() => setSize(size === s ? '' : s)} className={`chip ${size === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="s-domain">Domínio de email</label>
        <div className="flex items-center gap-2">
          <span className="font-black text-muted">@</span>
          <input id="s-domain" className="input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="empresa.com" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="s-goal">Meta diária de trabalho</label>
        <div className="flex items-center gap-2">
          <input
            id="s-goal"
            type="number"
            min={1}
            max={16}
            step={0.5}
            className="input w-28"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            required
          />
          <span className="font-bold text-muted">horas por pessoa</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-muted">
          Conta o tempo a trabalhar, em reunião e em formação. Usada nos Recordes para ver quem fica na meta, abaixo ou acima (margem de 15 min).
        </p>
      </div>
      <div>
        <span className="label">Ranking de empresas</span>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line p-3 hover:bg-snow">
          <input type="checkbox" className="h-5 w-5 accent-brand" checked={!hidden} onChange={e => setHidden(!e.target.checked)} />
          <span>
            <span className="block font-black text-ink">Mostrar a empresa no ranking geral</span>
          </span>
        </label>
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary">
        <Busy busy={busy} text="A guardar…">Guardar</Busy>
      </button>
    </form>
  )
}

const Permissions = dynamic(() => import('./Permissions'), { loading: () => <ListSkeleton rows={6} /> })
const Appearance = dynamic(() => import('./Appearance'), { loading: () => <ListSkeleton rows={6} /> })

type Tab = 'geral' | 'permissoes' | 'aparencia'

/**
 * Definições da empresa. Os administradores vêem tudo; as chefias só a Aparência (dos seus departamentos).
 * O separador fica no endereço (?tab=…) para se poder abrir directamente.
 */
export default function Settings() {
  const org = useOrgRequired()
  const router = useRouter()
  const params = useSearchParams()
  const tabs: { id: Tab; label: string; icon: typeof GearSixIcon }[] = org.isAdmin
    ? [
        { id: 'geral', label: 'Geral', icon: GearSixIcon },
        { id: 'permissoes', label: 'Permissões', icon: ShieldCheckIcon },
        { id: 'aparencia', label: 'Aparência', icon: PaletteIcon },
      ]
    : [{ id: 'aparencia', label: 'Aparência', icon: PaletteIcon }]
  const asked = params.get('tab') as Tab | null
  const tab = tabs.find(t => t.id === asked)?.id ?? tabs[0].id
  const go = (t: Tab) => router.replace(`/empresa/definicoes?tab=${t}`, { scroll: false })

  return (
    <div>
      {tabs.length > 1 && (
        <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b-2 border-line px-4 lg:mx-0 lg:px-0" aria-label="Definições">
          {tabs.map(t => (
            <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`-mb-0.5 inline-flex shrink-0 items-center gap-1.5 border-b-[3px] px-3 py-2 text-sm font-extrabold transition-colors cursor-pointer ${tab === t.id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
              <t.icon size={17} weight={tab === t.id ? 'fill' : 'bold'} /> {t.label}
            </button>
          ))}
        </nav>
      )}
      {tab === 'geral' && <GeneralSettings />}
      {tab === 'permissoes' && <Permissions />}
      {tab === 'aparencia' && <Appearance />}
    </div>
  )
}

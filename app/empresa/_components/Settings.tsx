'use client'

import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useOrgRequired } from '../../context/OrgContext'
import { api, errorText } from '../../lib/api'
import { ORG_SIZES, SECTORS } from '../../lib/org'
import { DEFAULT_DAILY_GOAL_HOURS } from '../../lib/records'

export default function Settings() {
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
      showToast(errorText(err), 'danger')
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
        {busy ? 'A guardar…' : 'Guardar'}
      </button>
    </form>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { BellRingingIcon, DeviceMobileIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useApp } from '../../context/AppContext'
import { api, errorText } from '../../lib/api'
import { disablePush, enablePush, pushState, type PushState } from '../../lib/push'

const HINT: Record<PushState, string> = {
  unsupported: 'Este browser não suporta notificações push.',
  'needs-install': 'No iPhone, primeiro instala a app: Partilhar → Adicionar ao ecrã principal. Depois abre-a por lá e volta aqui.',
  denied: 'As notificações estão bloqueadas. Activa-as nas definições do browser para este site.',
  off: 'A Udacha avisa-te mesmo com a app fechada, no intervalo e horário que escolheste em cima.',
  on: 'Activo neste dispositivo. Os lembretes chegam mesmo com a app fechada.',
}

/** Activar lembretes por notificação push neste dispositivo */
export default function PushCard() {
  const { showToast } = useApp()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      if (state === 'on') {
        await disablePush()
        showToast('Lembretes desligados neste dispositivo')
      } else {
        await enablePush()
        showToast('Lembretes activados neste dispositivo', 'success')
      }
      setState(await pushState())
    } catch (err) {
      showToast(errorText(err), 'danger')
      setState(await pushState().catch(() => 'unsupported' as const))
    }
    setBusy(false)
  }

  const test = async () => {
    try {
      await api('/api/push/test', { method: 'POST' })
      showToast('Notificação de teste enviada', 'success')
    } catch (err) {
      showToast(errorText(err), 'danger')
    }
  }

  const on = state === 'on'
  const canToggle = state === 'on' || state === 'off'

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-accent-light text-accent-dark' : 'bg-snow text-muted'}`}>
          {state === 'needs-install' ? <DeviceMobileIcon size={24} weight="duotone" /> : <BellRingingIcon size={24} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">Lembretes com a app fechada</p>
          <p className="text-sm font-semibold text-muted">{state ? HINT[state] : 'A verificar…'}</p>
        </div>
        {canToggle && (
          <button onClick={toggle} disabled={busy} role="switch" aria-checked={on} aria-label="Lembretes com a app fechada" className="shrink-0 cursor-pointer">
            <span className={`relative block h-7 w-12 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? 'left-6' : 'left-1'}`} />
            </span>
          </button>
        )}
      </div>
      {on && (
        <button onClick={test} className="mt-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-accent cursor-pointer">
          <PaperPlaneTiltIcon size={18} /> Enviar notificação de teste
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { CheckCircleIcon, LockKeyIcon, ProhibitIcon, WarningIcon, type Icon } from '@phosphor-icons/react'
import Modal from '../../../components/ui/Modal'
import { api, errorText } from '../../../lib/api'
import type { PanelUser } from '../../../lib/server/panelStats'

export type UserAction = 'disable' | 'enable' | 'delete'
export type ActionResult = { name?: string; deletedOrgs?: string[]; promoted?: string[]; clerk: string }

const COPY: Record<UserAction, { title: string; button: string; busy: string; icon: Icon; tone: 'danger' | 'accent' }> = {
  disable: { title: 'Desactivar utilizador', button: 'Desactivar', busy: 'A desactivar…', icon: ProhibitIcon, tone: 'danger' },
  enable: { title: 'Reactivar utilizador', button: 'Reactivar', busy: 'A reactivar…', icon: CheckCircleIcon, tone: 'accent' },
  delete: { title: 'Eliminar utilizador', button: 'Eliminar de vez', busy: 'A eliminar…', icon: WarningIcon, tone: 'danger' },
}

/** Confirmação das acções sobre um utilizador: explica o efeito e pede a palavra-passe do painel outra vez */
export default function ConfirmUserModal({
  user, action, onClose, onDone,
}: { user: Pick<PanelUser, 'id' | 'name' | 'email' | 'disabled' | 'orgs'>; action: UserAction; onClose: () => void; onDone: (r: ActionResult) => void }) {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const copy = COPY[action]
  const danger = copy.tone === 'danger'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const url = `/api/painel/utilizadores/${user.id}`
      onDone(
        action === 'delete'
          ? await api<ActionResult>(url, { method: 'DELETE', body: { password, reason } })
          : await api<ActionResult>(url, { method: 'PATCH', body: { disabled: action === 'disable', password } }),
      )
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={copy.title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost flex-1">Cancelar</button>
          <button
            type="submit"
            form="f-confirm"
            disabled={busy || !password}
            className={`btn flex-1 ${busy || !password ? 'btn-disabled' : danger ? 'btn-danger' : 'btn-accent'}`}
          >
            {busy ? copy.busy : copy.button}
          </button>
        </div>
      }
    >
      <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${danger ? 'border-danger/30 bg-danger-light' : 'border-accent/30 bg-accent-light'}`}>
        <copy.icon size={24} weight="fill" className={`mt-0.5 shrink-0 ${danger ? 'text-danger' : 'text-accent-dark'}`} />
        <div className="text-sm font-semibold text-body">
          <p className="font-black text-ink">{user.name} · {user.email}</p>
          {action === 'disable' && (
            <p className="mt-1">Deixa de conseguir entrar na app: as sessões terminam e a conta fica bloqueada no Clerk. Os dados ficam guardados e podes reactivar quando quiseres.</p>
          )}
          {action === 'enable' && <p className="mt-1">Volta a poder entrar na app com a mesma conta e os mesmos dados.</p>}
          {action === 'delete' && (
            <>
              <p className="mt-1">Apaga a conta (também no Clerk), as tarefas e o tempo pessoais, e a ligação às empresas. <b>Não dá para desfazer.</b></p>
              {user.orgs.length > 0 && (
                <p className="mt-1">
                  Empresas: {user.orgs.map(o => o.name).join(', ')}. Se for a única pessoa, a empresa é apagada; se for o único administrador, o funcionário mais antigo passa a administrador.
                </p>
              )}
              {!user.disabled && <p className="mt-1 text-muted">Se só queres impedir o acesso, usa “Desactivar”: dá para voltar atrás.</p>}
            </>
          )}
        </div>
      </div>
      <form id="f-confirm" onSubmit={submit} className="mt-4">
        {action === 'delete' && (
          <div className="mb-4">
            <label className="label" htmlFor="confirm-reason">Motivo (opcional)</label>
            <textarea
              id="confirm-reason"
              className="input min-h-20 resize-y"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ex.: pedido do utilizador, conta duplicada…"
            />
            <p className="mt-1 text-xs font-semibold text-muted">Fica no registo da página Eliminados.</p>
          </div>
        )}
        <label className="label" htmlFor="confirm-pass">Palavra-passe do painel</label>
        <span className="relative block">
          <LockKeyIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="confirm-pass"
            type="password"
            className={`input pl-10 ${error ? 'border-danger! bg-danger-light!' : ''}`}
            value={password}
            onChange={e => { setPassword(e.target.value); if (error) setError('') }}
            autoFocus={action !== 'delete'}
            autoComplete="current-password"
            aria-invalid={!!error}
          />
        </span>
        {error && <p className="mt-2 text-sm font-bold text-danger">{error}</p>}
      </form>
    </Modal>
  )
}

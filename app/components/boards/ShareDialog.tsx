'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowsClockwiseIcon, CheckIcon, CopyIcon, GlobeIcon, KeyIcon, LockIcon, TrashIcon, UsersThreeIcon } from '@phosphor-icons/react'
import Modal from '../ui/Modal'
import Avatar from '../ui/Avatar'
import { api, errorText } from '../../lib/api'
import { shareUrl } from '../../lib/boards'
import { useApp } from '../../context/AppContext'
import type { ShareRole, ShareVisibility, SharingInfo } from '../../types'
import { ListSkeleton, Sk } from '../ui/Skeleton'

type GrantRow = { id: string; email: string; role: ShareRole | 'pending'; name?: string; picture?: string; createdAt: number }
type ShareState = { sharing: SharingInfo; grants: GrantRow[]; members: { email: string; name: string }[] }

const ROLE_TEXT: Record<ShareRole, string> = { view: 'Pode ver', edit: 'Pode editar' }

function Option({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors cursor-pointer ${active ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'}`}>
      <span className={`mt-0.5 ${active ? 'text-brand' : 'text-muted'}`}>{icon}</span>
      <span className="flex-1">
        <span className="block font-black text-ink">{title}</span>
        <span className="block text-sm font-semibold text-muted">{text}</span>
      </span>
      {active && <CheckIcon size={18} className="mt-0.5 text-brand" />}
    </button>
  )
}

type Words = {
  label: string; plural: string; the: string; of: string; in: string
  /** o que cada papel deixa fazer (convites e colegas da empresa) */
  roles: Record<ShareRole, string>; org: Record<ShareRole, string>; who: string; linkText: string; defaultRole: ShareRole
}
const SAME = { roles: ROLE_TEXT, org: { edit: 'podem editar', view: 'só podem ver' }, who: 'Quem pode ver', defaultRole: 'edit' as ShareRole }
const W: Record<'quadro' | 'planilha' | 'diagrama' | 'inquerito', Words> = {
  quadro: { ...SAME, label: 'quadro', plural: 'quadros', the: 'o quadro', of: 'do quadro', in: 'o quadro em Quadros', linkText: 'Vê o quadro sem precisar de conta nem de código. Só quem convidares pode editar.' },
  planilha: { ...SAME, label: 'planilha', plural: 'planilhas', the: 'a planilha', of: 'da planilha', in: 'a planilha em Planilhas', linkText: 'Vê a planilha sem precisar de conta nem de código. Só quem convidares pode editar.' },
  diagrama: { ...SAME, label: 'diagrama', plural: 'diagramas', the: 'o diagrama', of: 'do diagrama', in: 'o diagrama em Diagramas', linkText: 'Vê o diagrama sem precisar de conta nem de código. Só quem convidares pode editar.' },
  inquerito: {
    label: 'inquérito', plural: 'inquéritos', the: 'o inquérito', of: 'do inquérito', in: 'o inquérito em Inquéritos', who: 'Quem pode responder',
    roles: { view: 'Pode responder', edit: 'Pode gerir' }, org: { view: 'respondem', edit: 'respondem e gerem' }, defaultRole: 'view',
    linkText: 'Responde sem precisar de conta. Só quem convidares para gerir vê as respostas de cada pessoa.',
  },
}

export default function ShareDialog({ endpoint, noun = 'quadro', isOrg, orgName, onClose, onChanged, extra }: {
  /** ex.: /api/quadros/<id>/share */
  endpoint: string
  noun?: 'quadro' | 'planilha' | 'diagrama' | 'inquerito'
  isOrg: boolean
  orgName?: string
  onClose: () => void
  onChanged: () => void
  /** opções próprias do tipo, logo a seguir ao link */
  extra?: ReactNode
}) {
  const { showToast } = useApp()
  const [state, setState] = useState<ShareState | null>(null)
  const [email, setEmail] = useState('')
  const w = W[noun]
  const [role, setRole] = useState<ShareRole>(w.defaultRole)
  const [password, setPassword] = useState('')
  const [editingPw, setEditingPw] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<ShareState>(endpoint).then(setState).catch(err => showToast(errorText(err, 'Não foi possível carregar as opções de partilha.'), 'danger'))
  }, [endpoint, showToast])

  const call = async (fn: () => Promise<ShareState>, ok?: string) => {
    setBusy(true)
    try {
      setState(await fn())
      onChanged()
      if (ok) showToast(ok, 'success')
      return true
    } catch (err) {
      showToast(errorText(err, 'Não foi possível guardar a partilha. Tenta outra vez.'), 'danger')
      return false
    } finally {
      setBusy(false)
    }
  }
  const patch = (body: Record<string, unknown>, ok?: string) => call(() => api<ShareState>(endpoint, { method: 'PATCH', body }), ok)
  const grant = (body: Record<string, unknown>, ok?: string) => call(() => api<ShareState>(endpoint, { body }), ok)
  const remove = (grantId: string) => call(() => api<ShareState>(`${endpoint}?grantId=${encodeURIComponent(grantId)}`, { method: 'DELETE' }))

  const s = state?.sharing
  const link = s?.token ? shareUrl(s.token) : ''
  const pending = state?.grants.filter(g => g.role === 'pending') ?? []
  const people = state?.grants.filter(g => g.role !== 'pending') ?? []
  const setVisibility = (v: ShareVisibility) => { if (s && s.visibility !== v) patch({ visibility: v }) }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      showToast('Link copiado', 'success')
    } catch {
      showToast('Não consegui copiar. Selecciona o link e copia à mão.', 'danger')
    }
  }

  return (
    <Modal title={`Partilhar ${w.label}`} onClose={onClose} wide>
      {!state || !s ? (
        <div role="status" aria-busy aria-label="A carregar" className="space-y-3">{[0, 1].map(i => <Sk key={i} className="h-16 rounded-2xl" />)}<Sk className="mt-4 h-11 rounded-xl" /><ListSkeleton rows={2} /></div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <p className="label">{w.who}</p>
            {isOrg ? (
              <>
                <Option active={s.visibility === 'org'} icon={<UsersThreeIcon size={22} />} title={`Toda a empresa${orgName ? ` (${orgName})` : ''}`}
                  text={`Todos os colegas vêem ${w.the} na lista de ${w.plural}.`} onClick={() => setVisibility('org')} />
                {s.visibility === 'org' && (
                  <div className="flex items-center gap-2 pl-11">
                    <span className="text-sm font-bold text-body">Os colegas</span>
                    <select className="input w-auto py-1.5 text-sm" value={s.orgRole ?? 'edit'} disabled={busy}
                      onChange={e => patch({ orgRole: e.target.value })}>
                      <option value="edit">{w.org.edit}</option>
                      <option value="view">{w.org.view}</option>
                    </select>
                  </div>
                )}
                <Option active={s.visibility === 'private'} icon={<LockIcon size={22} />} title="Privado"
                  text="Só tu, os administradores e as pessoas que convidares." onClick={() => setVisibility('private')} />
              </>
            ) : (
              <>
                <Option active={s.visibility === 'link'} icon={<GlobeIcon size={22} />} title="Qualquer pessoa com o link"
                  text={w.linkText} onClick={() => setVisibility('link')} />
                <Option active={s.visibility === 'private'} icon={<LockIcon size={22} />} title="Privado"
                  text="Só quem convidares, ou quem souber a senha (se definires uma). Os outros podem pedir acesso." onClick={() => setVisibility('private')} />
              </>
            )}
          </section>

          <section>
            <p className="label">Link {w.of}</p>
            <div className="flex gap-2">
              <input className="input py-2 text-sm" readOnly value={link} onFocus={e => e.target.select()} aria-label={`Link ${w.of}`} />
              <button onClick={copy} className="btn btn-ghost px-3 py-2" aria-label="Copiar link"><CopyIcon size={18} /></button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs font-bold text-muted">
              <span>
                {isOrg
                  ? s.visibility === 'org' ? 'Abre para os colegas com sessão iniciada.' : 'Abre só para quem tem acesso; os outros podem pedi-lo.'
                  : s.visibility === 'link' ? 'Qualquer pessoa com o link pode ver.' : s.hasPassword ? 'Pede a senha a quem não foi convidado.' : 'Quem não foi convidado pode pedir acesso.'}
              </span>
              <button disabled={busy} className="inline-flex items-center gap-1 underline hover:text-ink cursor-pointer"
                onClick={() => { if (confirm('Gerar um link novo? O link actual deixa de funcionar.')) patch({ resetLink: true }, 'Link novo criado') }}>
                <ArrowsClockwiseIcon size={13} /> Gerar novo link
              </button>
            </div>
          </section>

          {extra}

          {!isOrg && s.visibility === 'private' && (
            <section>
              <p className="label">Senha de acesso</p>
              {editingPw ? (
                <form className="flex gap-2" onSubmit={async e => {
                  e.preventDefault()
                  if (await patch({ password }, 'Senha guardada')) { setPassword(''); setEditingPw(false) }
                }}>
                  <input className="input py-2" type="password" autoComplete="new-password" placeholder="Pelo menos 4 caracteres" value={password}
                    minLength={4} maxLength={100} autoFocus onChange={e => setPassword(e.target.value)} />
                  <button className="btn btn-primary px-4 py-2 text-sm" disabled={busy || password.length < 4} aria-busy={busy}>Guardar</button>
                  <button type="button" className="rounded-xl px-2 text-sm font-extrabold text-muted hover:bg-snow cursor-pointer" onClick={() => setEditingPw(false)}>Cancelar</button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-body"><KeyIcon size={16} /> {s.hasPassword ? 'Com senha: quem a souber pode ver.' : 'Sem senha.'}</span>
                  <button className="chip py-1 text-xs" onClick={() => setEditingPw(true)}>{s.hasPassword ? 'Mudar senha' : 'Definir senha'}</button>
                  {s.hasPassword && <button className="chip py-1 text-xs text-danger" disabled={busy} onClick={() => patch({ password: null }, 'Senha removida')}>Remover</button>}
                </div>
              )}
            </section>
          )}

          <section>
            <p className="label">Convidar pessoas</p>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async e => {
              e.preventDefault()
              if (await grant({ email, role }, 'Convite enviado')) setEmail('')
            }}>
              <input className="input py-2" type="email" list="share-members" placeholder="email@exemplo.com" value={email}
                onChange={e => setEmail(e.target.value)} aria-label="Email a convidar" />
              {state.members.length > 0 && (
                <datalist id="share-members">
                  {state.members.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                </datalist>
              )}
              <select className="input py-2 sm:w-40" value={role} onChange={e => setRole(e.target.value as ShareRole)} aria-label="Permissão">
                <option value="edit">{w.roles.edit}</option>
                <option value="view">{w.roles.view}</option>
              </select>
              <button className="btn btn-primary py-2 text-sm" disabled={busy || !email.trim()} aria-busy={busy}>Convidar</button>
            </form>
            <p className="mt-1.5 text-xs font-semibold text-muted">Quem ainda não tem conta na Udacha cria-a com este email e encontra {w.in}.</p>
          </section>

          {pending.length > 0 && (
            <section>
              <p className="label">Pedidos de acesso</p>
              <ul className="space-y-2">
                {pending.map(g => (
                  <li key={g.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-gold/15 p-2.5">
                    <Avatar name={g.name ?? g.email} picture={g.picture} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{g.name ?? g.email}</span>
                      <span className="block truncate text-xs font-semibold text-muted">{g.email}</span>
                    </span>
                    <button className="chip py-1 text-xs" disabled={busy} onClick={() => grant({ grantId: g.id, role: 'view' }, 'Acesso dado')}>Dar &ldquo;{w.roles.view.replace('Pode ', '')}&rdquo;</button>
                    <button className="chip py-1 text-xs" disabled={busy} onClick={() => grant({ grantId: g.id, role: 'edit' }, 'Acesso dado')}>Dar &ldquo;{w.roles.edit.replace('Pode ', '')}&rdquo;</button>
                    <button className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-danger cursor-pointer" aria-label="Recusar" disabled={busy} onClick={() => remove(g.id)}>
                      <TrashIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="label">Pessoas com acesso</p>
            {people.length === 0 ? (
              <p className="text-sm font-semibold text-muted">Ainda não convidaste ninguém.</p>
            ) : (
              <ul className="divide-y-2 divide-line">
                {people.map(g => (
                  <li key={g.id} className="flex items-center gap-2 py-2">
                    <Avatar name={g.name ?? g.email} picture={g.picture} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{g.name ?? g.email}</span>
                      <span className="block truncate text-xs font-semibold text-muted">{g.name ? g.email : 'Ainda sem conta'}</span>
                    </span>
                    <select className="input w-auto py-1.5 text-sm" value={g.role} disabled={busy} aria-label={`Permissão de ${g.email}`}
                      onChange={e => grant({ grantId: g.id, role: e.target.value })}>
                      {(Object.keys(w.roles) as ShareRole[]).map(r => <option key={r} value={r}>{w.roles[r]}</option>)}
                    </select>
                    <button className="rounded-lg p-1.5 text-muted hover:bg-snow hover:text-danger cursor-pointer" aria-label={`Retirar acesso a ${g.email}`} disabled={busy} onClick={() => remove(g.id)}>
                      <TrashIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

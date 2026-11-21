'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwiseIcon, CaretLeftIcon, PaletteIcon, CopyIcon, DotsThreeIcon, EyeIcon, FloppyDiskIcon, GearSixIcon, GlobeIcon, ListBulletsIcon, LockIcon,
  PaperPlaneTiltIcon, PencilSimpleIcon, ShareNetworkIcon, SignOutIcon, StopCircleIcon, TableIcon, TrashIcon, UsersThreeIcon, ChartBarIcon, HandPointingIcon, CheckSquareOffsetIcon,
} from '@phosphor-icons/react'
import ShareDialog from '../../components/boards/ShareDialog'
import Popover, { MenuDivider, MenuItem } from '../../components/boards/Popover'
import Modal from '../../components/ui/Modal'
import Mascot from '../../components/ui/Mascot'
import Avatar from '../../components/ui/Avatar'
import { DetailSkeleton } from '../../components/ui/Skeleton'
import { Busy } from '../../components/ui/Spinner'
import { QuestionsEditor, SettingsEditor, Toggle, type Draft, type Person } from '../../components/polls/Builder'
import ThemeEditor from '../../components/polls/ThemeEditor'
import { RichInput, ThemedFrame, themeOf } from '../../components/polls/Theme'
import Participate, { PollIntro, type EntryActions } from '../../components/polls/Participate'
import Respond, { type Submit } from '../../components/polls/Respond'
import { submitBody } from '../../components/polls/submit'
import Results, { TurnoutCard } from '../../components/polls/Results'
import Responses, { ExportButtons } from '../../components/polls/Responses'
import StatusPill from '../../components/polls/StatusPill'
import { canEditAccess } from '../../components/polls/access'
import { useCan } from '../../components/layout/useCan'
import { TYPE_LOOK } from '../../components/polls/look'
import { api, ApiError, errorText } from '../../lib/api'
import { shareUrl } from '../../lib/boards'
import { POLL_LIMITS, TYPE_INFO, readyProblem } from '../../lib/polls'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import type { PollDetail, PollView } from '../../types'

type Tab = 'editar' | 'aspeto' | 'definicoes' | 'participar' | 'resultados' | 'respostas'

const draftOf = (p: PollView): Draft => ({ title: p.title, description: p.description ?? '', fields: p.fields, settings: p.settings, theme: themeOf(p) })

function Visibility({ poll, orgName }: { poll: PollView; orgName?: string }) {
  const v = poll.sharing.visibility
  const Icon = v === 'org' ? UsersThreeIcon : v === 'link' ? GlobeIcon : LockIcon
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body">
      <Icon size={14} /> {v === 'org' ? orgName ?? 'Empresa' : v === 'link' ? 'Público com link' : 'Só convidados'}
      {poll.settings.publicLink && v !== 'link' && <> · <GlobeIcon size={14} /> link aberto</>}
    </span>
  )
}

/** Na partilha: deixar (ou não) pessoas sem conta responder pelo link */
function GuestAccess({ d, onChange }: { d: PollDetail; onChange: (on: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const allowed = useCan('formulariosPublicos')
  const { poll } = d
  if (poll.type === 'election' || poll.type === 'ideas' || poll.type === 'contest') {
    return (
      <section>
        <p className="label">Pessoas sem conta</p>
        <p className="text-sm font-semibold text-muted">{poll.type === 'election' ? 'Nas eleições só vota quem tem conta: cada pessoa vota uma única vez.' : 'Para propor e votar é preciso ter conta na Udacha.'}</p>
      </section>
    )
  }
  const personalLink = !poll.orgId && poll.sharing.visibility === 'link'
  const on = poll.settings.publicLink || personalLink
  return (
    <section>
      <p className="label">Pessoas sem conta</p>
      <div className={`rounded-2xl border-2 p-1 ${on ? 'border-accent bg-accent-light/50' : 'border-line'}`}>
        <Toggle on={on} disabled={busy || personalLink || (!on && !!poll.orgId && !allowed)}
          onChange={async v => { setBusy(true); await onChange(v); setBusy(false) }}
          label={poll.type === 'form' ? 'Qualquer pessoa preenche pelo link, mesmo sem conta' : 'Qualquer pessoa responde pelo link, mesmo sem conta'}
          text={!on && !!poll.orgId && !allowed
            ? 'A tua empresa reservou esta opção a algumas pessoas. Fala com um administrador.'
            : personalLink
            ? 'Já está aberto: escolheste "Qualquer pessoa com o link".'
            : on
              ? poll.type !== 'form' && poll.settings.onePerPerson
                ? 'Como é "uma resposta por pessoa", quem não tem conta é convidado a entrar antes de responder.'
                : 'Envia o link acima a clientes ou a quem não tem conta. Não precisam de se registar.'
              : 'Desligado: só respondem as pessoas com acesso na Udacha.'} />
      </div>
      {on && d.phase === 'draft' && <p className="mt-1.5 text-xs font-bold text-gold-dark">O link só aceita respostas depois de publicares.</p>}
    </section>
  )
}

function PublishDialog({ d, onClose, onPublish }: { d: PollDetail; onClose: () => void; onPublish: (announce: boolean) => Promise<void> }) {
  const [announce, setAnnounce] = useState(true)
  const [busy, setBusy] = useState(false)
  const org = d.poll.orgId && d.poll.sharing.visibility === 'org'
  return (
    <Modal title="Publicar" onClose={onClose}
      footer={<button className="btn btn-primary w-full" disabled={busy} onClick={async () => { setBusy(true); await onPublish(!!org && announce).catch(() => undefined); setBusy(false) }}>
        <Busy busy={busy} text="A publicar…"><PaperPlaneTiltIcon size={18} /> Publicar agora</Busy></button>}>
      <div className="flex flex-col items-center text-center">
        <Mascot size={88} pose="wave" />
        <p className="mt-2 font-bold text-body">
          {org ? `Todos em ${d.orgName ?? 'na empresa'} passam a poder responder.` : d.poll.sharing.visibility === 'link' || d.poll.settings.publicLink ? 'Quem tiver o link passa a poder responder.' : 'Quem convidares passa a poder responder.'}
        </p>
      </div>
      {org && <div className="mt-4 rounded-2xl border-2 border-line p-1"><Toggle on={announce} onChange={setAnnounce} label="Avisar os colegas" text="Recebem uma notificação para responder." /></div>}
      {!org && (
        <p className="mt-4 rounded-2xl bg-snow p-3 text-sm font-semibold text-body">Depois de publicar, copia o link em <b>Partilhar</b> e envia-o a quem deve responder.</p>
      )}
    </Modal>
  )
}

export default function PollPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const org = useOrg()
  const { showToast } = useApp()
  const [d, setD] = useState<PollDetail | null>(null)
  const [error, setError] = useState<{ status: number; text: string } | null>(null)
  const [tab, setTab] = useState<Tab | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [share, setShare] = useState(() => typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('partilha'))
  const [menu, setMenu] = useState<DOMRect | null>(null)

  const first = useRef(true)
  const take = useCallback((next: PollDetail, resetDraft = false) => {
    setD(next)
    if (resetDraft) setDraft(draftOf(next.poll))
  }, [])

  const load = useCallback(async () => {
    try {
      const next = await api<PollDetail>(`/api/inqueritos/${id}`)
      if (first.current) {
        // primeira vez: escolhe o separador
        first.current = false
        const asked = new URLSearchParams(window.location.search).get('ver')
        const manager = canEditAccess(next.access)
        setTab(asked === 'respostas' && manager ? 'respostas' : next.phase === 'draft' && manager ? 'editar' : 'participar')
        setDraft(draftOf(next.poll))
      }
      setD(next)
      setError(null)
    } catch (err) {
      setError({ status: err instanceof ApiError ? err.status : 0, text: errorText(err, 'Não foi possível abrir o inquérito.') })
    }
  }, [id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregar do servidor
    load()
  }, [load])

  const dirty = useMemo(() => !!d && !!draft && JSON.stringify(draftOf(d.poll)) !== JSON.stringify(draft), [d, draft])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // colegas (candidatos e júri), só nos inquéritos desta empresa
  const pollOrg = d?.poll.orgId
  const people: Person[] = useMemo(() => {
    if (!org || !pollOrg || pollOrg !== org.org.id) return []
    return org.members.filter(m => m.status === 'activo' && m.userId).map(m => ({ userId: m.userId!, name: m.name, picture: m.picture }))
  }, [org, pollOrg])

  if (error && !d) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <Mascot size={100} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">{error.status === 403 ? 'Sem acesso' : error.status === 404 ? 'Inquérito não encontrado' : 'Algo correu mal'}</h1>
        <p className="mt-1 max-w-sm font-semibold text-muted">{error.text}</p>
        <Link href="/inqueritos" className="btn btn-primary mt-6">Ver os inquéritos</Link>
      </div>
    )
  }
  if (!d || !draft || !tab) return <div className="px-4 pt-5 lg:px-0"><DetailSkeleton /></div>

  const { poll, access, phase } = d
  const manager = canEditAccess(access)
  const look = TYPE_LOOK[poll.type]
  const entriesType = poll.type === 'ideas' || poll.type === 'contest'

  const patch = async (body: Record<string, unknown>, ok?: string) => {
    const next = await api<PollDetail>(`/api/inqueritos/${id}`, { method: 'PATCH', body })
    // só repõe o rascunho quando o que mudou foi o conteúdo (fechar ou reabrir não apaga o que está por guardar)
    take(next, 'fields' in body || 'title' in body || !dirty)
    if (ok) showToast(ok, 'success')
    return next
  }
  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    try { await fn() } catch (err) { showToast(errorText(err, fallback), 'danger') }
  }
  const save = async () => {
    setSaving(true)
    await run(() => patch({ title: draft.title, description: draft.description, fields: draft.fields, settings: draft.settings, theme: draft.theme }, 'Alterações guardadas'), 'Não foi possível guardar. Tenta outra vez.')
    setSaving(false)
  }
  const publish = async (announce: boolean) => {
    try {
      if (dirty) await api(`/api/inqueritos/${id}`, { method: 'PATCH', body: { title: draft.title, description: draft.description, fields: draft.fields, settings: draft.settings, theme: draft.theme } })
      await patch({ status: 'open', announce }, 'Publicado! Já pode receber respostas.')
      setPublishing(false)
      setTab('participar')
    } catch (err) {
      showToast(errorText(err, 'Não foi possível publicar.'), 'danger')
    }
  }
  const tryPublish = () => {
    const problem = !draft.title.trim() ? 'Dá um nome ao inquérito' : readyProblem(poll.type, draft.fields)
    if (problem) { showToast(problem, 'danger'); setTab('editar'); return }
    setPublishing(true)
  }

  const upload = async (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return (await api<{ id: string }>(`/api/inqueritos/${id}/imagens`, { form })).id
  }
  const submit = async (s: Submit) => {
    const next = await api<PollDetail>(`/api/inqueritos/${id}/respostas`, submitBody(s))
    take(next)
  }
  const withdraw = async () => run(async () => take(await api<PollDetail>(`/api/inqueritos/${id}/respostas`, { method: 'DELETE' })), 'Não foi possível retirar a resposta.')
  const entry: EntryActions = {
    add: async (text, details, s) => {
      const payload = s ? submitBody(s) : { body: {} }
      if ('form' in payload && payload.form) {
        const data = JSON.parse(String(payload.form.get('data')))
        payload.form.set('data', JSON.stringify({ ...data, text, details }))
      } else (payload as { body: Record<string, unknown> }).body = { ...(s ? { answers: s.answers, other: s.other } : {}), text, details }
      take(await api<PollDetail>(`/api/inqueritos/${id}/entradas`, payload))
      showToast(poll.type === 'ideas' ? 'Ideia enviada' : 'Candidatura enviada', 'success')
    },
    vote: (entryId, vote) => run(async () => take(await api<PollDetail>(`/api/inqueritos/${id}/entradas`, { method: 'PATCH', body: { entryId, vote } })), 'Não foi possível votar.'),
    manage: (entryId, p) => run(async () => take(await api<PollDetail>(`/api/inqueritos/${id}/entradas`, { method: 'PATCH', body: { entryId, ...p } })), 'Não foi possível alterar.'),
    remove: entryId => run(async () => take(await api<PollDetail>(`/api/inqueritos/${id}/entradas?entryId=${entryId}`, { method: 'DELETE' })), 'Não foi possível apagar.'),
  }
  const remind = async () => {
    try {
      const r = await api<{ reminded: number }>(`/api/inqueritos/${id}/lembrar`, { method: 'POST' })
      showToast(r.reminded ? `Avisámos ${r.reminded} ${r.reminded === 1 ? 'pessoa' : 'pessoas'}` : 'Já responderam todos', 'success')
    } catch (err) { showToast(errorText(err, 'Não foi possível avisar.'), 'danger') }
  }
  const copyLink = async () => {
    if (!poll.sharing.token) return
    try { await navigator.clipboard.writeText(shareUrl(poll.sharing.token)); showToast('Link copiado', 'success') } catch { showToast('Não consegui copiar o link.', 'danger') }
  }
  const remove = async () => {
    if (!confirm(`Apagar "${poll.title}" e todas as respostas? Não dá para desfazer.`)) return
    await run(async () => {
      await api(`/api/inqueritos/${id}`, { method: 'DELETE' })
      showToast('Inquérito apagado', 'success')
      router.replace('/inqueritos')
    }, 'Não foi possível apagar o inquérito.')
  }
  const leave = async () => {
    if (!confirm('Sair deste inquérito? Deixas de o ver até alguém te convidar outra vez.')) return
    await run(async () => { await api(`/api/inqueritos/${id}/share`, { method: 'DELETE' }); router.replace('/inqueritos') }, 'Não foi possível sair.')
  }

  const tabs: { id: Tab; label: string; icon: typeof EyeIcon }[] = manager
    ? [
        { id: 'editar', label: poll.type === 'election' ? 'Cargos' : poll.type === 'schedule' ? 'Datas' : poll.type === 'ideas' ? 'Tema' : 'Perguntas', icon: PencilSimpleIcon },
        { id: 'aspeto', label: 'Aspeto', icon: PaletteIcon },
        { id: 'definicoes', label: 'Definições', icon: GearSixIcon },
        { id: 'participar', label: phase === 'draft' ? 'Pré-visualizar' : entriesType ? (poll.type === 'ideas' ? 'Ideias' : 'Candidaturas') : 'Responder', icon: phase === 'draft' ? EyeIcon : HandPointingIcon },
        ...(!entriesType ? [{ id: 'resultados' as Tab, label: 'Resultados', icon: ChartBarIcon }, { id: 'respostas' as Tab, label: 'Respostas', icon: ListBulletsIcon }] : []),
      ]
    : []

  return (
    <div className="px-4 pb-10 pt-4 lg:px-0 lg:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/inqueritos" aria-label="Voltar aos inquéritos" className="rounded-xl p-2 text-muted hover:bg-snow"><CaretLeftIcon size={20} /></Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: look.light, color: look.color }}><look.icon size={22} weight="duotone" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-black text-ink sm:text-2xl">{poll.title}</h1>
            <StatusPill status={phase} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted">
            {TYPE_INFO[poll.type].name}
            {poll.type === 'contest' && phase === 'open' && <> · <span className="font-extrabold text-pink-dark">Fase de {poll.settings.phase === 'vote' ? 'votação' : 'candidaturas'}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden -space-x-2 md:flex">
            {d.people.slice(0, 4).map(p => <span key={p.userId} title={p.name} className="rounded-full ring-2 ring-white"><Avatar name={p.name} picture={p.picture} size={28} /></span>)}
          </span>
          {manager && dirty && (
            <button onClick={save} disabled={saving} className="btn btn-accent px-3 py-2 text-xs tut-pop"><Busy busy={saving} text="A guardar…"><FloppyDiskIcon size={16} /> Guardar</Busy></button>
          )}
          {manager && phase === 'draft' && <button onClick={tryPublish} className="btn btn-primary px-3 py-2 text-xs"><PaperPlaneTiltIcon size={16} /> Publicar</button>}
          {manager && poll.type === 'contest' && phase === 'open' && poll.settings.phase !== 'vote' && (
            <button className="btn btn-primary px-3 py-2 text-xs" onClick={() => { if (confirm('Fechar as candidaturas e abrir a votação?')) run(() => patch({ settings: { phase: 'vote' } }, 'A votação começou!'), 'Não foi possível mudar de fase.') }}>
              <CheckSquareOffsetIcon size={16} /> Abrir votação
            </button>
          )}
          {access === 'owner' && (
            <button onClick={() => setShare(true)} className="btn btn-ghost relative px-3 py-2 text-xs">
              <ShareNetworkIcon size={16} /> <span className="max-sm:hidden">Partilhar</span>
              {d.requests > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 text-[11px] font-black text-white">{d.requests}</span>}
            </button>
          )}
          <button onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} aria-label="Menu do inquérito" className="rounded-xl p-2 text-muted hover:bg-snow cursor-pointer"><DotsThreeIcon size={22} weight="bold" /></button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Visibility poll={poll} orgName={d.orgName} />
        {poll.settings.anonymous && <span className="inline-flex items-center gap-1 rounded-lg bg-snow px-2 py-1 text-xs font-extrabold text-body"><EyeIcon size={14} /> {poll.type === 'election' ? 'Voto secreto' : 'Anónimo'}</span>}
        {manager && <span className="text-xs font-bold text-muted">{poll.count === 1 ? '1 resposta' : `${poll.count} respostas`}</span>}
      </div>

      {tabs.length > 0 && (
        <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b-2 border-line px-4 lg:mx-0 lg:px-0" aria-label="Secções">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`-mb-0.5 inline-flex shrink-0 items-center gap-1.5 border-b-[3px] px-3 py-2 text-sm font-extrabold transition-colors cursor-pointer ${tab === t.id ? 'text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              style={tab === t.id ? { borderColor: look.color } : undefined}>
              <t.icon size={17} weight={tab === t.id ? 'fill' : 'bold'} /> {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className={`mx-auto ${tab === 'aspeto' ? 'max-w-5xl' : tab === 'participar' ? 'max-w-3xl' : 'max-w-2xl'}`}>
        {tab === 'editar' && manager && (
          <div className="space-y-4">
            {poll.count > 0 && <p className="rounded-2xl bg-gold/15 p-3 text-sm font-bold text-gold-dark">Já há respostas. Mudar ou apagar perguntas pode baralhar os resultados.</p>}
            <div className="rounded-3xl border-2 border-line p-4">
              <label className="label" htmlFor="poll-name">Nome</label>
              <input id="poll-name" className="input text-lg font-black" maxLength={POLL_LIMITS.title} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <label className="label mt-3">Descrição <span className="font-semibold normal-case text-muted">(opcional)</span></label>
              <RichInput value={draft.description} max={POLL_LIMITS.description} rows={3} label="Descrição" placeholder="Explica o objectivo e as regras. Usa os botões para negrito, itálico, sublinhado e links."
                onChange={description => setDraft({ ...draft, description })} />
            </div>
            <QuestionsEditor type={poll.type} fields={draft.fields} people={people} pollId={poll.id} onUpload={upload} onChange={fields => setDraft({ ...draft, fields })} />
          </div>
        )}

        {tab === 'aspeto' && manager && (
          <ThemeEditor poll={{ ...poll, ...draft, description: draft.description || undefined }} theme={draft.theme} onUpload={upload} onChange={theme => setDraft({ ...draft, theme })} />
        )}

        {tab === 'definicoes' && manager && (
          <SettingsEditor type={poll.type} settings={draft.settings} hasAnswers={poll.count > 0} isOrg={!!poll.orgId} people={people}
            onChange={settings => setDraft({ ...draft, settings })} />
        )}

        {tab === 'participar' && (
          <>
            {phase === 'draft' ? (
              <>
                <p className="mb-4 rounded-2xl bg-brand-light p-3 text-sm font-bold text-brand-dark">Pré-visualização: é assim que as pessoas vão ver. As respostas aqui não são enviadas.</p>
                <ThemedFrame poll={{ ...poll, ...draft }} intro={<PollIntro d={{ ...d, poll: { ...poll, ...draft, description: draft.description || undefined } }} />}>
                  {entriesType
                    ? <p className="rounded-3xl bg-white p-6 text-center font-bold text-muted">Depois de publicar, as pessoas {poll.type === 'ideas' ? 'propõem ideias' : 'enviam candidaturas'} e votam aqui.</p>
                    : <Respond poll={{ ...poll, ...draft }} candidates={d.candidates} preview onSubmit={async () => undefined} />}
                </ThemedFrame>
              </>
            ) : (
              <>
                <ThemedFrame poll={poll} intro={<PollIntro d={d} />}>
                  <Participate d={d} onSubmit={submit} onWithdraw={withdraw} entry={entry} />
                </ThemedFrame>
              </>
            )}
          </>
        )}

        {tab === 'resultados' && manager && (
          <div className="space-y-4">
            {d.turnout && <TurnoutCard t={d.turnout} canRemind={phase === 'open'} onRemind={remind} />}
            {d.results && d.results.total > 0
              ? <Results poll={poll} results={d.results} candidates={d.candidates} manager />
              : <p className="rounded-3xl bg-snow p-6 text-center font-bold text-muted">{phase === 'draft' ? 'Publica o inquérito para começar a receber respostas.' : 'Ainda sem respostas.'}</p>}
          </div>
        )}

        {tab === 'respostas' && manager && <Responses poll={poll} onChanged={load} />}

        {manager && entriesType && tab === 'participar' && phase !== 'draft' && d.entries.length > 0 && (
          <div className="mt-6 flex justify-end"><ExportButtons poll={poll} /></div>
        )}
      </div>

      {menu && (
        <Popover anchor={menu} title="Menu" onClose={() => setMenu(null)} width={280}>
          {access === 'owner' && <MenuItem icon={<ShareNetworkIcon size={18} />} onClick={() => { setMenu(null); setShare(true) }}>Partilhar</MenuItem>}
          {poll.sharing.token && <MenuItem icon={<CopyIcon size={18} />} onClick={() => { setMenu(null); copyLink() }}>Copiar link</MenuItem>}
          {manager && phase !== 'draft' && (
            <MenuItem icon={<TableIcon size={18} />} onClick={async () => {
              setMenu(null)
              await run(async () => { const { id: sheet } = await api<{ id: string }>(`/api/inqueritos/${id}/exportar`, { method: 'POST' }); router.push(`/planilhas/${sheet}`) }, 'Não foi possível criar a planilha.')
            }}>Abrir respostas em Planilha</MenuItem>
          )}
          {manager && phase === 'open' && (
            <MenuItem icon={<StopCircleIcon size={18} />} onClick={() => { setMenu(null); if (confirm('Fechar agora? Deixa de receber respostas.')) run(() => patch({ status: 'closed' }, 'Inquérito fechado'), 'Não foi possível fechar.') }}>Fechar agora</MenuItem>
          )}
          {manager && phase === 'closed' && (
            <MenuItem icon={<ArrowCounterClockwiseIcon size={18} />} onClick={() => { setMenu(null); run(() => patch({ status: 'open' }, 'Inquérito reaberto'), 'Não foi possível reabrir.') }}>Reabrir</MenuItem>
          )}
          {manager && phase === 'open' && poll.count === 0 && (
            <MenuItem icon={<PencilSimpleIcon size={18} />} onClick={() => { setMenu(null); run(async () => { await patch({ status: 'draft' }); setTab('editar') }, 'Não foi possível voltar a rascunho.') }}>Voltar a rascunho</MenuItem>
          )}
          {access !== 'owner' && poll.sharing.visibility !== 'org' && (<><MenuDivider /><MenuItem icon={<SignOutIcon size={18} />} onClick={() => { setMenu(null); leave() }}>Sair do inquérito</MenuItem></>)}
          {access === 'owner' && (<><MenuDivider /><MenuItem danger icon={<TrashIcon size={18} />} onClick={() => { setMenu(null); remove() }}>Apagar inquérito</MenuItem></>)}
        </Popover>
      )}

      {publishing && <PublishDialog d={d} onClose={() => setPublishing(false)} onPublish={publish} />}
      {share && (
        <ShareDialog endpoint={`/api/inqueritos/${id}/share`} noun="inquerito" isOrg={!!poll.orgId} orgName={d.orgName} onClose={() => setShare(false)} onChanged={load}
          extra={<GuestAccess d={d} onChange={on => run(() => patch({ settings: { publicLink: on } }, on ? 'Já podem responder sem conta' : 'Só quem tem acesso responde'), 'Não foi possível mudar.')} />} />
      )}
    </div>
  )
}

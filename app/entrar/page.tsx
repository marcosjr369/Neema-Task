'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftIcon, BuildingsIcon, CheckIcon, CoffeeIcon, FireIcon, KeyIcon, LightningIcon, ListChecksIcon,
  PlantIcon, PlusCircleIcon, ShieldCheckIcon, SparkleIcon, TimerIcon, TrophyIcon, UserIcon, UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useAccount } from '../context/AccountContext'
import { errorText } from '../lib/api'
import { ORG_SIZES, SECTORS } from '../lib/org'
import Mascot from '../components/ui/Mascot'
import Confetti from '../components/ui/Confetti'
import { SignIn } from '@clerk/nextjs'
import { CLERK_APPEARANCE } from '../components/account/clerkAppearance'

/*
 * Entrada e criação de conta, em passos curtos:
 *   olá → como funciona → login → tipo de uso → (pessoal: meta diária | empresa: criar / código) → pronto
 * Quem já tem conta e espaço escolhido vai directo para a app.
 */

type Step = 'ola' | 'como' | 'login' | 'tipo' | 'meta' | 'empresa' | 'criar' | 'codigo' | 'pronto'
type Done = { kind: 'personal' } | { kind: 'created'; code: string; name: string } | { kind: 'joined'; name: string }

const PROGRESS: Record<Step, number> = { ola: 0.04, como: 0.18, login: 0.34, tipo: 0.5, meta: 0.72, empresa: 0.66, criar: 0.84, codigo: 0.84, pronto: 1 }
const PUBLIC_DOMAINS = ['gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'sapo.pt']

const GOALS = [
  { minutes: 15, label: 'Leve', desc: '15 min por dia', icon: PlantIcon, color: '#12B5A6' },
  { minutes: 30, label: 'Regular', desc: '30 min por dia', icon: CoffeeIcon, color: '#4C7DFF' },
  { minutes: 60, label: 'Sério', desc: '1 hora por dia', icon: FireIcon, color: '#FF8A3D' },
  { minutes: 120, label: 'Intenso', desc: '2 horas por dia', icon: LightningIcon, color: '#7B61FF' },
]

// ─── Peças visuais ─────────────────────────────────────────────────────────

/** Escreve o texto letra a letra; devolve o texto visível e se já acabou */
function useTypewriter(text: string, speed = 24) {
  const [count, setCount] = useState(0)
  const [prev, setPrev] = useState(text)
  if (prev !== text) {
    setPrev(text)
    setCount(0)
  }
  useEffect(() => {
    if (count >= text.length) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setCount(reduce ? text.length : count + 1), speed)
    return () => clearTimeout(id)
  }, [count, text, speed])
  return { shown: text.slice(0, count), done: count >= text.length }
}

/** Mascote com balão de fala: mexe a boca enquanto escreve e salta ao mudar de passo */
function Speaker({
  text, mood = 'happy', size = 110, hopKey, wave = false, bounce = false,
}: { text: string; mood?: 'happy' | 'excited' | 'sad' | 'thinking'; size?: number; hopKey: string; wave?: boolean; bounce?: boolean }) {
  const { shown, done } = useTypewriter(text)
  return (
    <div className="flex items-end justify-center gap-3">
      <div key={hopKey} className={`shrink-0 ${mood === 'sad' ? 'animate-shake' : 'animate-hop'}`}>
        <Mascot size={size} mood={mood} animated={!bounce} bounce={bounce} wave={wave && done} talking={!done} />
      </div>
      <div key={`b-${hopKey}`} className="relative mb-8 min-h-12 max-w-sm flex-1 rounded-2xl border-2 border-line bg-white px-4 py-3 text-[17px] font-bold leading-snug text-ink animate-bubble">
        <span className={done ? '' : 'typing-caret'}>{shown}</span>
        {/* reserva o espaço do texto completo para o balão não "saltar" */}
        <span className="invisible block h-0 overflow-hidden" aria-hidden>{text}</span>
        <span className="absolute -left-2 bottom-4 h-3.5 w-3.5 rotate-45 border-b-2 border-l-2 border-line bg-white" />
        <span className="sr-only" aria-live="polite">{text}</span>
      </div>
    </div>
  )
}

/** Opção grande, seleccionável (cartão 3D que afunda ao carregar) */
function Choice({
  icon: IconCmp, color, title, desc, selected, onClick, delay = 0,
}: { icon: Icon; color: string; title: string; desc: string; selected?: boolean; onClick: () => void; delay?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex w-full items-center gap-4 rounded-2xl border-2 border-b-4 p-4 text-left transition-[transform,background,border-color] duration-100 active:translate-y-[2px] active:border-b-2 animate-rise cursor-pointer ${
        selected ? 'border-brand bg-brand-light' : 'border-line bg-white hover:bg-snow'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:-rotate-6 group-hover:scale-110"
        style={{ background: `${color}1f`, color }}
      >
        <IconCmp size={30} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-lg font-black ${selected ? 'text-brand-dark' : 'text-ink'}`}>{title}</span>
        <span className="block text-sm font-semibold text-muted">{desc}</span>
      </span>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected ? 'border-brand bg-brand text-white' : 'border-line text-transparent'}`}>
        <CheckIcon size={14} weight="bold" />
      </span>
    </button>
  )
}

/** Ícones a flutuar à volta da mascote no ecrã de boas-vindas */
function FloatingIcons() {
  const items: { icon: Icon; color: string; pos: string; delay: number; r: number }[] = [
    { icon: ListChecksIcon, color: '#12B5A6', pos: 'left-[6%] top-[8%]', delay: 0, r: -10 },
    { icon: TimerIcon, color: '#F2545B', pos: 'right-[8%] top-[4%]', delay: 0.6, r: 8 },
    { icon: TrophyIcon, color: '#E0A419', pos: 'right-[2%] top-[52%]', delay: 1.2, r: 12 },
    { icon: FireIcon, color: '#FF8A3D', pos: 'left-[2%] top-[58%]', delay: 0.9, r: -8 },
    { icon: LightningIcon, color: '#7B61FF', pos: 'left-[30%] -top-[4%]', delay: 1.6, r: 6 },
    { icon: CoffeeIcon, color: '#4C7DFF', pos: 'right-[30%] bottom-0', delay: 0.3, r: -6 },
  ]
  return (
    <>
      {items.map(({ icon: I, color, pos, delay, r }, i) => (
        <span
          key={i}
          className={`absolute ${pos} flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_4px_0_#E9E7F2] animate-float`}
          style={{ animationDelay: `${delay}s`, color, ['--r' as string]: `${r}deg` }}
        >
          <I size={26} weight="duotone" />
        </span>
      ))}
    </>
  )
}

/** Formas suaves a flutuar no fundo */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden>
      <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-2xl animate-blob" />
      <span className="absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-accent/10 blur-2xl animate-blob" style={{ animationDelay: '-4s' }} />
      <span className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-gold/15 blur-2xl animate-blob" style={{ animationDelay: '-8s' }} />
    </div>
  )
}

const TITLE = 'marcos tasks'

/** Primeiro ecrã: o Marcos a saltar e a acenar, ícones à volta e o título a entrar letra a letra */
function Welcome({ className }: { className: string }) {
  const { shown, done } = useTypewriter('Olá! Eu sou o Marcos!', 45)
  return (
    <div className={`my-auto flex flex-col items-center text-center ${className}`}>
      <div className="relative flex h-80 w-full max-w-sm items-end justify-center pb-4">
        <FloatingIcons />
        {/* balão por cima da mascote */}
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2">
          <div className="relative whitespace-nowrap rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-lg font-black text-ink shadow-[0_4px_0_#E9E7F2] animate-bubble" style={{ animationDelay: '300ms', transformOrigin: 'bottom center' }}>
            <span className={done ? '' : 'typing-caret'}>{shown || '\u00a0'}</span>
            <span className="absolute -bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-line bg-white" />
          </div>
        </div>
        <div className="animate-hop">
          <Mascot size={200} mood={done ? 'happy' : 'excited'} animated wave talking={!done} />
        </div>
      </div>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-brand sm:text-5xl" aria-label={TITLE}>
        {TITLE.split('').map((ch, i) => (
          <span key={i} className="animate-letter" style={{ animationDelay: `${500 + i * 55}ms` }} aria-hidden>
            {ch === ' ' ? '\u00a0' : ch}
          </span>
        ))}
      </h1>
      <p className="mt-3 max-w-xs text-lg font-semibold text-muted animate-rise" style={{ animationDelay: '1.2s' }}>
        Foca no que importa, faz pausas a tempo e vê o teu progresso, sozinho ou em equipa.
      </p>
    </div>
  )
}

function Field({ label, hint, delay, children }: { label: string; hint?: string; delay: number; children: ReactNode }) {
  return (
    <div className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs font-semibold text-muted">{hint}</p>}
    </div>
  )
}

/** Lista "o que fazer a seguir" do último passo */
function NextSteps({ done, goal }: { done: Done; goal: number | null }) {
  const items: { icon: Icon; color: string; text: ReactNode }[] =
    done.kind === 'created'
      ? [
          { icon: UsersThreeIcon, color: '#12B5A6', text: <>Convida a equipa com o código <b className="font-mono tracking-widest text-ink">{done.code}</b></> },
          { icon: BuildingsIcon, color: '#4C7DFF', text: 'Organiza departamentos e escolhe supervisores' },
          { icon: ListChecksIcon, color: '#7B61FF', text: 'Atribui tarefas e aprova o trabalho entregue' },
        ]
      : done.kind === 'joined'
        ? [
            { icon: ListChecksIcon, color: '#12B5A6', text: 'Vê as tarefas que te atribuírem' },
            { icon: TimerIcon, color: '#F2545B', text: 'Liga o cronómetro e marca o teu estado' },
            { icon: ShieldCheckIcon, color: '#7B61FF', text: 'Anexa provas e envia para revisão' },
          ]
        : [
            { icon: PlusCircleIcon, color: '#12B5A6', text: 'Cria a tua primeira tarefa' },
            { icon: TimerIcon, color: '#F2545B', text: `Foca ${goal ?? 30} min por dia para cumprir a meta` },
            { icon: TrophyIcon, color: '#E0A419', text: 'Ganha XP e sobe no ranking' },
          ]
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl border-2 border-line p-3 animate-rise" style={{ animationDelay: `${400 + i * 200}ms` }}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${item.color}1f`, color: item.color }}>
            <item.icon size={24} weight="duotone" />
          </span>
          <span className="font-bold text-body">{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────

export default function EnterPage() {
  const router = useRouter()
  const account = useAccount()
  const { user, suggestions } = account
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const inviteCode = params.get('codigo') ?? ''
  const forced = !!params.get('passo')

  const [stack, setStack] = useState<Step[]>(() => {
    if (!user) {
      // vindo da landing: "Começar agora" → como funciona; "Já tenho conta" → login
      if (inviteCode || window.location.hash.startsWith('#/') || params.get('passo') === 'login') return ['login']
      if (params.get('passo') === 'como') return ['como']
      return ['ola']
    }
    if (inviteCode) return ['codigo']
    if (params.get('passo') === 'empresa') return ['empresa']
    return ['tipo']
  })
  const [dir, setDir] = useState<'right' | 'left'>('right')
  const step = stack[stack.length - 1]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorKey, setErrorKey] = useState(0)
  const [done, setDone] = useState<Done | null>(null)

  // escolhas
  const [use, setUse] = useState<'personal' | 'org' | null>(null)
  const [goal, setGoal] = useState<number | null>(null)
  const [orgPath, setOrgPath] = useState<'criar' | 'codigo' | null>(null)
  const [orgName, setOrgName] = useState('')
  const [sector, setSector] = useState('')
  const [size, setSize] = useState('')
  const [departments, setDepartments] = useState('')
  const [code, setCode] = useState(inviteCode)

  const go = (s: Step) => {
    setDir('right')
    setError('')
    setStack(st => [...st, s])
  }
  const back = () => {
    // primeiro passo sem sessão: volta à página de apresentação
    if (stack.length <= 1) {
      if (!user) router.push('/')
      return
    }
    setDir('left')
    setError('')
    setStack(st => (st.length > 1 ? st.slice(0, -1) : st))
  }

  // Quem volta do Google (ou abre /entrar) já com a app configurada segue directo para dentro
  const routed = useRef(false)
  useEffect(() => {
    if (routed.current || !user?.workspace || forced || inviteCode || stack.length !== 1 || step !== 'tipo') return
    routed.current = true
    router.replace('/')
  }, [user, step, stack.length, inviteCode, forced, router])

  // Depois do login no Clerk (a conta chega pelo AccountContext):
  // convite → código; conta já usada → app; conta nova → escolher o tipo
  useEffect(() => {
    if (step !== 'login' || !user) return
    if (user.workspace && !inviteCode) {
      router.replace('/')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avança quando o login no Clerk termina
    go(inviteCode ? 'codigo' : 'tipo')
  }, [step, user, inviteCode, router])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(errorText(err))
      setErrorKey(k => k + 1)
    }
    setBusy(false)
  }

  const first = user?.name.split(' ')[0] ?? ''
  const emailDomain = user?.email.split('@')[1] ?? ''

  // ─── O que o Marcos diz em cada passo ──────────────────────────────────────
  const speech: Record<Step, string> = {
    ola: 'Olá! Eu sou o Marcos.',
    como: 'É simples. Vê como funciona:',
    login: inviteCode ? 'Recebeste um convite! Entra para te juntares à equipa.' : 'Vamos criar a tua conta. Leva só um segundo!',
    tipo: `Bem-vindo, ${first}! Como vais usar a app?`,
    meta: 'Quanto tempo queres focar por dia?',
    empresa: 'Boa! Vais criar a empresa ou juntar-te a uma?',
    criar: 'Conta-me um pouco sobre a empresa.',
    codigo: 'Escreve o código que o teu supervisor te deu.',
    pronto:
      done?.kind === 'created' ? `A ${done.name} está pronta!` : done?.kind === 'joined' ? `Entraste na ${done.name}!` : 'Tudo pronto! Vamos a isso?',
  }
  const mood = error ? 'sad' : step === 'pronto' ? 'excited' : step === 'criar' || step === 'codigo' ? 'thinking' : 'happy'

  // ─── Botão principal de cada passo ──────────────────────────────────────
  let primary: { label: string; onClick?: () => void; form?: string; disabled?: boolean } | null = null
  let secondary: { label: string; onClick: () => void } | null = null
  if (step === 'ola') {
    primary = { label: 'Começar', onClick: () => go('como') }
    secondary = { label: 'Já tenho conta', onClick: () => go('login') }
  }
  else if (step === 'como') primary = { label: 'Continuar', onClick: () => go('login') }
  else if (step === 'tipo') primary = { label: 'Continuar', disabled: !use, onClick: () => go(use === 'org' ? 'empresa' : 'meta') }
  else if (step === 'meta') {
    primary = {
      label: 'Continuar',
      disabled: !goal,
      onClick: () => {
        account.updateSettings({ dailyGoalMinutes: goal! })
        account.setWorkspace({ kind: 'personal' })
        setDone({ kind: 'personal' })
        go('pronto')
      },
    }
  } else if (step === 'empresa') primary = { label: 'Continuar', disabled: !orgPath, onClick: () => go(orgPath!) }
  else if (step === 'criar') primary = { label: busy ? 'A criar…' : 'Criar empresa', form: 'f-criar', disabled: busy || !orgName.trim() }
  else if (step === 'codigo') primary = { label: busy ? 'A entrar…' : 'Entrar na equipa', form: 'f-codigo', disabled: busy || code.trim().length < 4 }
  else if (step === 'pronto') {
    primary = { label: 'Vamos lá!', onClick: () => router.replace(done?.kind === 'created' ? '/empresa?tab=pessoas' : '/') }
  }

  const animation = dir === 'right' ? 'animate-step-right' : 'animate-step-left'

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-white">
      <Backdrop />
      {step === 'pronto' && <Confetti />}

      {/* Topo: voltar + barra de progresso */}
      <header className="relative mx-auto flex w-full max-w-xl items-center gap-4 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <button
          onClick={back}
          disabled={step === 'pronto' || (stack.length <= 1 && !!user)}
          aria-label="Voltar"
          className="rounded-xl p-1 text-muted transition-opacity hover:text-body disabled:opacity-0 cursor-pointer"
        >
          <ArrowLeftIcon size={26} />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(PROGRESS[step] * 100)}>
          <div className="relative h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${PROGRESS[step] * 100}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </header>

      <main className={`relative mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-6 ${secondary ? 'pb-48' : 'pb-36'}`}>
        {step === 'ola' ? (
          // ─── Boas-vindas ──────────────────────────────────────────────────
          <Welcome key="ola" className={animation} />
        ) : (
          <div key={step} className={`my-auto ${animation}`}>
            <Speaker
              text={error || speech[step]}
              mood={mood}
              hopKey={`${step}-${errorKey}`}
              size={step === 'pronto' ? 140 : 110}
              wave={step === 'login' || step === 'tipo'}
              bounce={step === 'pronto' && !error}
            />

            <div className="mt-6 space-y-3">
              {step === 'como' &&
                [
                  { icon: ListChecksIcon, color: '#12B5A6', title: 'Cria as tuas tarefas', desc: 'Trabalho, estudo, pessoal… com prazo e prioridade.' },
                  { icon: TimerIcon, color: '#F2545B', title: 'Liga o cronómetro', desc: 'Eu aviso-te quando for hora de fazer uma pausa.' },
                  { icon: TrophyIcon, color: '#E0A419', title: 'Ganha XP e sobe no ranking', desc: 'Cada minuto de foco e cada tarefa contam.' },
                  { icon: UsersThreeIcon, color: '#4C7DFF', title: 'Ou usa com a tua equipa', desc: 'Supervisores atribuem tarefas e aprovam o trabalho.' },
                ].map((c, i) => (
                  <div key={c.title} className="flex items-center gap-4 rounded-2xl border-2 border-line p-4 animate-rise" style={{ animationDelay: `${250 + i * 180}ms` }}>
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${c.color}1f`, color: c.color }}>
                      <c.icon size={28} weight="duotone" />
                      <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-black text-white">{i + 1}</span>
                    </span>
                    <span>
                      <span className="block font-black text-ink">{c.title}</span>
                      <span className="block text-sm font-semibold text-muted">{c.desc}</span>
                    </span>
                  </div>
                ))}

              {step === 'login' && (
                <div className="animate-rise" style={{ animationDelay: '150ms' }}>
                  <SignIn
                    routing="hash"
                    withSignUp
                    oauthFlow="redirect"
                    forceRedirectUrl={inviteCode ? `/entrar?codigo=${inviteCode}` : '/entrar'}
                    signUpForceRedirectUrl={inviteCode ? `/entrar?codigo=${inviteCode}` : '/entrar'}
                    appearance={CLERK_APPEARANCE}
                  />
                </div>
              )}

              {step === 'tipo' && (
                <>
                  <Choice icon={UserIcon} color="#7B61FF" title="Só para mim" desc="As minhas tarefas, foco e ranking global" selected={use === 'personal'} onClick={() => setUse('personal')} delay={200} />
                  <Choice icon={BuildingsIcon} color="#12B5A6" title="Com a minha empresa" desc="Equipas, tarefas atribuídas e aprovações" selected={use === 'org'} onClick={() => setUse('org')} delay={320} />
                  <p className="pt-1 text-center text-xs font-semibold text-muted animate-rise" style={{ animationDelay: '440ms' }}>
                    Podes ter os dois e trocar a qualquer momento.
                  </p>
                </>
              )}

              {step === 'meta' && (
                <div className="grid grid-cols-2 gap-3">
                  {GOALS.map((g, i) => (
                    <button
                      key={g.minutes}
                      onClick={() => setGoal(g.minutes)}
                      aria-pressed={goal === g.minutes}
                      className={`group flex flex-col items-center gap-2 rounded-2xl border-2 border-b-4 p-4 transition-[transform,background] duration-100 active:translate-y-[2px] active:border-b-2 animate-rise cursor-pointer ${
                        goal === g.minutes ? 'border-brand bg-brand-light' : 'border-line hover:bg-snow'
                      }`}
                      style={{ animationDelay: `${180 + i * 100}ms` }}
                    >
                      <span
                        key={goal === g.minutes ? 'on' : 'off'}
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${goal === g.minutes ? 'animate-wiggle' : ''}`}
                        style={{ background: `${g.color}1f`, color: g.color }}
                      >
                        <g.icon size={30} weight="duotone" />
                      </span>
                      <span className={`text-lg font-black ${goal === g.minutes ? 'text-brand-dark' : 'text-ink'}`}>{g.label}</span>
                      <span className="text-sm font-semibold text-muted">{g.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 'empresa' && (
                <>
                  {suggestions.map((s, i) => (
                    <Choice
                      key={s.id}
                      icon={SparkleIcon}
                      color="#FF8A3D"
                      title={`Juntar-me a ${s.name}`}
                      desc={`O teu email @${emailDomain} é desta empresa`}
                      onClick={() =>
                        run(async () => {
                          const res = await account.joinOrg({ orgId: s.id })
                          setDone({ kind: 'joined', name: res.org.name })
                          go('pronto')
                        })
                      }
                      delay={150 + i * 100}
                    />
                  ))}
                  <Choice icon={PlusCircleIcon} color="#12B5A6" title="Criar a empresa" desc="Fico como administrador e convido a equipa" selected={orgPath === 'criar'} onClick={() => setOrgPath('criar')} delay={200 + suggestions.length * 100} />
                  <Choice icon={KeyIcon} color="#7B61FF" title="Tenho um código" desc="O meu supervisor enviou-me um convite" selected={orgPath === 'codigo'} onClick={() => setOrgPath('codigo')} delay={320 + suggestions.length * 100} />
                </>
              )}

              {step === 'criar' && (
                <form
                  id="f-criar"
                  onSubmit={e => {
                    e.preventDefault()
                    run(async () => {
                      const res = await account.createOrg({
                        name: orgName,
                        sector,
                        size: size || undefined,
                        domain: emailDomain && !PUBLIC_DOMAINS.includes(emailDomain) ? emailDomain : undefined,
                        departments: departments.split(/[,;\n]/).map(d => d.trim()).filter(Boolean),
                      })
                      setDone({ kind: 'created', code: res.org.inviteCode, name: res.org.name })
                      go('pronto')
                    })
                  }}
                  className="space-y-5"
                >
                  <Field label="Nome da empresa" delay={150}>
                    <input className="input py-3.5 text-lg" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ex: Lwei Brokers" required autoFocus maxLength={80} />
                  </Field>
                  <Field label="Sector" delay={250}>
                    <div className="flex flex-wrap gap-2">
                      {SECTORS.map(s => (
                        <button type="button" key={s} onClick={() => setSector(sector === s ? '' : s)} className={`chip ${sector === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>{s}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Quantas pessoas?" delay={350}>
                    <div className="flex flex-wrap gap-2">
                      {ORG_SIZES.map(s => (
                        <button type="button" key={s} onClick={() => setSize(size === s ? '' : s)} className={`chip ${size === s ? 'border-accent! bg-accent-light! text-accent-dark!' : ''}`}>{s}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Departamentos (opcional)" hint="Separados por vírgulas. Podes criar mais depois." delay={450}>
                    <input className="input" value={departments} onChange={e => setDepartments(e.target.value)} placeholder="Comercial, Financeiro, TI" />
                  </Field>
                </form>
              )}

              {step === 'codigo' && (
                <form
                  id="f-codigo"
                  key={errorKey}
                  onSubmit={e => {
                    e.preventDefault()
                    run(async () => {
                      const res = await account.joinOrg({ code })
                      setDone({ kind: 'joined', name: res.org.name })
                      go('pronto')
                    })
                  }}
                  className={error ? 'animate-shake' : 'animate-rise'}
                >
                  <input
                    className="input py-5 text-center font-mono text-3xl font-black uppercase tracking-[0.4em]"
                    placeholder="ABC123"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    maxLength={12}
                    autoFocus
                    aria-label="Código de convite"
                  />
                </form>
              )}

              {step === 'pronto' && done && <NextSteps done={done} goal={goal} />}
            </div>
          </div>
        )}
      </main>

      {/* Botão principal fixo em baixo */}
      {primary && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <button
              type={primary.form ? 'submit' : 'button'}
              form={primary.form}
              onClick={primary.onClick}
              disabled={primary.disabled}
              className={`btn w-full py-4 text-base ${primary.disabled ? 'btn-disabled' : step === 'pronto' ? 'btn-accent animate-pulse-ring' : 'btn-primary'}`}
            >
              {primary.label}
            </button>
            {secondary && (
              <button onClick={secondary.onClick} className="btn btn-ghost mt-3 w-full py-4 text-base text-accent">
                {secondary.label}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}

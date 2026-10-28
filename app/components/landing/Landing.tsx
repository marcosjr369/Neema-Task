'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BookOpenIcon, BriefcaseIcon, BuildingsIcon, CheckCircleIcon, CheckIcon, CoffeeIcon, CrownIcon, FireIcon,
  LightningIcon, PaperclipIcon, PlantIcon, TargetIcon, TimerIcon, TrophyIcon, UsersThreeIcon, type Icon,
} from '@phosphor-icons/react'
import Mascot, { type MascotMood, type MascotPose } from '../ui/Mascot'
import ProgressRing from '../ui/ProgressRing'

/*
 * Página inicial para quem ainda não tem sessão: apresenta a app, com a Udacha animada,
 * e leva ao registo (/entrar). Quem já tem sessão vê a app em "/".
 */

const START = '/entrar?passo=como'
const LOGIN = '/entrar?passo=login'

/** Mostra o conteúdo com uma animação quando entra no ecrã */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/** Ícone a flutuar num cartão branco (decoração das ilustrações) */
function Floating({ icon: I, color, className, delay = 0, rotate = 0, size = 56 }: { icon: Icon; color: string; className: string; delay?: number; rotate?: number; size?: number }) {
  return (
    <span
      className={`absolute flex items-center justify-center rounded-2xl bg-white shadow-[0_5px_0_#E9E7F2] animate-float ${className}`}
      style={{ width: size, height: size, color, animationDelay: `${delay}s`, ['--r' as string]: `${rotate}deg` }}
      aria-hidden
    >
      <I size={Math.round(size * 0.55)} weight="duotone" />
    </span>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 420)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur transition-[border-color] ${scrolled ? 'border-b-2 border-line' : 'border-b-2 border-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span data-mascot-logo className="inline-flex"><Mascot size={40} /></span>
          <span className="text-2xl font-black tracking-tight text-brand">udacha</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={LOGIN} className="hidden rounded-xl px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-muted hover:text-body sm:block">
            Entrar
          </Link>
          <Link href={START} className={`btn btn-primary px-4 py-2.5 text-sm transition-all duration-300 ${scrolled ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}>
            Começar agora
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-6 px-5 py-6 sm:gap-10 sm:py-10 lg:grid-cols-2">
      <HeroStage />
      <div className="text-center lg:text-left">
        <h1 className="mx-auto max-w-lg text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl lg:mx-0 animate-rise">
          A forma mais divertida de <span className="text-brand">focar</span>, fazer pausas e <span className="text-accent">acabar tarefas</span>!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base font-semibold text-muted sm:mt-4 sm:text-lg lg:mx-0 animate-rise" style={{ animationDelay: '120ms' }}>
          Cronómetro de foco, XP, sequências e ranking. Sozinho ou com a tua equipa.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:mt-8 lg:mx-0 animate-rise" style={{ animationDelay: '240ms' }}>
          <Link href={START} className="btn btn-primary w-full py-3.5 text-base sm:py-4">Começar agora</Link>
          <Link href={LOGIN} className="btn btn-ghost w-full py-3.5 text-base text-brand sm:py-4">Já tenho uma conta</Link>
        </div>
      </div>
    </section>
  )
}

/** Poses que a Udacha vai trocando no hero, com o que diz em cada uma */
const SCENES: { pose: MascotPose; mood: MascotMood; say: string }[] = [
  { pose: 'wave', mood: 'happy', say: 'Olá! Eu sou a Udacha.' },
  { pose: 'dance', mood: 'excited', say: 'Bora focar?' },
  { pose: 'thumbs', mood: 'happy', say: 'Tarefa feita!' },
  { pose: 'peace', mood: 'happy', say: 'Pausa merecida!' },
  { pose: 'celebrate', mood: 'excited', say: '+15 XP!' },
]

/** Emblema colorido a flutuar à volta da Udacha */
function Badge({ icon: I, bg, className, delay, rotate }: { icon: Icon; bg: string; className: string; delay: number; rotate: number }) {
  return (
    <span
      className={`absolute flex h-11 w-11 items-center justify-center rounded-xl text-white animate-float sm:h-16 sm:w-16 sm:rounded-2xl ${className}`}
      style={{ background: bg, boxShadow: 'inset 0 -5px 0 #0002', animationDelay: `${delay}s`, ['--r' as string]: `${rotate}deg` }}
      aria-hidden
    >
      <I size={30} weight="fill" className="h-6 w-6 sm:h-[30px] sm:w-[30px]" />
    </span>
  )
}

/** A Udacha num palco colorido; muda de pose sozinho ou ao clicar */
function HeroStage() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN(v => v + 1), 3600)
    return () => clearInterval(id)
  }, [n])
  const scene = SCENES[n % SCENES.length]
  return (
    <div className="relative mx-auto flex h-[270px] w-full max-w-md items-end justify-center sm:h-[460px]">
      {/* fundo: círculo suave */}
      <span className="absolute bottom-2 left-1/2 h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-brand-light sm:h-[360px] sm:w-[360px]" aria-hidden />

      <Badge icon={LightningIcon} bg="#FFC53D" className="left-[6%] top-[18%]" delay={0} rotate={-10} />
      <Badge icon={FireIcon} bg="#FF8A3D" className="right-[6%] top-[34%]" delay={0.8} rotate={8} />
      <Badge icon={CheckIcon} bg="#12B5A6" className="bottom-[14%] left-[4%]" delay={1.5} rotate={6} />

      {/* balão de fala */}
      <div key={`say-${n}`} className="absolute left-1/2 top-0 z-10 animate-bubble sm:top-[6%]">
        <div className="relative whitespace-nowrap rounded-2xl border-2 border-line bg-white px-3 py-2 text-sm font-extrabold sm:px-4 sm:py-2.5 sm:text-lg text-ink shadow-[0_4px_0_#E9E7F2]">
          {scene.say}
          <span className="absolute -bottom-[9px] left-6 h-4 w-4 rotate-45 border-b-2 border-r-2 border-line bg-white" />
        </div>
      </div>

      <button type="button" onClick={() => setN(v => v + 1)} className="relative mb-2 origin-bottom scale-[0.66] cursor-pointer sm:scale-100" aria-label="Ver a Udacha noutra pose">
        <div key={n} className="animate-hop">
          <Mascot size={330} pose={scene.pose} mood={scene.mood} />
        </div>
      </button>
    </div>
  )
}

const STRIP: { icon: Icon; label: string; color: string }[] = [
  { icon: BriefcaseIcon, label: 'Trabalho', color: '#4C7DFF' },
  { icon: BookOpenIcon, label: 'Estudo', color: '#EC5BA6' },
  { icon: PlantIcon, label: 'Pessoal', color: '#12B5A6' },
  { icon: TimerIcon, label: 'Foco', color: '#F2545B' },
  { icon: CoffeeIcon, label: 'Pausas', color: '#FF8A3D' },
  { icon: TargetIcon, label: 'Metas diárias', color: '#7B61FF' },
  { icon: FireIcon, label: 'Sequências', color: '#FF8A3D' },
  { icon: TrophyIcon, label: 'Ranking', color: '#E0A419' },
  { icon: UsersThreeIcon, label: 'Equipas', color: '#12B5A6' },
  { icon: CheckCircleIcon, label: 'Aprovações', color: '#4C7DFF' },
]

/** Faixa contínua com as áreas da app */
function Strip() {
  const items = [...STRIP, ...STRIP]
  return (
    <div className="overflow-hidden border-y-2 border-line bg-white py-5" aria-label="Funcionalidades">
      <div className="flex w-max animate-marquee gap-10 pr-10">
        {items.map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-3 text-sm font-black uppercase tracking-wider text-muted" aria-hidden={i >= STRIP.length}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${it.color}1f`, color: it.color }}>
              <it.icon size={22} weight="duotone" />
            </span>
            {it.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Feature({
  id, title, text, art, flip = false, tint = false,
}: { id?: string; title: ReactNode; text: string; art: ReactNode; flip?: boolean; tint?: boolean }) {
  return (
    <section id={id} className={tint ? 'bg-snow' : 'bg-white'}>
      <div className={`mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:py-28 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <Reveal className="text-center lg:text-left">
          <h2 className="text-4xl font-black lowercase leading-tight tracking-tight text-brand sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-md text-lg font-semibold leading-relaxed text-body/80 lg:mx-0">{text}</p>
        </Reveal>
        <Reveal delay={150} className="relative mx-auto flex h-[340px] w-full max-w-md items-end justify-center">
          {art}
        </Reveal>
      </div>
    </section>
  )
}

/** Telemóvel com uma tarefa a correr */
function PhoneArt() {
  return (
    <>
      <div className="absolute right-6 top-0 w-48 rounded-[2rem] border-[6px] border-gold bg-white p-4 shadow-[0_8px_0_#E0A419]">
        <div className="h-3 overflow-hidden rounded-full bg-line">
          <div className="h-full w-2/3 animate-grow rounded-full bg-accent" />
        </div>
        <div className="mt-4 space-y-2.5">
          {[
            { done: true, w: 'w-24' },
            { done: true, w: 'w-20' },
            { done: false, w: 'w-28' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border-2 border-line p-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${t.done ? 'bg-brand text-white' : 'border-2 border-line'}`}>
                {t.done && <CheckIcon size={12} weight="bold" />}
              </span>
              <span className={`h-2 rounded-full ${t.done ? 'bg-line' : 'bg-brand/30'} ${t.w}`} />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-brand py-2 text-center text-xs font-black uppercase text-white">+15 XP</div>
      </div>
      <div className="relative -ml-36">
        <Mascot size={250} pose="thumbs" />
      </div>
    </>
  )
}

/** Anel do cronómetro com o aviso de pausa */
function FocusArt() {
  const [progress, setProgress] = useState(0.15)
  useEffect(() => {
    const id = setInterval(() => setProgress(p => (p >= 1 ? 0.05 : p + 0.05)), 400)
    return () => clearInterval(id)
  }, [])
  return (
    <>
      <div className="absolute left-4 top-6">
        <ProgressRing size={170} stroke={14} progress={progress} color="#F2545B" track="#FDE4E5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">A focar</span>
          <span className="font-mono text-3xl font-bold tabular-nums text-ink">{String(Math.round(progress * 25)).padStart(2, '0')}:00</span>
        </ProgressRing>
      </div>
      <div className="absolute right-0 top-2 flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 py-3 font-black text-ink shadow-[0_4px_0_#E9E7F2] animate-float" style={{ ['--r' as string]: '3deg' }}>
        <CoffeeIcon size={24} weight="duotone" className="text-warm" /> Hora da pausa!
      </div>
      <div className="relative ml-32">
        <Mascot size={250} pose="think" />
      </div>
    </>
  )
}

/** Pódio do ranking com a Udacha a festejar */
function RankingArt() {
  const bars = [
    { h: 'h-24', place: 2, color: '#C0C0C0', delay: 200 },
    { h: 'h-36', place: 1, color: '#FFC53D', delay: 0 },
    { h: 'h-16', place: 3, color: '#CD7F32', delay: 400 },
  ]
  return (
    <>
      <Floating icon={FireIcon} color="#FF8A3D" className="left-0 top-4" delay={0.2} rotate={-8} />
      <Floating icon={LightningIcon} color="#E0A419" className="right-2 top-10" delay={0.9} rotate={10} />
      <Floating icon={CrownIcon} color="#E0A419" className="left-[45%] -top-2" delay={0.5} size={48} />
      <div className="absolute inset-x-6 bottom-0 flex items-end justify-center gap-3">
        {bars.map(b => (
          <div key={b.place} className={`flex w-24 animate-rise items-start justify-center rounded-t-2xl pt-2 text-3xl font-black text-white ${b.h}`} style={{ background: b.color, animationDelay: `${b.delay}ms`, boxShadow: 'inset 0 -8px 0 #0001' }}>
            {b.place}
          </div>
        ))}
      </div>
      <div className="relative mb-32">
        <Mascot size={200} pose="celebrate" mood="excited" />
      </div>
    </>
  )
}

/** Equipa: tarefa aprovada com anexo */
function TeamArt() {
  const team = [
    { name: 'AS', color: '#EC5BA6' },
    { name: 'JC', color: '#4C7DFF' },
    { name: 'RM', color: '#12B5A6' },
  ]
  return (
    <>
      <div className="absolute right-2 top-0 w-56 rounded-2xl border-2 border-line bg-white p-4 shadow-[0_6px_0_#E9E7F2] animate-float" style={{ ['--r' as string]: '-2deg' }}>
        <p className="font-black text-ink">Relatório mensal</p>
        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-muted"><PaperclipIcon size={14} /> relatorio.pdf</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {team.map(t => (
              <span key={t.name} className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white ring-2 ring-white" style={{ background: t.color }}>{t.name}</span>
            ))}
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-accent-light px-2 py-1 text-xs font-black text-accent-dark">
            <CheckCircleIcon size={14} weight="fill" /> Aprovada
          </span>
        </div>
      </div>
      <Floating icon={BuildingsIcon} color="#4C7DFF" className="left-2 top-6" delay={0.4} rotate={-6} />
      <div className="relative -ml-24">
        <Mascot size={250} pose="walk" outfit="casual" />
      </div>
    </>
  )
}

/**
 * A Udacha salta do logótipo do cabeçalho e voa em curva até ao palco da chamada final,
 * dando uma cambalhota pelo caminho. Com movimento reduzido, aparece logo no sítio.
 */
function flyFromLogo(target: HTMLElement) {
  const show = () => { target.style.opacity = '1' }
  const logo = document.querySelector<HTMLElement>('[data-mascot-logo]')
  if (!logo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return show()

  const a = logo.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const dx = a.left + a.width / 2 - (b.left + b.width / 2)
  const dy = a.top + a.height / 2 - (b.top + b.height / 2)
  const s0 = Math.max(0.12, (a.height * 2.2) / b.height)
  // ponto de controlo da curva: segue para o lado do palco quase à altura do logótipo e depois cai
  const cx = dx * 0.1
  const cy = dy + 60
  const steps = 16
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const x = (1 - t) ** 2 * dx + 2 * (1 - t) * t * cx
    const y = (1 - t) ** 2 * dy + 2 * (1 - t) * t * cy
    const s = s0 + (1 - s0) * t
    return { transform: `translate(${x}px, ${y}px) scale(${s}) rotate(${360 * t}deg)`, opacity: 1, offset: t }
  })

  logo.style.opacity = '0'
  const flight = target.animate(frames, { duration: 1300, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' })
  flight.onfinish = () => {
    show()
    // aterragem com "squash" e o logótipo volta a aparecer
    target.animate(
      [{ transform: 'scale(1.15, 0.85)' }, { transform: 'scale(0.95, 1.06)' }, { transform: 'scale(1)' }],
      { duration: 380, easing: 'ease-out' },
    )
    logo.style.opacity = ''
    logo.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' })
  }
}

function FinalCta() {
  const landing = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = landing.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        flyFromLogo(el)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <section className="relative overflow-hidden bg-white pt-20">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <Reveal>
          <h2 className="text-5xl font-black lowercase leading-tight tracking-tight text-brand sm:text-6xl">começa hoje com a udacha</h2>
          <Link href={START} className="btn btn-primary mx-auto mt-8 w-full max-w-sm py-4 text-base">Começar agora</Link>
        </Reveal>
      </div>
      <div className="relative mt-10 h-[320px]">
        {/* colinas no fundo, a continuar para o rodapé */}
        <svg className="absolute inset-x-0 bottom-0 h-56 w-full" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden>
          <path d="M0 80 Q240 40 420 90 Q600 150 720 150 Q840 150 1020 90 Q1200 40 1440 80 L1440 220 L0 220 Z" fill="#7B61FF" />
        </svg>
        <Floating icon={LightningIcon} color="#E0A419" className="left-[12%] top-6" delay={0.2} rotate={-10} />
        <Floating icon={FireIcon} color="#FF8A3D" className="left-[26%] top-24" delay={0.9} rotate={8} size={48} />
        <Floating icon={TrophyIcon} color="#E0A419" className="right-[14%] top-8" delay={0.5} rotate={10} />
        <Floating icon={CheckCircleIcon} color="#12B5A6" className="right-[28%] top-28" delay={1.2} rotate={-6} size={48} />
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
          {/* invisível até chegar a voar do logótipo */}
          <div ref={landing} className="opacity-0">
            <Mascot size={240} pose="jump" mood="excited" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    { title: 'Produto', links: [{ label: 'Foco e pausas', href: '#foco' }, { label: 'XP e ranking', href: '#ranking' }, { label: 'Para equipas', href: '#equipas' }] },
    { title: 'Conta', links: [{ label: 'Começar agora', href: START }, { label: 'Entrar', href: LOGIN }] },
  ]
  return (
    <footer className="bg-brand text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Mascot size={40} />
            <span className="text-2xl font-black tracking-tight">udacha</span>
          </div>
          <p className="mt-3 max-w-xs text-sm font-semibold text-white/75">Tarefas, foco e pausas, com a Udacha a torcer por ti.</p>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <p className="text-lg font-black">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(l => (
                <li key={l.label}><Link href={l.href} className="font-bold text-white/75 hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-white/15 py-5 text-center text-xs font-bold text-white/60">© {new Date().getFullYear()} Udacha</p>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <Header />
      <Hero />
      <Strip />
      <Feature
        title="grátis. divertido. eficaz."
        text="Liga o cronómetro, conclui tarefas e vê o teu progresso a crescer. Blocos curtos de foco, pontos a cada passo e metas que te puxam para a frente."
        art={<PhoneArt />}
      />
      <Feature
        id="foco"
        tint
        flip
        title="foco com pausas certas"
        text="A Udacha avisa-te quando é hora de descansar e quando é hora de voltar. Menos cansaço, mais concentração, todos os dias."
        art={<FocusArt />}
      />
      <Feature
        id="ranking"
        title="xp, sequências e ranking"
        text="Cada minuto de foco e cada tarefa contam. Mantém a sequência, sobe de nível e compara-te com amigos e colegas."
        art={<RankingArt />}
      />
      <Feature
        id="equipas"
        tint
        flip
        title="feito para equipas"
        text="Atribui tarefas, recebe o trabalho com anexos, aprova com um clique e acompanha o tempo e a presença de cada pessoa."
        art={<TeamArt />}
      />
      <FinalCta />
      <Footer />
    </div>
  )
}

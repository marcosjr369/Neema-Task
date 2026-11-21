'use client'

import { useEffect, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { IconContext, PlusIcon } from '@phosphor-icons/react'
import { AccountProvider, useAccount } from '../../context/AccountContext'
import { AppProvider, useApp } from '../../context/AppContext'
import { OrgProvider, useOrg } from '../../context/OrgContext'
import { PERSONAL_ONLY_PATHS } from '../../lib/nav'
import { loginUrl } from '../../lib/account'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import RightPanel from './RightPanel'
import MiniTimer from '../focus/MiniTimer'
import TaskSheet from '../tasks/TaskSheet'
import BreakPrompt from '../focus/BreakPrompt'
import CelebrationOverlay from '../focus/CelebrationOverlay'
import MilestoneCelebration from '../focus/MilestoneCelebration'
import IdleNudge from '../focus/IdleNudge'
import EventAlerts from '../calendar/EventAlerts'
import ToastView from '../ui/ToastView'
import ConsentGate from '../account/ConsentGate'
import SeatGate from '../office/SeatGate'
import WelcomeTour from '../tutorial/WelcomeTour'
import InviteDialog from '../account/InviteDialog'
import { PresenceSync } from '../account/PresenceSync'
import Splash from '../ui/Splash'
import BrandTheme, { useBrandBackground } from './BrandTheme'
import { CompanyLogoBar } from './CompanyLogo'

// a página de entrada só é para quem não tem sessão: não pesa em quem já entrou
const Landing = dynamic(() => import('../landing/Landing'), { loading: () => <Splash /> })
import Mascot from '../ui/Mascot'
import { registerServiceWorker } from '../../lib/pwa'
import { syncPush } from '../../lib/push'

const WIDE = ['/mapa', '/tarefas', '/estatisticas', '/ranking', '/empresa', '/calendario', '/quadros', '/planilhas', '/diagramas', '/inqueritos', '/tutorial', '/jogos']
/** páginas que ocupam a largura toda (o quadro desloca-se na horizontal) */
const FULL = (p: string) => p === '/tarefas' || p.startsWith('/quadros/') || p.startsWith('/planilhas/') || p.startsWith('/diagramas/')
const IMMERSIVE = ['/foco', '/entrar', '/convite']
// /p/: links de partilha, abertos a quem não tem conta (sem isto, o redireccionamento mandava-os para o login)
const PUBLIC = ['/entrar', '/convite', '/marcos', '/p/']

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { openTaskSheet, sheet } = useApp()
  const org = useOrg()
  const isCompany = !!org?.isCompany
  const redirect = isCompany && PERSONAL_ONLY_PATHS.includes(pathname)
  const immersive = IMMERSIVE.some(p => pathname.startsWith(p))
  const wide = WIDE.some(p => pathname === p || pathname.startsWith(`${p}/`))
  // fundo escolhido pela empresa para esta página (cor, fundo pronto ou imagem)
  const pageBackground = useBrandBackground()
  const showFab = isCompany ? pathname === '/empresa' || pathname === '/empresa/tarefas' : pathname === '/' || pathname === '/tarefas'

  useEffect(() => {
    if (redirect) router.replace('/empresa')
  }, [redirect, router])

  useEffect(() => {
    registerServiceWorker()
    syncPush().catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (sheet.open || e.ctrlKey || e.metaKey || e.altKey) return
      if (target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openTaskSheet()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTaskSheet, sheet.open])

  return (
    <div className="min-h-dvh bg-snow lg:bg-white">
      {immersive ? (
        <main className="mx-auto min-h-dvh max-w-2xl bg-white sm:border-x-2 sm:border-line lg:border-x-0">{children}</main>
      ) : (
        <>
          <SideNav />
          <div className="lg:pl-64" style={pageBackground ? { background: pageBackground, backgroundAttachment: 'fixed' } : undefined}>
            <div
              className={`mx-auto flex lg:gap-8 lg:px-8 ${
                FULL(pathname) ? 'lg:max-w-none' : wide ? 'lg:max-w-6xl 2xl:max-w-[1600px]' : 'lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1440px]'
              }`}
            >
              <div className={`relative mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col sm:border-x-2 sm:border-line lg:mx-0 lg:max-w-none lg:flex-1 lg:border-x-0 ${pageBackground ? '' : 'bg-white'}`}>
                <CompanyLogoBar />
                <main className="flex-1 pb-40 lg:pb-12">{redirect ? null : children}</main>
              </div>
              {!wide && !isCompany && <RightPanel />}
            </div>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-30 mx-auto flex max-w-lg flex-col items-end gap-3 px-4 pb-[env(safe-area-inset-bottom)] lg:hidden">
            {showFab && (
              <button
                onClick={() => openTaskSheet()}
                aria-label="Nova tarefa"
                className="btn btn-primary pointer-events-auto h-14 w-14 rounded-full p-0"
              >
                <PlusIcon size={28} />
              </button>
            )}
            <MiniTimer />
          </div>
          {wide && (
            <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden w-[340px] lg:block">
              <MiniTimer />
            </div>
          )}
          <BottomNav />
        </>
      )}

      {org && <BrandTheme />}
      <TaskSheet />
      <BreakPrompt />
      <CelebrationOverlay />
      <MilestoneCelebration />
      <IdleNudge />
      <EventAlerts />
      <ToastView />
      <PresenceSync />
      <ConsentGate />
      <SeatGate />
      <WelcomeTour />
    </div>
  )
}

function Workspace({ children }: { children: ReactNode }) {
  const { workspace, current, user, loading, switching, needsSetup, disabled, failed, refresh, logout } = useAccount()
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))
  const isLanding = pathname === '/'

  useEffect(() => {
    if (loading || isPublic || disabled || failed) return
    if (!user) {
      // ex.: o link de uma notificação aberto sem sessão: entra e volta a essa página
      if (!isLanding) router.replace(loginUrl(window.location.pathname + window.location.search))
      return
    }
    if (needsSetup) router.replace('/entrar')
  }, [loading, user, needsSetup, disabled, failed, isPublic, isLanding, router])

  if (pathname.startsWith('/marcos')) return <main className="min-h-dvh bg-snow">{children}</main>
  // link de partilha: abre com ou sem sessão, fora dos espaços da conta
  if (pathname.startsWith('/p/')) return <main className="min-h-dvh bg-white">{children}</main>
  // na entrada, o login acabado de fazer não troca a página pelo ecrã de carregamento (perdia os passos)
  if (loading && !(switching && isPublic)) return <Splash />
  if (disabled) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
        <Mascot size={110} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">Conta desactivada</h1>
        <p className="mt-1 max-w-xs font-semibold text-muted">A tua conta foi desactivada. Se achas que é um engano, fala com o suporte.</p>
        <button onClick={() => logout()} className="btn btn-primary mt-6">Terminar sessão</button>
      </main>
    )
  }
  // sessão iniciada no Clerk, mas a conta não chegou do servidor: em vez do login (que, com a
  // sessão já aberta, voltava a redireccionar em ciclo), deixa tentar outra vez ou sair
  if (!user && failed) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
        <Mascot size={110} mood="sad" />
        <h1 className="mt-4 text-2xl font-black text-ink">Não consegui abrir a tua conta</h1>
        <p className="mt-1 max-w-xs font-semibold text-muted">{failed}</p>
        <button onClick={() => refresh()} className="btn btn-primary mt-6">Tentar outra vez</button>
        <button onClick={() => logout()} className="mt-3 font-bold text-muted hover:text-body cursor-pointer">Terminar sessão</button>
      </main>
    )
  }
  if (!user) {
    if (isLanding) return <Landing />
    return isPublic ? <main className="min-h-dvh bg-white">{children}</main> : <Splash />
  }
  // a configurar a conta, ou na entrada: só a página, sem dados de nenhum espaço
  // (a mesma <main> de quem não tem sessão, para a entrada não recomeçar ao fazer login)
  if (needsSetup || pathname.startsWith('/entrar')) return isPublic ? <main className="min-h-dvh bg-white">{children}</main> : <Splash />
  if (workspace.kind === 'org' && current) {
    return (
      <OrgProvider key={workspace.orgId} orgId={workspace.orgId} initial={current}>
        <AppProvider key={workspace.orgId} workspace={workspace}>
          <Shell>{children}</Shell>
        </AppProvider>
      </OrgProvider>
    )
  }
  return (
    <AppProvider key="personal" workspace={{ kind: 'personal' }}>
      <Shell>{children}</Shell>
    </AppProvider>
  )
}

const ICONS = { weight: 'bold' as const, size: 22, mirrored: false }

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={ICONS}>
      <AccountProvider>
        <Workspace>{children}</Workspace>
        <InviteDialog />
      </AccountProvider>
    </IconContext.Provider>
  )
}

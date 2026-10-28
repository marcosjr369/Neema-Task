'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconContext, PlusIcon } from '@phosphor-icons/react'
import { AccountProvider, useAccount } from '../../context/AccountContext'
import { AppProvider, useApp } from '../../context/AppContext'
import { OrgProvider, useOrg } from '../../context/OrgContext'
import { PERSONAL_ONLY_PATHS } from '../../lib/nav'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import RightPanel from './RightPanel'
import MiniTimer from '../focus/MiniTimer'
import TaskSheet from '../tasks/TaskSheet'
import BreakPrompt from '../focus/BreakPrompt'
import CelebrationOverlay from '../focus/CelebrationOverlay'
import MilestoneCelebration from '../focus/MilestoneCelebration'
import IdleNudge from '../focus/IdleNudge'
import ToastView from '../ui/ToastView'
import ConsentGate from '../account/ConsentGate'
import { PresenceSync } from '../account/PresenceSync'
import Splash from '../ui/Splash'
import Mascot from '../ui/Mascot'
import Landing from '../landing/Landing'
import { registerServiceWorker } from '../../lib/pwa'
import { syncPush } from '../../lib/push'

/** Páginas que no desktop usam a largura toda (sem painel direito) */
const WIDE = ['/tarefas', '/estatisticas', '/ranking', '/empresa']
/** Páginas em ecrã inteiro, sem navegação */
const IMMERSIVE = ['/foco', '/entrar', '/convite']
/** Páginas abertas sem sessão iniciada */
const PUBLIC = ['/entrar', '/convite', '/marcos']

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { openTaskSheet, sheet } = useApp()
  const org = useOrg()
  const isCompany = !!org?.isCompany
  // a conta da empresa não tem trabalho próprio: Início, Tarefas, Foco e Estatísticas levam ao painel
  const redirect = isCompany && PERSONAL_ONLY_PATHS.includes(pathname)
  const immersive = IMMERSIVE.some(p => pathname.startsWith(p))
  const wide = WIDE.some(p => pathname === p || pathname.startsWith(`${p}/`))
  const showFab = isCompany ? pathname === '/empresa' || pathname === '/empresa/tarefas' : pathname === '/' || pathname === '/tarefas'

  useEffect(() => {
    if (redirect) router.replace('/empresa')
  }, [redirect, router])

  useEffect(() => {
    registerServiceWorker()
    syncPush().catch(() => undefined)
  }, [])

  // Atalho de teclado "N" para nova tarefa
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
          <div className="lg:pl-64">
            <div
              className={`mx-auto flex lg:gap-8 lg:px-8 ${
                pathname === '/tarefas' ? 'lg:max-w-none' : wide ? 'lg:max-w-6xl' : 'lg:max-w-5xl'
              }`}
            >
              <div className="relative mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col bg-white sm:border-x-2 sm:border-line lg:mx-0 lg:max-w-none lg:flex-1 lg:border-x-0">
                <main className="flex-1 pb-40 lg:pb-12">{redirect ? null : children}</main>
              </div>
              {!wide && !isCompany && <RightPanel />}
            </div>
          </div>

          {/* Mobile: botão + e temporizador flutuante */}
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
          {/* Desktop em páginas largas: temporizador no canto */}
          {wide && (
            <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden w-[340px] lg:block">
              <MiniTimer />
            </div>
          )}
          <BottomNav />
        </>
      )}

      <TaskSheet />
      <BreakPrompt />
      <CelebrationOverlay />
      <MilestoneCelebration />
      <IdleNudge />
      <ToastView />
      <PresenceSync />
      <ConsentGate />
    </div>
  )
}

/**
 * Sem sessão só abrem as páginas de entrada; com sessão, escolhe os providers
 * conforme o espaço activo (pessoal ou empresa).
 */
function Workspace({ children }: { children: ReactNode }) {
  const { workspace, current, user, loading, needsSetup, disabled, logout } = useAccount()
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))
  // "/" sem sessão é a página de apresentação; com sessão, o início da app
  const isLanding = pathname === '/'

  useEffect(() => {
    if (loading || isPublic || disabled) return
    if (!user) {
      if (!isLanding) router.replace('/entrar')
      return
    }
    // conta nova que ainda não escolheu o tipo (ou de empresa sem empresa) → entrada
    if (needsSetup) router.replace('/entrar')
  }, [loading, user, needsSetup, disabled, isPublic, isLanding, router])

  // painel de administração: página própria, com palavra-passe (não depende da conta)
  if (pathname.startsWith('/marcos')) return <main className="min-h-dvh bg-snow">{children}</main>
  if (loading) return <Splash />
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

/** Estilo por omissão dos ícones: traço "bold", arredondado como o resto da UI */
const ICONS = { weight: 'bold' as const, size: 22, mirrored: false }

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={ICONS}>
      <AccountProvider>
        <Workspace>{children}</Workspace>
      </AccountProvider>
    </IconContext.Provider>
  )
}

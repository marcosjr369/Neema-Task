'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import Splash from '../ui/Splash'

// A app depende da sessão (cookie) e de APIs do browser (notificações, som),
// por isso é renderizada só no cliente: evita diferenças de hidratação.
const App = dynamic(() => import('./AppShell'), { ssr: false, loading: () => <Splash /> })

export default function ClientRoot({ children }: { children: ReactNode }) {
  return <App>{children}</App>
}

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Painel · Udacha',
  // área interna: fora dos motores de busca
  robots: { index: false, follow: false },
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return children
}

import type { ReactNode } from 'react'
import PanelShell from './_components/PanelShell'

/** Todas as páginas do painel partilham a entrada com palavra-passe, o menu e os dados */
export default function PanelFazLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>
}

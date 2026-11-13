import type { ReactNode } from 'react'
import PanelShell from './_components/PanelShell'

export default function PanelFazLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>
}

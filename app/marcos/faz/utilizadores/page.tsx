'use client'

import { usePanel } from '../_components/PanelShell'
import { UsersTable } from '../_components/Tables'

export default function PanelUsersPage() {
  const { data, days, ask } = usePanel()
  if (!data) return null
  return (
    <UsersTable
      users={data.users}
      now={data.generatedAt}
      days={days}
      onToggle={u => ask(u, u.disabled ? 'enable' : 'disable')}
      onDelete={u => ask(u, 'delete')}
    />
  )
}

'use client'

import { usePanel } from '../_components/PanelShell'
import { OrgsTable } from '../_components/Tables'

export default function PanelOrgsPage() {
  const { data, days } = usePanel()
  if (!data) return null
  return <OrgsTable orgs={data.orgs} days={days} />
}

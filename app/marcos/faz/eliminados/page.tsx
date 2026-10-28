'use client'

import { usePanel } from '../_components/PanelShell'
import { DeletedTable } from '../_components/Tables'

export default function PanelDeletedPage() {
  const { data } = usePanel()
  if (!data) return null
  return <DeletedTable list={data.deleted} />
}

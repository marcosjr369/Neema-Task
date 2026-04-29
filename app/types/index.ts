export type Task = {
  id: string
  title: string
  description: string
  period: string
  deadline?: string
  tags: string[]
  status: 'todo' | 'doing' | 'done'
  createdAt: number
  notified?: boolean
}

export type ColumnType = {
  id: 'todo' | 'doing' | 'done'
  title: string
}

export type Task = {
  id: string
  title: string
  description: string
  period: string
  tags: string[]
  status: 'todo' | 'doing' | 'done'
  createdAt: number
}

export type ColumnType = {
  id: 'todo' | 'doing' | 'done'
  title: string
}
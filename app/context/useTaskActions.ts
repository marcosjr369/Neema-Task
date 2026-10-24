'use client'

import { useCallback, useState } from 'react'
import { api, errorText } from '../lib/api'
import type { Task } from '../types'
import { useApp } from './AppContext'
import { useOrg } from './OrgContext'

/** Acções sobre tarefas de empresa que mantêm as listas (minhas e da equipa) em dia */
export function useTaskActions() {
  const org = useOrg()
  const { replaceTask, showToast } = useApp()
  const [busy, setBusy] = useState(false)

  const apply = useCallback((task: Task) => {
    replaceTask(task)
    if (org?.isManager) org.upsertTeamTask(task)
  }, [replaceTask, org])

  const call = useCallback(async (fn: () => Promise<{ task: Task }>, success?: string) => {
    setBusy(true)
    try {
      const { task } = await fn()
      apply(task)
      if (success) showToast(success, 'success')
      return task
    } catch (err) {
      showToast(errorText(err), 'danger')
      return null
    } finally {
      setBusy(false)
    }
  }, [apply, showToast])

  const url = (id: string) => `${org?.base}/tasks/${id}`

  return {
    busy,
    approve: (id: string, comment?: string) =>
      call(() => api(url(id), { method: 'PATCH', body: { action: 'approve', comment } }), 'Tarefa aprovada'),
    reject: (id: string, comment: string) =>
      call(() => api(url(id), { method: 'PATCH', body: { action: 'reject', comment } }), 'Tarefa devolvida'),
    comment: (id: string, text: string) =>
      call(() => api(url(id), { method: 'PATCH', body: { action: 'comment', text } })),
    setStatus: (id: string, status: Task['status']) =>
      call(() => api(url(id), { method: 'PATCH', body: { action: 'status', status } })),
    update: (id: string, patch: Record<string, unknown>) =>
      call(() => api(url(id), { method: 'PATCH', body: { action: 'update', patch } })),
    upload: (id: string, file: File) => {
      if (file.size > 15 * 1024 * 1024) {
        showToast('O ficheiro excede 15 MB', 'danger')
        return Promise.resolve(null)
      }
      const form = new FormData()
      form.append('file', file)
      return call(() => api(`${url(id)}/attachments`, { form }), 'Ficheiro anexado')
    },
    removeAttachment: (id: string, attachmentId: string) =>
      call(() => api(`${url(id)}/attachments?id=${attachmentId}`, { method: 'DELETE' })),
  }
}

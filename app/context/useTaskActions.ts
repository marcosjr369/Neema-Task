'use client'

import { useCallback, useState } from 'react'
import { api, errorText } from '../lib/api'
import type { Task } from '../types'
import { useApp } from './AppContext'
import { useOrg } from './OrgContext'

export function useTaskActions() {
  const org = useOrg()
  const { replaceTask, refreshTasks, showToast } = useApp()
  const [busy, setBusy] = useState(false)

  const apply = useCallback((task: Task) => {
    replaceTask(task)
    if (org?.isManager) org.upsertTeamTask(task)
  }, [replaceTask, org])

  const call = useCallback(async (fn: () => Promise<{ task: Task; tasks?: Task[] }>, success?: string) => {
    setBusy(true)
    try {
      const { task, tasks } = await fn()
      ;(tasks ?? [task]).forEach(apply)
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
    updateGroup: async (id: string, patch: Record<string, unknown>, success?: string) => {
      const task = await call(() => api(url(id), { method: 'PATCH', body: { action: 'update', patch: { ...patch, group: true } } }), success)
      if (task) await Promise.all([org?.refreshTeam(), refreshTasks()])
      return task
    },
    createGroup: async (data: Record<string, unknown>, assigneeIds: string[]) => {
      setBusy(true)
      try {
        await api(`${org?.base}/tasks`, { body: { ...data, assigneeIds } })
        await Promise.all([org?.refreshTeam(), refreshTasks()])
        showToast(`Tarefa atribuída a ${assigneeIds.length} pessoas`, 'success')
        return true
      } catch (err) {
        showToast(errorText(err), 'danger')
        return false
      } finally {
        setBusy(false)
      }
    },
    removeGroup: async (id: string) => {
      try {
        await api(`${url(id)}?group=1`, { method: 'DELETE' })
        await Promise.all([org?.refreshTeam(), refreshTasks()])
        showToast('Tarefa apagada para todos', 'success')
        return true
      } catch (err) {
        showToast(errorText(err), 'danger')
        return false
      }
    },
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

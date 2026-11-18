import { describe, expect, it } from 'vitest'
import { canReviewTask } from '../app/lib/org'
import type { Member } from '../app/types'

const member = (id: string, role: Member['role']) => ({ id, orgId: 'o1', userId: id, role, status: 'activo', name: id, email: `${id}@x.pt` } as Member)
const sup = member('sup', 'supervisor')
const admin = member('admin', 'admin')
const other = member('sup2', 'supervisor')

describe('quem pode aprovar uma tarefa', () => {
  it('quem cria uma tarefa para outra pessoa pode aprová-la', () => {
    expect(canReviewTask({ assigneeId: 'ana' }, sup, true)).toBe(true)
  })

  it('quem cria a tarefa para si próprio não a aprova (nem sendo admin)', () => {
    expect(canReviewTask({ assigneeId: 'sup' }, sup, true)).toBe(false)
    expect(canReviewTask({ assigneeId: 'admin' }, admin, true)).toBe(false)
    expect(canReviewTask({ assigneeId: 'admin', reviewerId: 'admin' }, admin, true)).toBe(false)
  })

  it('a tarefa do supervisor é aprovada por um admin ou outro supervisor que o gere', () => {
    expect(canReviewTask({ assigneeId: 'sup' }, admin, true)).toBe(true)
    expect(canReviewTask({ assigneeId: 'sup' }, other, true)).toBe(true)
    expect(canReviewTask({ assigneeId: 'sup' }, other, false)).toBe(false)
  })

  it('com supervisor escolhido: esse supervisor ou um admin', () => {
    expect(canReviewTask({ assigneeId: 'ana', reviewerId: 'sup2' }, other, false)).toBe(true)
    expect(canReviewTask({ assigneeId: 'ana', reviewerId: 'sup2' }, admin, false)).toBe(true)
  })
})

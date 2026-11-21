import type { Access } from '../../types'

export const canEditAccess = (a: Access | null | undefined) => a === 'edit' || a === 'owner'

import type { AccountType, BusinessRole, User } from '../types'

/**
 * Tipo de conta do utilizador. Contas antigas sem tipo gravado: quem pertence a uma
 * empresa é de empresa; quem já usou o espaço pessoal é pessoal; senão ainda não escolheu.
 */
export function accountTypeOf(user: User, hasMembership: boolean): AccountType | undefined {
  if (user.accountType) return user.accountType
  if (hasMembership) return 'business'
  if (user.workspace?.kind === 'personal') return 'personal'
  return undefined
}

/**
 * Conta de empresa: é a conta da própria empresa ou a de um funcionário? Contas antigas sem
 * isto gravado: quem criou uma empresa é a conta dela; quem só entrou em empresas é funcionário.
 */
export function businessRoleOf(user: User, ownsOrg: boolean, hasMembership: boolean): BusinessRole | undefined {
  if (user.businessRole) return user.businessRole
  if (ownsOrg) return 'company'
  if (hasMembership) return 'employee'
  return undefined
}

export const COMPANY_ONLY = 'Esta é a conta de uma empresa: não pode entrar noutra empresa como funcionário. Para isso, usa outro email.'
export const EMPLOYEE_ONLY = 'Esta é uma conta de funcionário: não pode criar empresas. Para criar a conta de uma empresa, usa outro email.'

export const BUSINESS_ONLY = 'Esta conta é de empresa e não tem espaço pessoal.'
export const PERSONAL_ONLY = 'Esta conta é pessoal. Para criar ou gerir uma empresa, usa outra conta (ou aceita o convite de uma empresa).'

/**
 * Para onde voltar depois do login (?volta=): só caminhos desta app. Recusa endereços de outros
 * sites ("//site.com", "/\site.com", "https://…") e a própria entrada (dava voltas em ciclo).
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (/[\u0000-\u001f\\]/.test(value)) return null
  const path = value.split(/[?#]/)[0]
  if (path === '/' || path === '/entrar' || path.startsWith('/entrar/')) return null
  return value
}

/** Endereço do login que, depois de entrar, volta a `path` */
export const loginUrl = (path?: string | null) => {
  const back = safeReturnPath(path)
  return back ? `/entrar?passo=login&volta=${encodeURIComponent(back)}` : '/entrar?passo=login'
}

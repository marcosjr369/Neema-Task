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

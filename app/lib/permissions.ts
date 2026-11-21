import type { Department, FeatureKey, FeatureRule, Member, OrgPermissions } from '../types'
import { descendantIds } from './org'

/**
 * Permissões por funcionalidade (Empresa → Definições → Permissões).
 * Sem regra, todos podem. Os administradores (e a conta da empresa) podem sempre.
 * Só contam no espaço da empresa: no espaço pessoal cada um faz o que quiser.
 */

export const FEATURES: Record<FeatureKey, { name: string; action: string; text: string; href?: string; group: 'criar' | 'ver' | 'partilhar' }> = {
  inqueritos: { name: 'Inquéritos', action: 'criar inquéritos', text: 'Criar votações, eleições, formulários, concursos… Responder fica sempre aberto a todos.', group: 'criar' },
  quadros: { name: 'Quadros', action: 'criar quadros', text: 'Criar quadros da empresa. Os quadros partilhados continuam a abrir.', group: 'criar' },
  planilhas: { name: 'Planilhas', action: 'criar planilhas', text: 'Criar planilhas da empresa.', group: 'criar' },
  diagramas: { name: 'Diagramas', action: 'criar diagramas', text: 'Criar diagramas da empresa.', group: 'criar' },
  reunioes: { name: 'Reuniões', action: 'marcar reuniões', text: 'Marcar reuniões e eventos no calendário da empresa. Todos vêem aquelas para que são convidados.', group: 'criar' },
  formulariosPublicos: { name: 'Respostas sem conta', action: 'abrir inquéritos a pessoas de fora', text: 'Ligar "Aceitar respostas pelo link, sem conta" nos inquéritos da empresa (clientes, candidatos…).', group: 'partilhar' },
  jogos: { name: 'Jogos', action: 'usar os jogos', text: 'Ver e jogar os jogos de pausa. Quem não pode deixa de os ver no menu.', href: '/jogos', group: 'ver' },
  ranking: { name: 'Ranking', action: 'ver o ranking', text: 'Ver o ranking da equipa. Quem não pode deixa de o ver no menu.', href: '/ranking', group: 'ver' },
}

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

export const MODE_TEXT: Record<FeatureRule['mode'], string> = {
  all: 'Todos',
  managers: 'Chefias e administradores',
  admins: 'Só administradores',
  some: 'Escolher pessoas',
}

/** Esta pessoa pode usar a funcionalidade? */
export function canUse(permissions: OrgPermissions | undefined, departments: Department[], me: Pick<Member, 'id' | 'role' | 'departmentId'>, key: FeatureKey) {
  if (me.role === 'admin') return true
  const rule = permissions?.[key]
  if (!rule || rule.mode === 'all') return true
  if (rule.mode === 'admins') return false
  if (rule.mode === 'managers') return me.role === 'supervisor'
  if (rule.memberIds?.includes(me.id)) return true
  // um departamento escolhido inclui os subdepartamentos
  if (me.departmentId) for (const d of rule.departmentIds ?? []) if (descendantIds(departments, d).has(me.departmentId)) return true
  return false
}

export const deniedText = (key: FeatureKey) => `A tua empresa não te deu permissão para ${FEATURES[key].action}. Fala com um administrador.`

/** Valida o que chega do browser (só ids que existem nesta empresa) */
export function cleanPermissions(v: unknown, memberIds: Set<string>, deptIds: Set<string>): OrgPermissions {
  const out: OrgPermissions = {}
  const input = (v && typeof v === 'object' ? v : {}) as Record<string, Partial<FeatureRule>>
  for (const key of FEATURE_KEYS) {
    const r = input[key]
    if (!r || !(r.mode && Object.hasOwn(MODE_TEXT, r.mode)) || r.mode === 'all') continue
    const rule: FeatureRule = { mode: r.mode }
    if (r.mode === 'some') {
      rule.memberIds = [...new Set((Array.isArray(r.memberIds) ? r.memberIds : []).filter(id => memberIds.has(id)))].slice(0, 2000)
      rule.departmentIds = [...new Set((Array.isArray(r.departmentIds) ? r.departmentIds : []).filter(id => deptIds.has(id)))].slice(0, 500)
    }
    out[key] = rule
  }
  return out
}

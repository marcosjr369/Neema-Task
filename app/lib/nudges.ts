const NUDGES = [
  { title: 'Tenho saudades tuas…', body: (t: string) => `Já passou ${t} sem focares. Vamos voltar?` },
  { title: 'A Udacha está triste', body: (t: string) => `Não trabalhas há ${t}. Só 25 minutos, prometo que vale a pena.` },
  { title: 'Assim fico a chorar…', body: (t: string) => `${t} sem foco. A tua meta de hoje ainda está à espera.` },
  { title: 'Ainda estás aí?', body: (t: string) => `${t} parado. Uma tarefa pequena já me deixa feliz outra vez.` },
]

export function nudgeMessage(count: number, idleFor: string) {
  const n = NUDGES[Math.min(count, NUDGES.length - 1)]
  return { title: n.title, body: n.body(idleFor) }
}

export const REMINDER_INTERVALS = [
  { minutes: 0, label: 'Nunca' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
]

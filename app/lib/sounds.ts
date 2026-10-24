type Note = [freq: number, start: number, dur: number]

function play(notes: Note[], volume = 0.15, type: OscillatorType = 'sine') {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const master = ctx.createGain()
    master.gain.setValueAtTime(volume, ctx.currentTime)
    master.connect(ctx.destination)

    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      const t = ctx.currentTime + start
      osc.type = type
      osc.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.9, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    }
    setTimeout(() => ctx.close().catch(() => {}), 3000)
  } catch { /* sem áudio */ }
}

export const sounds = {
  /** Fim do bloco de foco: hora de pausar */
  breakTime: () => play([[523, 0, 0.18], [659, 0.22, 0.18], [784, 0.44, 0.18], [1047, 0.66, 0.4]]),
  /** Fim da pausa: voltar ao foco */
  backToWork: () => play([[880, 0, 0.12], [1047, 0.18, 0.25], [1319, 0.4, 0.3]], 0.13),
  /** Tempo planeado de descanso/lazer terminou */
  gentle: () => play([[659, 0, 0.3], [523, 0.35, 0.5]], 0.12),
  /** Tarefa concluída */
  success: () => play([[784, 0, 0.12], [988, 0.1, 0.12], [1175, 0.2, 0.12], [1568, 0.32, 0.45]], 0.14, 'triangle'),
  /** Prazo a aproximar-se */
  warning: () => play([[523, 0, 0.15], [659, 0.2, 0.2]], 0.12),
  /** Prazo expirado */
  deadline: () => play([[880, 0, 0.12], [880, 0.18, 0.12], [660, 0.36, 0.12], [660, 0.54, 0.12], [440, 0.72, 0.25]], 0.16, 'square'),
}

/** Mostra uma notificação do sistema; `url` é aberto ao tocar nela */
export function pushNotification(title: string, body: string, tag?: string, url = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const options: NotificationOptions = {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
  }
  const fallback = () => {
    try {
      new Notification(title, options)
    } catch { /* Android só permite notificações via service worker */ }
  }
  // Via service worker funciona também no Android e com a app instalada
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then(reg => (reg ? reg.showNotification(title, options) : fallback()))
      .catch(fallback)
  } else {
    fallback()
  }
}

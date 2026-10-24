'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useOrg } from '../../context/OrgContext'
import { sounds } from '../../lib/sounds'
import Mascot from '../ui/Mascot'

const IDLE_MS = 15 * 60 * 1000
const ANSWER_MS = 2 * 60 * 1000

/** Empresa: o cronómetro actualiza o estado e a inactividade passa a "ausente" */
export function PresenceSync() {
  const org = useOrg()
  const { timer, settings } = useApp()
  const [asking, setAsking] = useState(false)
  const lastActivity = useRef(0)
  const running = !!timer?.segmentStart
  const phase = timer?.phase
  const setPresence = org?.setPresence
  const presence = org?.presence

  // Cronómetro → estado (só quando o cronómetro muda; a escolha manual prevalece)
  const presenceRef = useRef(presence)
  useEffect(() => { presenceRef.current = presence }, [presence])
  useEffect(() => {
    if (!setPresence || !running) return
    const want = phase === 'break' ? 'pausa' : 'trabalho'
    if (presenceRef.current !== want) setPresence(want)
  }, [running, phase, setPresence])

  // Inactividade
  useEffect(() => {
    if (!setPresence) return
    lastActivity.current = Date.now()
    const touch = () => { lastActivity.current = Date.now() }
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const id = setInterval(() => {
      if (presence === 'trabalho' && !running && Date.now() - lastActivity.current > IDLE_MS) {
        setAsking(true)
        if (settings.sound) sounds.warning()
      }
    }, 30 * 1000)
    return () => {
      events.forEach(e => window.removeEventListener(e, touch))
      clearInterval(id)
    }
  }, [setPresence, presence, running, settings.sound])

  // Sem resposta → ausente
  useEffect(() => {
    if (!asking || !setPresence) return
    const id = setTimeout(() => {
      setPresence('ausente')
      setAsking(false)
    }, ANSWER_MS)
    return () => clearTimeout(id)
  }, [asking, setPresence])

  if (!asking || !org) return null
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40 sm:items-center sm:p-6 animate-fade-in">
      <div role="alertdialog" aria-labelledby="idle-title" className="w-full max-w-sm rounded-t-3xl bg-white p-6 text-center sm:rounded-3xl animate-slide-up">
        <Mascot size={88} mood="sleepy" className="mx-auto" />
        <h2 id="idle-title" className="mt-3 text-xl font-black text-ink">Ainda estás aí?</h2>
        <p className="mt-1 font-semibold text-muted">
          Não há actividade há 15 minutos. Se não responderes, o teu estado passa a <b>Ausente</b>.
        </p>
        <button
          onClick={() => {
            lastActivity.current = Date.now()
            setAsking(false)
          }}
          className="btn btn-primary mt-5 w-full"
          autoFocus
        >
          Sim, estou a trabalhar
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { org.setPresence('reuniao'); setAsking(false) }} className="btn btn-ghost px-2 text-sm text-body">👥 Reunião</button>
          <button onClick={() => { org.setPresence('pausa'); setAsking(false) }} className="btn btn-ghost px-2 text-sm text-body">☕ Pausa</button>
        </div>
      </div>
    </div>
  )
}

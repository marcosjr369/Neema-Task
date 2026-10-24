/* eslint-disable @next/next/no-img-element -- fotos externas (Google) sem configurar domínios */
import { initials } from '../../lib/org'
import { PRESENCE_CONFIG, type PresenceStatus } from '../../types'

const COLORS = ['#7B61FF', '#12B5A6', '#FF8A3D', '#EC5BA6', '#4C7DFF', '#E0A419']

function colorFor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export default function Avatar({
  name, picture, size = 40, presence,
}: { name: string; picture?: string; size?: number; presence?: PresenceStatus }) {
  const dot = Math.max(10, size * 0.28)
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {picture ? (
        <img src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-black text-white"
          style={{ background: colorFor(name), fontSize: size * 0.38 }}
        >
          {initials(name)}
        </span>
      )}
      {presence && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white"
          style={{ width: dot, height: dot, background: PRESENCE_CONFIG[presence].color }}
          title={PRESENCE_CONFIG[presence].label}
        />
      )}
    </span>
  )
}

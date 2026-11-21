'use client'

import Link from 'next/link'
import { useState } from 'react'
import Mascot from '../ui/Mascot'
import { api } from '../../lib/api'
import { loginUrl } from '../../lib/account'
import { darkBackground, guestsNeedLogin } from '../../lib/polls'
import type { PollDetail } from '../../types'
import Participate, { PollIntro } from './Participate'
import { submitBody } from './submit'
import { ThemedFrame, themeOf } from './Theme'

/** Inquérito aberto pelo link de partilha, por quem não tem acesso pela conta (com ou sem sessão) */
export default function PublicPoll({ token, detail, signedIn, shareKey }: { token: string; detail: PollDetail; signedIn: boolean; shareKey: string | null }) {
  const [d, setD] = useState(detail)
  const dark = darkBackground(themeOf(d.poll))
  const needsLogin = !signedIn && d.me.block && guestsNeedLogin(d.poll) && d.phase === 'open'

  return (
    <ThemedFrame full poll={d.poll} intro={<>{d.orgName && <p className="mt-1 text-sm font-bold text-muted">{d.orgName}</p>}<PollIntro d={d} /></>}>
      {needsLogin ? (
        <div className="flex flex-col items-center rounded-3xl bg-white p-6 text-center">
          <Mascot size={80} pose="wave" />
          <p className="mt-2 max-w-sm font-bold text-body">{d.me.block}</p>
          <Link href={loginUrl(`/p/${token}`)} className="btn pf-btn mt-4">Entrar para responder</Link>
        </div>
      ) : (
        <Participate d={d} guest={!signedIn} onSubmit={async s => {
          const next = await api<PollDetail>(`/api/partilha/${token}/responder`, { ...submitBody(s), headers: shareKey ? { 'x-share-key': shareKey } : undefined })
          setD(next)
        }} />
      )}
      <p className={`mt-6 text-center text-xs font-bold ${dark ? 'text-white/80' : 'text-muted'}`}>
        <Link href="/" className="inline-flex items-center gap-1 hover:underline"><Mascot size={18} /> Feito com a Udacha</Link>
        {!signedIn && <> · <Link href={loginUrl(`/p/${token}`)} className="hover:underline">Entrar</Link></>}
      </p>
    </ThemedFrame>
  )
}

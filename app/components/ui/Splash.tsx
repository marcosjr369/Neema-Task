import Mascot from './Mascot'

/** Ecrã de arranque enquanto a sessão carrega */
export default function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-white">
      <div className="animate-float">
        <Mascot size={110} animated />
      </div>
      <p className="text-2xl font-black tracking-tight text-brand">marcos tasks</p>
      <div className="flex gap-1.5" aria-label="A carregar">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand/70 animate-bounce-soft" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }} />
        ))}
      </div>
    </div>
  )
}

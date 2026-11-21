import type { Submit } from './Respond'

/** Envia uma resposta: multipart quando há ficheiros */
export function submitBody(s: Submit) {
  const data = { answers: s.answers, other: s.other, name: s.name }
  if (!Object.keys(s.files).length) return { body: data }
  const form = new FormData()
  form.set('data', JSON.stringify(data))
  for (const [k, f] of Object.entries(s.files)) form.set(`file:${k}`, f)
  return { form }
}

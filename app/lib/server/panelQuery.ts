export function panelQuery(req: Request) {
  const url = new URL(req.url)
  const n = Number(url.searchParams.get('dias'))
  return { days: [7, 30, 90].includes(n) ? n : 30, tz: url.searchParams.get('tz') || 'UTC' }
}

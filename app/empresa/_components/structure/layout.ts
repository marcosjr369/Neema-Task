/**
 * Posições do organograma: cada nó fica centrado por cima dos filhos; os filhos de um nó
 * recolhido não aparecem. Puro (sem React) para poder ser testado.
 */

export type TreeNode = { id: string; children: TreeNode[] }
export type Placed = { id: string; x: number; y: number; depth: number; parentId?: string }
export type Edge = { from: string; to: string; x1: number; y1: number; x2: number; y2: number }
export type TreeLayout = { nodes: Placed[]; edges: Edge[]; width: number; height: number }

export const CARD_W = 248
export const CARD_H = 156
export const GAP_X = 24
export const GAP_Y = 76

export function layoutTree(root: TreeNode, collapsed: Set<string>): TreeLayout {
  const widths = new Map<string, number>()
  const visibleChildren = (n: TreeNode) => (collapsed.has(n.id) ? [] : n.children)

  const measure = (n: TreeNode): number => {
    const kids = visibleChildren(n)
    const w = kids.length ? Math.max(CARD_W, kids.reduce((s, k) => s + measure(k), 0) + GAP_X * (kids.length - 1)) : CARD_W
    widths.set(n.id, w)
    return w
  }
  measure(root)

  const nodes: Placed[] = []
  const edges: Edge[] = []
  let height = 0
  const place = (n: TreeNode, left: number, depth: number, parentId?: string) => {
    const w = widths.get(n.id)!
    const x = left + (w - CARD_W) / 2
    const y = depth * (CARD_H + GAP_Y)
    nodes.push({ id: n.id, x, y, depth, parentId })
    height = Math.max(height, y + CARD_H)
    const kids = visibleChildren(n)
    const total = kids.reduce((s, k) => s + widths.get(k.id)!, 0) + GAP_X * Math.max(0, kids.length - 1)
    let cursor = left + (w - total) / 2
    for (const k of kids) {
      const kw = widths.get(k.id)!
      edges.push({ from: n.id, to: k.id, x1: x + CARD_W / 2, y1: y + CARD_H, x2: cursor + kw / 2, y2: y + CARD_H + GAP_Y })
      place(k, cursor, depth + 1, n.id)
      cursor += kw + GAP_X
    }
  }
  place(root, 0, 0)
  return { nodes, edges, width: widths.get(root.id)!, height }
}

/** Ligação em cotovelo: desce do pai, segue na horizontal e desce até ao filho */
export function edgePath(e: Edge, radius = 12) {
  const midY = e.y1 + (e.y2 - e.y1) / 2
  if (Math.abs(e.x2 - e.x1) < 1) return `M ${e.x1} ${e.y1} V ${e.y2}`
  const dir = e.x2 > e.x1 ? 1 : -1
  const r = Math.min(radius, Math.abs(e.x2 - e.x1) / 2, (e.y2 - e.y1) / 2)
  return [
    `M ${e.x1} ${e.y1}`,
    `V ${midY - r}`,
    `Q ${e.x1} ${midY} ${e.x1 + dir * r} ${midY}`,
    `H ${e.x2 - dir * r}`,
    `Q ${e.x2} ${midY} ${e.x2} ${midY + r}`,
    `V ${e.y2}`,
  ].join(' ')
}

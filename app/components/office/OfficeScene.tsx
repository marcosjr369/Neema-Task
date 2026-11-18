'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { chairStyle, deskSeats, deskStyle, itemSize } from '../../lib/office'
import { PRESENCE_CONFIG, type Member, type OfficeItem, type OfficeMap, type OfficeRoom } from '../../types'
import Avatar from '../ui/Avatar'

const WALL_H = 1.1
const WALL_T = 0.08
const DOOR = 1

type Props = {
  map: OfficeMap
  /** quem está em cada cadeira agora */
  taken: Map<string, Member>
  meId?: string
  /** pick: as cadeiras livres ficam realçadas e podem ser escolhidas */
  mode?: 'view' | 'pick'
  selected?: string | null
  /** cadeira ou sala para onde a câmara se vira */
  focus?: { x: number; z: number; zoom?: number } | null
  onSeat?: (seat: OfficeItem) => void
  /** planta por baixo do chão (pré-visualização do editor) */
  guideUrl?: string | null
  /** carregar numa sala, mesa ou cadeira aproxima a câmara (por omissão, sim) */
  zoomOnClick?: boolean
  /** salas em reunião agora (id → texto, ex.: "Em reunião até 11:00"): o nome fica realçado */
  busyRooms?: Map<string, string>
  className?: string
}

/** Onde fica a porta de uma sala: no lado encostado a um corredor (senão, em baixo) */
function doorSide(room: OfficeRoom, map: OfficeMap): 'n' | 's' | 'e' | 'w' {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.6
  const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.min(a2, b2) - Math.max(a1, b1) > DOOR
  for (const c of map.rooms.filter(r => r.kind === 'corredor')) {
    if (near(room.z + room.d, c.z) && overlap(room.x, room.x + room.w, c.x, c.x + c.w)) return 's'
    if (near(room.z, c.z + c.d) && overlap(room.x, room.x + room.w, c.x, c.x + c.w)) return 'n'
    if (near(room.x + room.w, c.x) && overlap(room.z, room.z + room.d, c.z, c.z + c.d)) return 'e'
    if (near(room.x, c.x + c.w) && overlap(room.z, room.z + room.d, c.z, c.z + c.d)) return 'w'
  }
  return 's'
}

/** Para onde vai a câmara para ver um ponto do piso de perto (dist: distância em metros) */
export const goalFor = (x: number, z: number, dist: number) => ({
  target: new THREE.Vector3(x, 0, z),
  pos: new THREE.Vector3(x, dist * 0.8, z + dist * 0.65),
})
/** Ver uma sala inteira */
export const roomGoal = (r: Pick<OfficeRoom, 'x' | 'z' | 'w' | 'd'>) => goalFor(r.x + r.w / 2, r.z + r.d / 2, Math.max(7, Math.max(r.w, r.d) * 1.3))

function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts })
}

/*
 * Geometrias partilhadas: milhares de peças usam as mesmas medidas (todas as cadeiras do mesmo
 * tipo, todas as mesas do mesmo tamanho), por isso cada medida é criada uma só vez.
 */
const GEOMETRIES = new Map<string, THREE.BufferGeometry>()
const r3 = (v: number) => Math.round(v * 1000) / 1000
function boxGeo(w: number, h: number, d: number) {
  const key = `b${r3(w)}:${r3(h)}:${r3(d)}`
  let g = GEOMETRIES.get(key)
  if (!g) GEOMETRIES.set(key, (g = new THREE.BoxGeometry(w, h, d)))
  return g
}
function cylGeo(r: number, h: number, segments: number) {
  const key = `c${r3(r)}:${r3(h)}:${segments}`
  let g = GEOMETRIES.get(key)
  if (!g) GEOMETRIES.set(key, (g = new THREE.CylinderGeometry(r, r, h, segments)))
  return g
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Paredes de uma sala, com a abertura da porta num dos lados */
function walls(room: OfficeRoom, map: OfficeMap, m: THREE.Material) {
  const g = new THREE.Group()
  const side = doorSide(room, map)
  const seg = (horizontal: boolean, fixed: number, from: number, to: number, door: boolean) => {
    const len = to - from
    const parts: [number, number][] = door && len > DOOR + 0.4 ? [[from, from + (len - DOOR) / 2], [from + (len + DOOR) / 2, to]] : [[from, to]]
    for (const [a, b] of parts) {
      const l = b - a
      const mid = (a + b) / 2
      g.add(horizontal ? box(l, WALL_H, WALL_T, m, mid, WALL_H / 2, fixed) : box(WALL_T, WALL_H, l, m, fixed, WALL_H / 2, mid))
    }
  }
  seg(true, room.z, room.x, room.x + room.w, side === 'n')
  seg(true, room.z + room.d, room.x, room.x + room.w, side === 's')
  seg(false, room.x, room.z, room.z + room.d, side === 'w')
  seg(false, room.x + room.w, room.z, room.z + room.d, side === 'e')
  return g
}

/** Materiais partilhados pelo mobiliário (um por cor, não um por peça) */
type Mats = { panel: THREE.Material; frame: THREE.Material; screen: THREE.Material; light: THREE.Material }

function cyl(r: number, h: number, m: THREE.Material, x: number, y: number, z: number, segments = 16) {
  const mesh = new THREE.Mesh(cylGeo(r, h, segments), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const place = (g: THREE.Group, item: OfficeItem) => {
  g.position.set(item.x, 0, item.z)
  g.rotation.y = -THREE.MathUtils.degToRad(item.rot)
  return g
}

/**
 * Mesa, conforme o tipo e o tamanho. "top" é o material do tampo (o acabamento escolhido).
 * Com a rotação 0, a frente da mesa (onde se senta quem trabalha) é z+ e o monitor fica atrás.
 */
function desk(item: OfficeItem, m: Mats, top: THREE.Material) {
  const g = new THREE.Group()
  const { w, d, h } = itemSize(item)
  switch (deskStyle(item)) {
    case 'reuniao': {
      g.add(box(w, 0.04, d, top, 0, h, 0))
      // dois pés em painel, recolhidos das pontas
      for (const sx of [-1, 1]) {
        g.add(box(0.06, h - 0.02, d * 0.55, m.frame, sx * (w / 2 - Math.min(0.35, w / 5)), (h - 0.02) / 2, 0))
        g.add(box(0.1, 0.03, d * 0.75, m.frame, sx * (w / 2 - Math.min(0.35, w / 5)), 0.015, 0))
      }
      break
    }
    case 'redonda': {
      g.add(cyl(w / 2, 0.04, top, 0, h, 0, 40))
      g.add(cyl(0.05, h - 0.04, m.frame, 0, (h - 0.04) / 2, 0))
      g.add(cyl(Math.min(0.3, w / 3), 0.03, m.frame, 0, 0.015, 0, 24))
      break
    }
    case 'balcao': {
      // balcão de recepção: tampo alto, painel do lado de quem chega (z−) e uma bancada de trabalho
      g.add(box(w, 0.04, d, top, 0, h, 0))
      g.add(box(w, h - 0.02, 0.04, m.panel, 0, (h - 0.02) / 2, -d / 2 + 0.02))
      for (const sx of [-1, 1]) g.add(box(0.04, h - 0.02, d - 0.04, m.panel, sx * (w / 2 - 0.02), (h - 0.02) / 2, 0))
      g.add(box(w - 0.1, 0.03, d * 0.5, top, 0, 0.75, d / 4))
      g.add(box(0.5, 0.3, 0.025, m.screen, 0, 0.95, 0.02))
      break
    }
    default: {
      g.add(box(w, 0.03, d, top, 0, h, 0))
      // painéis laterais (as "pernas") e o painel do fundo
      for (const sx of [-1, 1]) g.add(box(0.03, h - 0.015, d - 0.04, m.panel, sx * (w / 2 - 0.03), (h - 0.015) / 2, 0))
      g.add(box(w - 0.1, 0.32, 0.02, m.panel, 0, h - 0.25, -d / 2 + 0.06))
      // um monitor por lugar, à frente de cada cadeira
      const screens = deskSeats(item)
      for (let k = 0; k < screens; k++) {
        const x = (k - (screens - 1) / 2) * (w / screens)
        const zs = -d / 2 + 0.15
        g.add(box(0.2, 0.012, 0.14, m.frame, x, h + 0.021, zs))
        g.add(box(0.04, 0.17, 0.03, m.frame, x, h + 0.1, zs - 0.02))
        const screen = box(0.58, 0.34, 0.025, m.screen, x, h + 0.33, zs)
        screen.rotation.x = -0.08
        g.add(screen)
        g.add(box(0.42, 0.015, 0.14, m.light, x, h + 0.022, Math.min(0.08, d / 2 - 0.1)))
      }
    }
  }
  return place(g, item)
}

/**
 * Cadeira, conforme o tipo. O assento (e o encosto) têm a cor de quem lá está. Com a rotação 0,
 * o encosto fica atrás (z+) e a pessoa vira-se para z− (para a mesa).
 */
function chair(item: OfficeItem, cushion: THREE.Material, m: Mats) {
  const g = new THREE.Group()
  const { h } = itemSize(item)
  switch (chairStyle(item)) {
    case 'simples': {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.03, h, 0.03, m.frame, sx * 0.19, h / 2, sz * 0.18))
      g.add(box(0.44, 0.05, 0.42, cushion, 0, h, 0))
      for (const sx of [-1, 1]) g.add(box(0.03, 0.42, 0.03, m.frame, sx * 0.19, h + 0.21, 0.19))
      g.add(box(0.42, 0.22, 0.03, cushion, 0, h + 0.3, 0.2))
      break
    }
    case 'poltrona': {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.04, 0.12, 0.04, m.frame, sx * 0.33, 0.06, sz * 0.3))
      g.add(box(0.8, 0.2, 0.72, cushion, 0, 0.22, 0))
      g.add(box(0.58, 0.1, 0.55, cushion, 0, h, -0.04))
      g.add(box(0.8, 0.5, 0.16, cushion, 0, 0.55, 0.28))
      for (const sx of [-1, 1]) g.add(box(0.11, 0.3, 0.72, cushion, sx * 0.345, 0.45, 0))
      break
    }
    case 'banco': {
      g.add(cyl(0.2, 0.025, m.frame, 0, 0.012, 0, 20))
      g.add(cyl(0.025, h - 0.04, m.frame, 0, (h - 0.04) / 2, 0))
      g.add(cyl(0.15, 0.015, m.frame, 0, 0.3, 0, 20))
      g.add(cyl(0.18, 0.06, cushion, 0, h, 0, 24))
      break
    }
    default: {
      // de escritório: base de 5 pés, coluna, assento, encosto e braços
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        const leg = box(0.22, 0.03, 0.035, m.frame, Math.cos(a) * 0.11, 0.07, Math.sin(a) * 0.11)
        leg.rotation.y = -a
        g.add(leg)
      }
      g.add(cyl(0.025, h - 0.12, m.frame, 0, (h + 0.06) / 2, 0, 12))
      g.add(box(0.46, 0.07, 0.44, cushion, 0, h, 0))
      const back = box(0.44, 0.48, 0.06, cushion, 0, h + 0.33, 0.21)
      back.rotation.x = -0.12
      g.add(back)
      g.add(box(0.06, 0.2, 0.03, m.frame, 0, h + 0.1, 0.22))
      for (const sx of [-1, 1]) g.add(box(0.05, 0.16, 0.26, m.frame, sx * 0.23, h + 0.12, 0.02))
    }
  }
  place(g, item)
  // as partes estofadas mudam de cor com quem lá está (sem refazer a cadeira)
  g.traverse(o => { o.userData.seatId = item.id; if (o instanceof THREE.Mesh && o.material === cushion) o.userData.cushion = true })
  return g
}

/**
 * O escritório em 3D: arrastar roda a vista, a roda (ou dois dedos) aproxima. As pessoas
 * sentadas aparecem por cima da cadeira com a foto e a cor do estado.
 */
export default function OfficeScene({ map, taken, meId, mode = 'view', selected, focus, onSeat, guideUrl, zoomOnClick = true, busyRooms, className = '' }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef(new Map<string, HTMLElement>())
  const three = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    world: THREE.Group
    anchors: Map<string, THREE.Vector3>
    goal: { target: THREE.Vector3; pos: THREE.Vector3 } | null
    /** pede um desenho novo (a cena só é desenhada quando algo muda) */
    invalidate: (shadows?: boolean) => void
    /** materiais criados ao montar o escritório (libertados quando o mapa muda) */
    built: THREE.Material[]
    /** materiais dos assentos por cor, e os realces das mesas escolhidas (vivem com a cena) */
    cushions: Map<string, THREE.Material>
    highlights: Map<THREE.Material, THREE.Material>
  } | null>(null)
  const onSeatRef = useRef(onSeat)
  const [failed, setFailed] = useState(false)
  const zoomRef = useRef(zoomOnClick)
  useEffect(() => { onSeatRef.current = onSeat; zoomRef.current = zoomOnClick }, [onSeat, zoomOnClick])

  /* cena, câmara, luzes e ciclo de desenho (uma vez) */
  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      // sem WebGL (browser antigo ou desligado): fica a lista de salas e pessoas
      queueMicrotask(() => setFailed(true))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // o escritório não se mexe: as sombras só se recalculam quando a cena muda
    renderer.shadowMap.autoUpdate = false
    el.prepend(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#F4F3FA')
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.46
    controls.minDistance = 3
    controls.maxDistance = 220
    controls.screenSpacePanning = false

    scene.add(new THREE.HemisphereLight('#ffffff', '#d9d6e8', 1.6))
    const sun = new THREE.DirectionalLight('#ffffff', 1.4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    scene.add(sun, sun.target)

    const world = new THREE.Group()
    scene.add(world)
    let dirty = true
    const invalidate = (shadows = false) => {
      dirty = true
      if (shadows) renderer.shadowMap.needsUpdate = true
    }
    three.current = { renderer, scene, camera, controls, world, anchors: new Map(), goal: null, invalidate, built: [], cushions: new Map(), highlights: new Map() }
    controls.addEventListener('change', () => invalidate())

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${h}px`
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
      invalidate()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    // clique (sem arrastar) numa cadeira, mesa ou sala: escolhe a cadeira e aproxima a câmara
    const ray = new THREE.Raycaster()
    const under = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      // o mais próximo que se pode escolher (uma cadeira por cima do chão de uma sala ganha)
      return ray.intersectObjects(world.children, true).find(h => h.object.userData.seatId || h.object.userData.deskId || h.object.userData.roomId)?.object.userData
    }
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      const ud = under(e)
      const t = three.current
      if (!ud || !t) return
      const items = (world.userData.items ?? []) as OfficeItem[]
      const rooms = (world.userData.rooms ?? []) as OfficeRoom[]
      const zoom = zoomRef.current
      if (ud.seatId) {
        const seat = items.find(i => i.id === ud.seatId)
        if (!seat) return
        onSeatRef.current?.(seat)
        if (zoom) t.goal = goalFor(seat.x, seat.z, 4.5)
      } else if (ud.deskId && zoom) {
        const d = items.find(i => i.id === ud.deskId)
        if (d) t.goal = goalFor(d.x, d.z, 5)
      } else if (ud.roomId && zoom) {
        const room = rooms.find(x => x.id === ud.roomId)
        if (room) t.goal = roomGoal(room)
      }
    }
    // mãozinha por cima do que se pode escolher
    let last = 0
    const onHover = (e: PointerEvent) => {
      if (e.buttons || performance.now() - last < 60) return
      last = performance.now()
      const ud = under(e)
      renderer.domElement.style.cursor = ud && (ud.seatId || zoomRef.current) ? 'pointer' : 'grab'
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointermove', onHover)

    // desenha só quando algo mudou (câmara, dados, tamanho): parado, não gasta GPU nem bateria
    let raf = 0
    const v = new THREE.Vector3()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const t = three.current!
      if (t.goal) {
        controls.target.lerp(t.goal.target, 0.12)
        camera.position.lerp(t.goal.pos, 0.12)
        if (controls.target.distanceTo(t.goal.target) < 0.02) t.goal = null
        dirty = true
      }
      // com amortecimento, a câmara continua a deslizar uns instantes depois de largar
      if (controls.update()) dirty = true
      if (!dirty) return
      dirty = false
      renderer.render(scene, camera)
      // as fotos das pessoas e os nomes das salas acompanham a vista
      const w = el.clientWidth
      const h = el.clientHeight
      for (const [id, node] of labels.current) {
        const a = t.anchors.get(id)
        if (!a) continue
        v.copy(a).project(camera)
        const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
        node.style.opacity = visible ? '1' : '0'
        node.style.pointerEvents = visible ? '' : 'none'
        node.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
      }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onHover)
      controls.dispose()
      const t = three.current
      if (t) [...t.built, ...t.cushions.values(), ...t.highlights.values()].forEach(m => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose() })
      world.traverse(o => { if (o instanceof THREE.LineSegments) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } })
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  /* o escritório: só é refeito quando o mapa muda (quem está sentado muda as cores, ver abaixo) */
  useEffect(() => {
    const t = three.current
    if (!t) return
    const { world, camera, controls } = t
    // as geometrias são partilhadas (não se libertam); os materiais desta montagem sim
    t.built.forEach(m => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose() })
    t.built = []
    world.traverse(o => { if (o instanceof THREE.LineSegments) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } })
    world.clear()
    world.userData.items = map.items
    world.userData.rooms = map.rooms
    t.anchors.clear()
    const own = (m: THREE.Material) => { t.built.push(m); return m }

    // chão do piso (com a planta por baixo, se houver)
    const floorMat = own(mat('#FFFFFF')) as THREE.MeshStandardMaterial
    if (guideUrl) {
      new THREE.TextureLoader().load(guideUrl, tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        floorMat.map = tex
        floorMat.color.set('#ffffff')
        floorMat.opacity = 0.6
        floorMat.transparent = true
        floorMat.needsUpdate = true
        t.invalidate()
      })
    }
    const floor = new THREE.Mesh(boxGeo(map.width, 0.001, map.depth), floorMat)
    floor.position.set(map.width / 2, -0.001, map.depth / 2)
    floor.receiveShadow = true
    world.add(floor)
    const grid = new THREE.GridHelper(Math.max(map.width, map.depth), Math.max(map.width, map.depth), '#E3E1EE', '#EEEDF5')
    grid.position.set(map.width / 2, 0.002, map.depth / 2)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = guideUrl ? 0.25 : 0.7
    world.add(grid)

    // um material por cor (chão das salas, paredes, tampos das mesas)
    const byColor = new Map<string, THREE.Material>()
    const tinted = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) => {
      const key = `${color}:${opts.roughness ?? ''}`
      if (!byColor.has(key)) byColor.set(key, own(mat(color, opts)))
      return byColor.get(key)!
    }
    for (const r of [...map.rooms].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'corredor' ? -1 : 1))) {
      const slab = new THREE.Mesh(boxGeo(r.w, 0.02, r.d), tinted(r.color))
      slab.position.set(r.x + r.w / 2, r.kind === 'corredor' ? 0.005 : 0.012, r.z + r.d / 2)
      slab.receiveShadow = true
      if (r.kind === 'sala') slab.userData.roomId = r.id
      world.add(slab)
      if (r.kind === 'sala') {
        const w = walls(r, map, tinted(r.wallColor ?? '#FFFFFF', { roughness: 0.6 }))
        w.traverse(o => { o.userData.roomId = r.id })
        world.add(w)
      }
      t.anchors.set(`room:${r.id}`, new THREE.Vector3(r.x + r.w / 2, r.kind === 'sala' ? WALL_H + 0.2 : 0.3, r.z + 0.3))
    }

    const mats: Mats = {
      panel: own(mat('#ECEAF3', { roughness: 0.7 })),
      frame: own(mat('#3D3A52', { roughness: 0.5, metalness: 0.2 })),
      screen: own(mat('#1F1D2E', { roughness: 0.3, metalness: 0.1 })),
      light: own(mat('#D9D6E6')),
    }
    const placeholder = own(mat('#B9B5CC'))
    for (const it of map.items) {
      if (it.type === 'mesa') {
        const d = desk(it, mats, tinted(it.color ?? '#E3CFAE', { roughness: 0.55 }))
        d.traverse(o => {
          o.userData.deskId = it.id
          // o material original, para tirar o realce quando a mesa deixa de estar escolhida
          if (o instanceof THREE.Mesh) o.userData.base = o.material
        })
        world.add(d)
        continue
      }
      world.add(chair(it, placeholder, mats))
      t.anchors.set(it.id, new THREE.Vector3(it.x, itemSize(it).h + 0.95, it.z))
    }

    // sombra e câmara à medida do piso
    const span = Math.max(map.width, map.depth)
    const sun = t.scene.children.find(o => o instanceof THREE.DirectionalLight) as THREE.DirectionalLight
    sun.position.set(map.width * 0.3, span, map.depth * 0.1)
    sun.target.position.set(map.width / 2, 0, map.depth / 2)
    const cam = sun.shadow.camera
    cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span; cam.far = span * 4
    cam.updateProjectionMatrix()
    // a primeira vez que esta câmara vê o piso: vista geral de cima, em ângulo. Fica marcado na
    // própria câmara (no modo de desenvolvimento o React monta tudo duas vezes e a câmara nova
    // ficava no chão, num canto do piso)
    if (!camera.userData.placed) {
      camera.userData.placed = true
      controls.target.set(map.width / 2, 0, map.depth / 2)
      camera.position.set(map.width / 2, span * 0.85, map.depth / 2 + span * 0.75)
    }
    t.invalidate(true)
  }, [map, guideUrl])

  /* cores: cada assento com a cor de quem lá está (ou livre / escolhido) e a mesa escolhida realçada */
  useEffect(() => {
    const t = three.current
    if (!t) return
    const cushion = (color: string, picked: boolean) => {
      const key = `${color}${picked ? '*' : ''}`
      if (!t.cushions.has(key)) t.cushions.set(key, mat(color, { roughness: 0.9, emissive: picked ? '#3b2bb0' : '#000000', emissiveIntensity: picked ? 0.25 : 0 }))
      return t.cushions.get(key)!
    }
    const highlight = (base: THREE.Material) => {
      if (!t.highlights.has(base)) {
        const h = (base as THREE.MeshStandardMaterial).clone()
        h.emissive.set('#3b2bb0')
        h.emissiveIntensity = 0.3
        t.highlights.set(base, h)
      }
      return t.highlights.get(base)!
    }
    t.world.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return
      if (o.userData.cushion) {
        const id = o.userData.seatId as string
        const who = taken.get(id)
        const picked = id === selected
        o.material = cushion(picked ? '#7B61FF' : who ? PRESENCE_CONFIG[who.presence].color : mode === 'pick' ? '#12B5A6' : '#B9B5CC', picked)
      } else if (o.userData.base) {
        o.material = o.userData.deskId === selected ? highlight(o.userData.base) : o.userData.base
      }
    })
    t.invalidate(true)
  }, [map, guideUrl, taken, selected, mode])

  /* virar a câmara para uma cadeira ou sala */
  useEffect(() => {
    const t = three.current
    if (!t || !focus) return
    t.goal = goalFor(focus.x, focus.z, focus.zoom ?? 9)
  }, [focus])

  const reset = () => {
    const t = three.current
    if (!t) return
    const span = Math.max(map.width, map.depth)
    t.goal = { target: new THREE.Vector3(map.width / 2, 0, map.depth / 2), pos: new THREE.Vector3(map.width / 2, span * 0.85, map.depth / 2 + span * 0.75) }
  }
  const top = () => {
    const t = three.current
    if (!t) return
    const span = Math.max(map.width, map.depth)
    t.goal = { target: new THREE.Vector3(map.width / 2, 0, map.depth / 2), pos: new THREE.Vector3(map.width / 2, span * 1.25, map.depth / 2 + 0.01) }
  }

  if (failed) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border-2 border-line bg-snow p-6 text-center text-sm font-semibold text-muted ${className}`}>
        Este browser não consegue mostrar o mapa em 3D. Usa a lista de salas para escolher o teu lugar.
      </div>
    )
  }

  const seats = map.items.filter(i => i.type === 'cadeira')
  return (
    <div ref={host} className={`relative overflow-hidden rounded-2xl border-2 border-line bg-snow ${className}`}>
      {/* nomes das salas */}
      {map.rooms.filter(r => r.kind === 'sala').map(r => {
        const busy = busyRooms?.get(r.id)
        return (
          <button
            key={r.id}
            ref={n => { if (n) labels.current.set(`room:${r.id}`, n); else labels.current.delete(`room:${r.id}`) }}
            onClick={() => { if (zoomOnClick && three.current) three.current.goal = roomGoal(r) }}
            className={`absolute left-0 top-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-extrabold shadow-sm transition-opacity ${
              busy ? 'bg-brand text-white' : 'bg-white/85 text-ink'
            } ${zoomOnClick ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'}`}
            style={{ opacity: 0 }}
            title={zoomOnClick ? `Aproximar de ${r.name}` : undefined}
          >
            {r.name}
            {busy && <span className="block text-[10px] font-bold opacity-90">{busy}</span>}
          </button>
        )
      })}
      {/* quem está sentado */}
      {seats.map(s => {
        const who = taken.get(s.id)
        if (!who) return null
        const mine = who.id === meId
        return (
          <button
            key={s.id}
            ref={n => { if (n) labels.current.set(s.id, n); else labels.current.delete(s.id) }}
            onClick={() => { onSeat?.(s); if (zoomOnClick && three.current) three.current.goal = goalFor(s.x, s.z, 4.5) }}
            className="absolute left-0 top-0 flex flex-col items-center transition-opacity cursor-pointer"
            style={{ opacity: 0 }}
            title={`${who.name} · ${s.label} · ${PRESENCE_CONFIG[who.presence].label}`}
          >
            <span className="rounded-full bg-white p-[2px] shadow-md" style={{ boxShadow: `0 0 0 3px ${PRESENCE_CONFIG[who.presence].color}` }}>
              <Avatar name={who.name} picture={who.picture} size={30} />
            </span>
            <span className={`mt-0.5 max-w-24 truncate rounded-md px-1.5 text-[10px] font-bold text-white ${mine ? 'bg-brand' : 'bg-ink/80'}`}>
              {mine ? 'Tu' : who.name.split(' ')[0]}
            </span>
          </button>
        )
      })}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button onClick={top} className="rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-body shadow-sm hover:bg-white cursor-pointer">Vista de cima</button>
        <button onClick={reset} className="rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-body shadow-sm hover:bg-white cursor-pointer">Ver tudo</button>
      </div>
    </div>
  )
}

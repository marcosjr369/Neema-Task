'use client'

import { useState } from 'react'
import {
  ArchiveIcon, ArrowRightIcon, CardsThreeIcon, CheckIcon, ClockIcon, CopyIcon, ImageIcon, LinkIcon, PlusIcon, PushPinIcon,
  SortAscendingIcon, TagIcon, UserIcon,
} from '@phosphor-icons/react'
import Popover, { MenuDivider, MenuItem, MenuTitle } from './Popover'
import { CopyPanel, CoverPanel, DatesPanel, LabelsPanel, MembersPanel, MovePanel } from './CardPanels'
import { LIST_COLORS, SORT_LABEL, openLists, type SortBy } from '../../lib/boards'
import type { BoardCard, BoardList, BoardPerson, BoardView } from '../../types'
import type { RunOp } from './useBoard'

type CardView = 'menu' | 'labels' | 'members' | 'cover' | 'dates' | 'move' | 'copy'

const CARD_TITLES: Record<CardView, string> = {
  menu: 'Cartão', labels: 'Etiquetas', members: 'Membros', cover: 'Capa', dates: 'Datas', move: 'Mover cartão', copy: 'Copiar cartão',
}

/** Acções rápidas de um cartão (o lápis que aparece ao passar o rato) */
export function CardMenu({ board, card, people, run, anchor, onClose, onOpen, onCopyLink }: {
  board: BoardView
  card: BoardCard
  people: BoardPerson[]
  run: RunOp
  anchor: DOMRect | null
  onClose: () => void
  onOpen: () => void
  onCopyLink: () => void
}) {
  const [view, setView] = useState<CardView>('menu')
  const props = { board, card, run, onDone: onClose }
  return (
    <Popover anchor={anchor} title={CARD_TITLES[view]} onClose={onClose} onBack={view === 'menu' ? undefined : () => setView('menu')}>
      {view === 'menu' && (
        <div>
          <MenuItem icon={<CardsThreeIcon size={18} />} onClick={onOpen}>Abrir cartão</MenuItem>
          <MenuItem icon={<TagIcon size={18} />} onClick={() => setView('labels')}>Editar etiquetas</MenuItem>
          <MenuItem icon={<UserIcon size={18} />} onClick={() => setView('members')}>Alterar membros</MenuItem>
          <MenuItem icon={<ImageIcon size={18} />} onClick={() => setView('cover')}>Alterar capa</MenuItem>
          <MenuItem icon={<ClockIcon size={18} />} onClick={() => setView('dates')}>Editar datas</MenuItem>
          <MenuItem icon={<ArrowRightIcon size={18} />} onClick={() => setView('move')}>Mover</MenuItem>
          <MenuItem icon={<CopyIcon size={18} />} onClick={() => setView('copy')}>Copiar cartão</MenuItem>
          <MenuItem icon={<LinkIcon size={18} />} onClick={() => { onCopyLink(); onClose() }}>Copiar link</MenuItem>
          <MenuDivider />
          <MenuItem icon={<ArchiveIcon size={18} />} onClick={() => { run({ type: 'card.archive', cardId: card.id, archived: true }); onClose() }}>Arquivar</MenuItem>
        </div>
      )}
      {view === 'labels' && <LabelsPanel {...props} />}
      {view === 'members' && <MembersPanel {...props} people={people} />}
      {view === 'cover' && <CoverPanel {...props} />}
      {view === 'dates' && <DatesPanel {...props} />}
      {view === 'move' && <MovePanel {...props} />}
      {view === 'copy' && <CopyPanel {...props} />}
    </Popover>
  )
}

type ListView = 'menu' | 'copy' | 'move'

/** Acções de uma lista (os três pontos no topo da lista) */
export function ListMenu({ board, list, run, anchor, onClose, onAddCard }: {
  board: BoardView
  list: BoardList
  run: RunOp
  anchor: DOMRect | null
  onClose: () => void
  onAddCard: () => void
}) {
  const [view, setView] = useState<ListView>('menu')
  const [title, setTitle] = useState(list.title)
  const lists = openLists(board)
  const [index, setIndex] = useState(Math.max(0, lists.findIndex(l => l.id === list.id)))
  const titles: Record<ListView, string> = { menu: 'Acções da lista', copy: 'Copiar lista', move: 'Mover lista' }

  return (
    <Popover anchor={anchor} title={titles[view]} onClose={onClose} onBack={view === 'menu' ? undefined : () => setView('menu')}>
      {view === 'menu' && (
        <div>
          <MenuItem icon={<PlusIcon size={18} />} onClick={() => { onAddCard(); onClose() }}>Adicionar cartão</MenuItem>
          <MenuItem icon={<CopyIcon size={18} />} onClick={() => setView('copy')}>Copiar lista</MenuItem>
          <MenuItem icon={<ArrowRightIcon size={18} />} onClick={() => setView('move')}>Mover lista</MenuItem>
          <MenuItem icon={<PushPinIcon size={18} />} onClick={() => { run({ type: 'list.pin', listId: list.id, pinned: !list.pinned }); onClose() }}>
            {list.pinned ? 'Desafixar lista' : 'Fixar lista'}
          </MenuItem>
          <MenuDivider />
          <MenuTitle>Cor da lista</MenuTitle>
          <div className="grid grid-cols-5 gap-2 px-2.5 py-1">
            {LIST_COLORS.map(c => (
              <button key={c} onClick={() => run({ type: 'list.update', listId: list.id, color: c })} aria-label={`Cor ${c}`}
                className="flex h-8 items-center justify-center rounded-lg text-white cursor-pointer" style={{ background: c }}>
                {list.color === c && <CheckIcon size={14} weight="bold" />}
              </button>
            ))}
            <button onClick={() => run({ type: 'list.update', listId: list.id, color: null })}
              className={`h-8 rounded-lg border-2 text-[11px] font-black text-muted cursor-pointer ${list.color ? 'border-line' : 'border-brand'}`}>Sem</button>
          </div>
          <MenuDivider />
          <MenuTitle>Ordenar cartões por</MenuTitle>
          {(Object.keys(SORT_LABEL) as SortBy[]).map(by => (
            <MenuItem key={by} icon={<SortAscendingIcon size={18} />} onClick={() => { run({ type: 'list.sort', listId: list.id, by }); onClose() }}>
              {SORT_LABEL[by]}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuItem icon={<ArchiveIcon size={18} />} onClick={() => { run({ type: 'list.archive', listId: list.id, archived: true }); onClose() }}>Arquivar esta lista</MenuItem>
        </div>
      )}
      {view === 'copy' && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="copy-list-title">Nome</label>
            <input id="copy-list-title" className="input py-2" value={title} autoFocus onChange={e => setTitle(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full py-2 text-sm" disabled={!title.trim()} onClick={() => {
            run({ type: 'list.copy', listId: list.id, title })
            onClose()
          }}>Criar lista</button>
        </div>
      )}
      {view === 'move' && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="move-list-pos">Posição</label>
            <select id="move-list-pos" className="input py-2" value={index} onChange={e => setIndex(Number(e.target.value))}>
              {lists.map((l, i) => <option key={l.id} value={i}>{i + 1}{l.id === list.id ? ' (actual)' : ''}</option>)}
            </select>
          </div>
          <button className="btn btn-primary w-full py-2 text-sm" onClick={() => {
            run({ type: 'list.move', listId: list.id, index })
            onClose()
          }}>Mover</button>
        </div>
      )}
    </Popover>
  )
}

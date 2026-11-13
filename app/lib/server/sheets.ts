import type { Access, Sheet, SheetView } from '../../types'
import { sharingInfo } from './sharing'

export function sheetView(sheet: Sheet, access: Access): SheetView {
  // o link só é mostrado a quem gere a partilha
  return { ...sheet, sharing: sharingInfo(sheet.sharing, access === 'owner') }
}

/** O que um visitante sem conta vê (link público ou senha) */
export function publicSheetView(sheet: Sheet): SheetView {
  return { ...sheet, ownerId: '', sharing: { visibility: sheet.sharing.visibility, hasPassword: !!sheet.sharing.password } }
}

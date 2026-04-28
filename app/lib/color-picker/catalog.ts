import { indexPantoneEntries } from './helpers'
import { RAW_PANTONE_COLORS } from './pantoneCatalog.data'
import type { PantoneIndexedColor } from './types'

const pantoneCatalog = indexPantoneEntries(RAW_PANTONE_COLORS)

export const loadPantoneCatalog = async (): Promise<
  readonly PantoneIndexedColor[]
> => pantoneCatalog

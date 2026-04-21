export type HexColor = string

export type RgbTuple = [number, number, number]

export type PantoneBook =
  | 'Fashion, Home + Interiors'
  | 'Metallic Coated'
  | 'Pastels & Neons'
  | 'Skin Tones'
  | 'Solid Coated'

export const PANTONE_BOOKS: readonly PantoneBook[] = [
  'Solid Coated',
  'Fashion, Home + Interiors',
  'Metallic Coated',
  'Pastels & Neons',
  'Skin Tones',
]

export type PantoneFamily =
  | 'Reds'
  | 'Oranges'
  | 'Yellows'
  | 'Greens'
  | 'Cyans & Teals'
  | 'Blues'
  | 'Purples & Violets'
  | 'Pinks & Magentas'
  | 'Neutrals & Grays'

export const PANTONE_FAMILIES: readonly PantoneFamily[] = [
  'Reds',
  'Oranges',
  'Yellows',
  'Greens',
  'Cyans & Teals',
  'Blues',
  'Purples & Violets',
  'Pinks & Magentas',
  'Neutrals & Grays',
]

export type PantoneCatalogEntry = {
  id: string
  label: string
  hex: HexColor
  book: PantoneBook
}

export type PantoneColor = PantoneCatalogEntry & {
  family: PantoneFamily
  rgb: RgbTuple
}

export type PantoneSelection = PantoneColor

export type PantoneQueryMode = 'color' | 'text'

export type ParsedColorQuery = {
  hex: HexColor
  rgb: RgbTuple
}

export type PantoneIndexedColor = PantoneColor & {
  oklab: readonly [number, number, number]
  order: number
  searchText: string
}

export type PantoneFamilyGroup = {
  colors: PantoneIndexedColor[]
  family: PantoneFamily
}

export type PantoneBookGroup = {
  book: PantoneBook
  colors: PantoneIndexedColor[]
}

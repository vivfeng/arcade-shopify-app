import {
  PANTONE_BOOKS,
  PANTONE_FAMILIES,
  type HexColor,
  type PantoneBook,
  type PantoneBookGroup,
  type PantoneCatalogEntry,
  type PantoneFamily,
  type PantoneFamilyGroup,
  type PantoneIndexedColor,
  type PantoneQueryMode,
  type ParsedColorQuery,
  type RgbTuple,
} from './types'

const compactNumber = (value: number): number =>
  Number.parseFloat(value.toFixed(6))

const normalizeHex = (value: string): HexColor | null => {
  const trimmed = value.trim()

  if (/^#?[0-9a-f]{6}$/i.test(trimmed)) {
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
    return normalized.toLowerCase()
  }

  if (/^#?[0-9a-f]{3}$/i.test(trimmed)) {
    const shortHex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
    const expanded = [...shortHex]
      .map((part) => `${part}${part}`)
      .join('')
      .toLowerCase()

    return `#${expanded}`
  }

  return null
}

export const rgbToHex = ([red, green, blue]: RgbTuple): HexColor => {
  const toHexPart = (value: number): string =>
    value.toString(16).padStart(2, '0').toLowerCase()

  return `#${toHexPart(red)}${toHexPart(green)}${toHexPart(blue)}`
}

export const hexToRgb = (value: HexColor): RgbTuple => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
]

export const parseColorQuery = (query: string): ParsedColorQuery | null => {
  const normalizedHex = normalizeHex(query)
  if (normalizedHex !== null) {
    return { hex: normalizedHex, rgb: hexToRgb(normalizedHex) }
  }

  const rgbMatch = query
    .trim()
    .match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)

  if (rgbMatch) {
    const values = rgbMatch.slice(1).map((part) => Number.parseInt(part, 10))
    if (values.every((value) => value >= 0 && value <= 255)) {
      const rgb: RgbTuple = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
      return { hex: rgbToHex(rgb), rgb }
    }
  }

  const commaSeparated = query
    .trim()
    .match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/)

  if (commaSeparated) {
    const values = commaSeparated
      .slice(1)
      .map((part) => Number.parseInt(part, 10))
    if (values.every((value) => value >= 0 && value <= 255)) {
      const rgb: RgbTuple = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
      return { hex: rgbToHex(rgb), rgb }
    }
  }

  return null
}

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const channelToLinear = (channel: number): number => {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

const rgbToOklab = ([red, green, blue]: RgbTuple): readonly [
  number,
  number,
  number,
] => {
  const linearRed = channelToLinear(red)
  const linearGreen = channelToLinear(green)
  const linearBlue = channelToLinear(blue)

  const l =
    0.4122214708 * linearRed +
    0.5363325363 * linearGreen +
    0.0514459929 * linearBlue
  const m =
    0.2119034982 * linearRed +
    0.6806995451 * linearGreen +
    0.1073969566 * linearBlue
  const s =
    0.0883024619 * linearRed +
    0.2817188376 * linearGreen +
    0.6299787005 * linearBlue

  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  return [
    compactNumber(
      0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    ),
    compactNumber(
      1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    ),
    compactNumber(
      0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    ),
  ]
}

const classifyPantoneFamily = (
  oklab: readonly [number, number, number],
): PantoneFamily => {
  const lightness = oklab[0]
  const a = oklab[1]
  const b = oklab[2]
  const chroma = Math.sqrt(a * a + b * b)

  if (
    chroma < 0.03 ||
    (lightness > 0.9 && chroma < 0.06) ||
    (lightness < 0.32 && chroma < 0.045)
  ) {
    return 'Neutrals & Grays'
  }

  let hue = (Math.atan2(b, a) * 180) / Math.PI
  if (hue < 0) {
    hue += 360
  }

  if (hue < 24 || hue >= 345) {
    return 'Reds'
  }
  if (hue < 74) {
    return 'Oranges'
  }
  if (hue < 112) {
    return 'Yellows'
  }
  if (hue < 170) {
    return 'Greens'
  }
  if (hue < 220) {
    return 'Cyans & Teals'
  }
  if (hue < 286) {
    return 'Blues'
  }
  if (hue < 325) {
    return 'Purples & Violets'
  }

  return 'Pinks & Magentas'
}

export const indexPantoneEntries = (
  entries: readonly PantoneCatalogEntry[],
): PantoneIndexedColor[] =>
  entries.map((entry, order) => {
    const hex = normalizeHex(entry.hex)
    if (hex === null) {
      throw new Error(`Invalid Pantone hex: ${entry.hex}`)
    }

    const rgb = hexToRgb(hex)
    const oklab = rgbToOklab(rgb)
    const family = classifyPantoneFamily(oklab)

    return {
      ...entry,
      family,
      hex,
      oklab,
      order,
      rgb,
      searchText: normalizeSearchText(
        `${entry.label} ${entry.book} ${family} ${hex} ${hex.slice(1)}`,
      ),
    }
  })

const getTextMatchRank = (
  color: PantoneIndexedColor,
  normalizedQuery: string,
): number => {
  const normalizedLabel = normalizeSearchText(color.label)
  const normalizedBook = normalizeSearchText(color.book)
  const normalizedFamily = normalizeSearchText(color.family)
  const normalizedHex = color.hex.slice(1)

  if (
    normalizedLabel === normalizedQuery ||
    normalizedBook === normalizedQuery ||
    normalizedFamily === normalizedQuery ||
    normalizedHex === normalizedQuery
  ) {
    return 0
  }

  if (
    normalizedLabel.startsWith(normalizedQuery) ||
    normalizedBook.startsWith(normalizedQuery) ||
    normalizedFamily.startsWith(normalizedQuery) ||
    normalizedHex.startsWith(normalizedQuery)
  ) {
    return 1
  }

  if (color.searchText.includes(normalizedQuery)) {
    return 2
  }

  return Number.POSITIVE_INFINITY
}

export const rankPantonesByDistance = (
  colors: readonly PantoneIndexedColor[],
  query: ParsedColorQuery,
): PantoneIndexedColor[] => {
  const targetOklab = rgbToOklab(query.rgb)

  return [...colors].sort((left, right) => {
    const leftExact = left.hex === query.hex
    const rightExact = right.hex === query.hex

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1
    }

    const leftDistance =
      (left.oklab[0] - targetOklab[0]) ** 2 +
      (left.oklab[1] - targetOklab[1]) ** 2 +
      (left.oklab[2] - targetOklab[2]) ** 2
    const rightDistance =
      (right.oklab[0] - targetOklab[0]) ** 2 +
      (right.oklab[1] - targetOklab[1]) ** 2 +
      (right.oklab[2] - targetOklab[2]) ** 2

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    return left.order - right.order
  })
}

export const searchPantones = (
  colors: readonly PantoneIndexedColor[],
  query: string,
  book: PantoneBook | null,
): { mode: PantoneQueryMode; results: PantoneIndexedColor[] } => {
  const bookFiltered =
    book === null ? colors : colors.filter((color) => color.book === book)
  const parsedColorQuery = parseColorQuery(query)

  if (parsedColorQuery !== null) {
    return {
      mode: 'color',
      results: rankPantonesByDistance(bookFiltered, parsedColorQuery),
    }
  }

  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length === 0) {
    return { mode: 'text', results: [...bookFiltered] }
  }

  return {
    mode: 'text',
    results: [...bookFiltered]
      .filter((color) => color.searchText.includes(normalizedQuery))
      .sort((left, right) => {
        const rankDifference =
          getTextMatchRank(left, normalizedQuery) -
          getTextMatchRank(right, normalizedQuery)

        if (rankDifference !== 0) {
          return rankDifference
        }

        return left.order - right.order
      }),
  }
}

export const groupPantonesByFamily = (
  colors: readonly PantoneIndexedColor[],
): PantoneFamilyGroup[] =>
  PANTONE_FAMILIES.reduce<PantoneFamilyGroup[]>((groups, family) => {
    const familyColors = colors.filter((color) => color.family === family)
    if (familyColors.length > 0) {
      groups.push({ colors: familyColors, family })
    }

    return groups
  }, [])

export const groupPantonesByBook = (
  colors: readonly PantoneIndexedColor[],
): PantoneBookGroup[] =>
  PANTONE_BOOKS.reduce<PantoneBookGroup[]>((groups, book) => {
    const bookColors = colors.filter((color) => color.book === book)
    if (bookColors.length > 0) {
      groups.push({ book, colors: bookColors })
    }

    return groups
  }, [])

export type CatalogBook = {
  id: string
  title: string
  author: string
  year: number
  language: string
  file: string
}

export type Chunk = {
  id: string
  text: string
}

export type Chapter = {
  number: number
  title: string
  summary?: string
  characters?: string[]
  location?: string
  chunks: Chunk[]
}

export type PreparedBook = CatalogBook & {
  overview: string
  main_characters: string[]
  chapters: Chapter[]
}

/** A retrieved fragment of the book, always traceable back to its chapter. */
export type Passage = {
  id: string
  kind: 'overview' | 'chapter-summary' | 'chunk'
  text: string
  chapterNumber: number | null
  chapterTitle: string | null
  characters: string[]
}

export type Source = {
  chapterNumber: number | null
  chapterTitle: string | null
  characters: string[]
}

export function passageSources(passages: Passage[]): Source[] {
  const byChapter = new Map<string, Source>()

  for (const passage of passages) {
    const key = String(passage.chapterNumber ?? 'overview')
    const existing = byChapter.get(key)

    if (existing) {
      for (const character of passage.characters) {
        if (!existing.characters.includes(character)) existing.characters.push(character)
      }
      continue
    }

    byChapter.set(key, {
      chapterNumber: passage.chapterNumber,
      chapterTitle: passage.chapterTitle,
      characters: [...passage.characters],
    })
  }

  return [...byChapter.values()]
}

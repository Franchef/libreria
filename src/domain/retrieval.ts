import MiniSearch from 'minisearch'
import type { Passage, PreparedBook } from './book'

const SEARCH_FIELDS = ['title', 'characters', 'location', 'text'] as const

const FIELD_BOOST = {
  characters: 4,
  title: 3,
  location: 2,
  text: 1,
}

const MAX_CHUNKS = 3
const CONTEXT_BUDGET = 3500

/** Raw scores do not separate on-topic from off-topic questions; term coverage does. */
const MIN_TERM_COVERAGE = 0.5
const COVERAGE_SAMPLE = 5
const STOP_WORDS = new Set([
  'about', 'are', 'che', 'come', 'cosa', 'della', 'delle', 'dello', 'di', 'does', 'for', 'from',
  'how', 'il', 'in', 'la', 'le', 'lo', 'of', 'per', 'qual', 'the', 'what', 'who', 'with', 'your', 'è',
  'chi', 'dove', 'quando', 'perche', 'perché', 'quale', 'quali', 'quanto', 'quanti', 'quante',
  'da', 'dal', 'dalla', 'dalle', 'dallo', 'dai', 'degli', 'dei', 'del', 'e', 'ed', 'ma', 'non',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle', 'where', 'when',
  'why', 'which', 'this', 'that', 'these', 'those',
])
const GENERIC_UNANCHORED_TERMS = new Set(['born', 'birth', 'nato', 'nata', 'nascita'])

type IndexedDocument = {
  id: string
  title: string
  characters: string
  location: string
  text: string
}
function toDocuments(book: PreparedBook): { documents: IndexedDocument[]; passages: Map<string, Passage> } {
  const documents: IndexedDocument[] = []
  const passages = new Map<string, Passage>()

  const overview: Passage = {
    id: 'overview',
    kind: 'overview',
    text: book.overview ?? '',
    chapterNumber: null,
    chapterTitle: null,
    characters: book.main_characters ?? [],
  }
  passages.set(overview.id, overview)
  documents.push({
    id: overview.id,
    title: book.title,
    characters: (book.main_characters ?? []).join(', '),
    location: '',
    text: overview.text,
  })

  for (const chapter of book.chapters) {
    const characters = chapter.characters ?? []

    // Chapter-level metadata is optional in the prepared data.
    if (chapter.summary) {
      const summary: Passage = {
        id: `chapter-${chapter.number}`,
        kind: 'chapter-summary',
        text: chapter.summary,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        characters,
      }
      passages.set(summary.id, summary)
      documents.push({
        id: summary.id,
        title: chapter.title,
        characters: characters.join(', '),
        location: chapter.location ?? '',
        text: chapter.summary,
      })
    }

    for (const chunk of chapter.chunks) {
      const passage: Passage = {
        id: `${chapter.number}:${chunk.id}`,
        kind: 'chunk',
        text: chunk.text,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        characters,
      }
      passages.set(passage.id, passage)
      documents.push({
        id: passage.id,
        title: '',
        characters: characters.join(', '),
        location: chapter.location ?? '',
        text: chunk.text,
      })
    }
  }

  return { documents, passages }
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trimEnd()}…`
}

function contentTerms(query: string) {
  const words = query.toLowerCase().match(/\p{L}+/gu) ?? []
  return [...new Set(words.filter((word) => word.length >= 3 && !STOP_WORDS.has(word)))]
}

function searchableText(document: IndexedDocument) {
  return `${document.title} ${document.characters} ${document.location} ${document.text}`.toLowerCase()
}

function exactCoverage(document: IndexedDocument, terms: string[]) {
  if (terms.length === 0) return 0

  const words = new Set(searchableText(document).match(/\p{L}+/gu) ?? [])
  return terms.filter((term) => words.has(term)).length / terms.length
}

export type RetrievalResult = {
  passages: Passage[]
  relevant: boolean
}

export type BookIndex = {
  retrieve: (query: string) => RetrievalResult
}

export function createBookIndex(book: PreparedBook): BookIndex {
  const { documents, passages } = toDocuments(book)
  const documentsById = new Map(documents.map((document) => [document.id, document]))

  const miniSearch = new MiniSearch<IndexedDocument>({
    fields: [...SEARCH_FIELDS],
    storeFields: ['id'],
  })
  miniSearch.addAll(documents)

  function retrieve(query: string): RetrievalResult {
    const results = miniSearch.search(query, {
      boost: FIELD_BOOST,
      fuzzy: 0.2,
      prefix: true,
      combineWith: 'OR',
    })

    const terms = contentTerms(query)
    if (terms.length > 0 && terms.every((term) => GENERIC_UNANCHORED_TERMS.has(term))) {
      return { passages: [], relevant: false }
    }

    const matched = new Set(results.slice(0, COVERAGE_SAMPLE).flatMap((result) => result.terms))
    const coverage = terms.length === 0 ? 0 : terms.filter((term) => matched.has(term)).length / terms.length

    if (coverage < MIN_TERM_COVERAGE) return { passages: [], relevant: false }

    const minimumDocumentCoverage = terms.length <= 2 ? 1 : 0.67
    const ranked = results
      .filter((result) => {
        const document = documentsById.get(result.id)
        return document ? exactCoverage(document, terms) >= minimumDocumentCoverage : false
      })
      .map((result) => passages.get(result.id))
      .filter((passage): passage is Passage => Boolean(passage))

    if (ranked.length === 0) {
      const overview = passages.get('overview')
      return { passages: overview ? [overview] : [], relevant: true }
    }

    const selected: Passage[] = []
    const seen = new Set<string>()

    const focusChapter = ranked.find((passage) => passage.chapterNumber !== null)?.chapterNumber
    if (focusChapter !== undefined && focusChapter !== null) {
      const summary = passages.get(`chapter-${focusChapter}`)
      if (summary) {
        selected.push(summary)
        seen.add(summary.id)
      }
    }

    let chunkCount = 0
    for (const passage of ranked) {
      if (seen.has(passage.id)) continue
      if (passage.kind === 'chunk' && chunkCount >= MAX_CHUNKS) continue
      if (passage.kind === 'chunk') chunkCount += 1

      selected.push(passage)
      seen.add(passage.id)
      if (selected.length >= MAX_CHUNKS + 2) break
    }

    // Prefill on a 1.5B in-browser model is the slow path, so the context is hard-capped.
    const budgeted: Passage[] = []
    let used = 0
    for (const passage of selected) {
      if (used >= CONTEXT_BUDGET) break
      const text = truncate(passage.text, CONTEXT_BUDGET - used)
      budgeted.push({ ...passage, text })
      used += text.length
    }

    return { passages: budgeted, relevant: true }
  }

  return { retrieve }
}

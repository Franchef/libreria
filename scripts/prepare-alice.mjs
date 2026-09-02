import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const sourceUrl = 'https://www.gutenberg.org/files/11/11-0.txt'
const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const bookId = 'alice-adventures-in-wonderland'
const romanChapters = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
]
// Body headings render as "CHAPTER" + newline + "I." + newline + title (the
// Contents list instead has "CHAPTER I.    Title" on a single line), so the
// marker allows optional whitespace/newlines between the parts.
const chapterHeadingPattern = /CHAPTER[ \t]*\r?\n?[ \t]*([IVXLCDM]+)\.[ \t]*\r?\n?[ \t]*([^\r\n]*)/g

function normalizeSource(source) {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n')
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function normalizeForCoverage(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function createChunks(chapterText, chapterNumber) {
  const paragraphs = chapterText.split(/\n{2,}/).map((paragraph) => paragraph.replace(/\n+/g, ' ').trim()).filter(Boolean)
  const chunks = []
  let currentParagraphs = []
  let currentWordCount = 0

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph)
    if (currentWordCount >= 300 && currentWordCount + paragraphWords > 500) {
      chunks.push({
        id: `cap${chapterNumber}-p${chunks.length + 1}`,
        text: currentParagraphs.join('\n\n'),
      })
      currentParagraphs = []
      currentWordCount = 0
    }

    currentParagraphs.push(paragraph)
    currentWordCount += paragraphWords
  }

  if (currentParagraphs.length > 0) {
    chunks.push({
      id: `cap${chapterNumber}-p${chunks.length + 1}`,
      text: currentParagraphs.join('\n\n'),
    })
  }

  return chunks
}

function parseChapters(source) {
  const bodyEnd = source.search(/\n\s*THE END\s*\n/)
  if (bodyEnd === -1) {
    throw new Error('Unable to identify the end of the narrative in the source edition.')
  }

  const markers = [...source.matchAll(chapterHeadingPattern)]
  if (markers.length !== romanChapters.length * 2) {
    throw new Error(`Expected ${romanChapters.length * 2} chapter marker occurrences (contents + body), found ${markers.length}.`)
  }

  // The first half of the matches is the "Contents" list; the second half are the real body headings.
  const bodyMarkers = markers.slice(romanChapters.length)

  return bodyMarkers.map((marker, index) => {
    const chapterNumber = index + 1
    const expectedRoman = romanChapters[index]
    if (marker[1] !== expectedRoman) {
      throw new Error(`Expected chapter marker ${expectedRoman}, found ${marker[1]}.`)
    }

    const title = marker[2].trim()
    const start = marker.index + marker[0].length
    const end = bodyMarkers[index + 1]?.index ?? bodyEnd
    const text = source.slice(start, end).trim()

    if (!title || !text) {
      throw new Error(`Chapter ${chapterNumber} has no title or text.`)
    }

    return {
      number: chapterNumber,
      title,
      sourceText: text,
      chunks: createChunks(text, chapterNumber),
    }
  })
}

function verifyCoverage(chapters) {
  for (const chapter of chapters) {
    const chunkText = chapter.chunks.map((chunk) => chunk.text).join('\n\n')
    const hasUniqueChunkIds = new Set(chapter.chunks.map((chunk) => chunk.id)).size === chapter.chunks.length
    const hasCompleteCoverage = normalizeForCoverage(chunkText) === normalizeForCoverage(chapter.sourceText)
    if (!chunkText.trim() || !hasUniqueChunkIds || !hasCompleteCoverage) {
      throw new Error(`Invalid chunks for chapter ${chapter.number}.`)
    }
  }
}

const response = await fetch(sourceUrl)
if (!response.ok) {
  throw new Error(`Unable to download source: ${response.status} ${response.statusText}`)
}

const chapters = parseChapters(normalizeSource(await response.text()))
verifyCoverage(chapters)

const book = {
  id: bookId,
  title: 'Alice’s Adventures in Wonderland',
  author: 'Lewis Carroll',
  year: 1865,
  language: 'en',
  source: {
    provider: 'Project Gutenberg',
    ebookId: 11,
    url: sourceUrl,
  },
  chapters: chapters.map(({ sourceText, ...chapter }) => chapter),
}

const catalogPath = resolve(outputDirectory, 'catalogo.json')
const bookPath = resolve(outputDirectory, 'books', `${bookId}.json`)
await mkdir(dirname(bookPath), { recursive: true })

let catalog = []
try {
  catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
} catch {
  catalog = []
}

const catalogEntry = {
  id: book.id,
  title: book.title,
  author: book.author,
  year: book.year,
  language: book.language,
  file: `/data/books/${bookId}.json`,
}
const entryIndex = catalog.findIndex((entry) => entry.id === bookId)
if (entryIndex === -1) catalog.push(catalogEntry)
else catalog[entryIndex] = catalogEntry

await writeFile(bookPath, `${JSON.stringify(book, null, 2)}\n`)
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
JSON.parse(await readFile(bookPath, 'utf8'))
JSON.parse(await readFile(catalogPath, 'utf8'))
console.log(`Prepared ${chapters.length} chapters and ${chapters.reduce((total, chapter) => total + chapter.chunks.length, 0)} chunks.`)

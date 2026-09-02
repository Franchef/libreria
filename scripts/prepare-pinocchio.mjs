import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const sourceUrl = 'https://www.gutenberg.org/files/52484/52484-0.txt'
const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const bookId = 'le-avventure-di-pinocchio'
const romanChapters = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
  'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII',
  'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI',
  'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI',
]
const chapterMarkers = new RegExp(`^\\s*(${romanChapters.join('|')})\\.\\s*$`, 'm')

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
  const bodyStart = source.search(/^\s*I\.\s*$/m)
  const bodyEnd = source.search(/^\s*FINE\.\s*$/m)
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    throw new Error('Unable to identify the narrative boundaries in the source edition.')
  }

  const body = source.slice(bodyStart, bodyEnd).trim()
  const markers = [...body.matchAll(new RegExp(chapterMarkers.source, 'gm'))]
  if (markers.length !== romanChapters.length) {
    throw new Error(`Expected ${romanChapters.length} chapter markers, found ${markers.length}.`)
  }

  return markers.map((marker, index) => {
    const chapterNumber = index + 1
    const start = marker.index + marker[0].length
    const end = markers[index + 1]?.index ?? body.length
    const chapterBody = body.slice(start, end).trim()
    const titleEnd = chapterBody.search(/\n{2,}/)
    const title = chapterBody.slice(0, titleEnd).replace(/\n+/g, ' ').trim()
    const text = chapterBody.slice(titleEnd).trim()

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
  title: 'Le avventure di Pinocchio: Storia di un burattino',
  author: 'Carlo Collodi',
  year: 1883,
  language: 'it',
  source: {
    provider: 'Project Gutenberg',
    ebookId: 52484,
    url: sourceUrl,
    edition: 'Nuova edizione, R. Bemporad & Figlio, 1902',
  },
  overview: 'Le avventure di Pinocchio racconta la crescita di un burattino di legno creato dal povero falegname Geppetto. Impulsivo, curioso e disposto a credere alle promesse piu facili, Pinocchio fugge dal padre, trascura la scuola e rifiuta piu volte i consigli del Grillo-parlante. Le sue scelte lo portano a incontrare personaggi ingannevoli, come la Volpe e il Gatto, e a subire fame, prigionia e pericoli. La Fata dai capelli turchini e Geppetto gli offrono cura e affetto, senza sottrarlo alle conseguenze delle sue azioni. Dopo essere stato attirato nel Paese dei balocchi e trasformato in ciuchino, Pinocchio comprende il valore dello studio, del lavoro e della responsabilita. Il ricongiungimento con Geppetto e il suo impegno nel sostenerlo segnano il cambiamento definitivo. La trasformazione finale in un ragazzo rappresenta il compimento di un percorso morale dall egoismo alla generosita, dalla menzogna alla sincerita e dall irresponsabilita alla maturita.',
  main_characters: ['Pinocchio', 'Geppetto', 'La Fata dai capelli turchini', 'Il Grillo-parlante', 'La Volpe', 'Il Gatto', 'Lucignolo'],
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

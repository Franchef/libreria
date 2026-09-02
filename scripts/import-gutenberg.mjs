import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outputDirectory = resolve('public', 'data')
const catalogPath = resolve(outputDirectory, 'catalogo.json')
const useOllama = process.argv.includes('--ollama')

const books = [
  { id: 'i-promessi-sposi', title: 'I Promessi Sposi', author: 'Alessandro Manzoni', year: 1827, language: 'it', ebookId: 45334 },
  { id: 'la-divina-commedia', title: 'La Divina Commedia', author: 'Dante Alighieri', year: 1320, language: 'it', ebookId: 1012 },
  { id: 'orlando-furioso', title: 'Orlando Furioso', author: 'Ludovico Ariosto', year: 1516, language: 'it', ebookId: 615 },
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, language: 'en', ebookId: 1342 },
  { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', year: 1818, language: 'en', ebookId: 84 },
  { id: 'dracula', title: 'Dracula', author: 'Bram Stoker', year: 1897, language: 'en', ebookId: 345 },
  { id: 'the-adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', year: 1892, language: 'en', ebookId: 1661 },
  { id: 'moby-dick', title: 'Moby-Dick', author: 'Herman Melville', year: 1851, language: 'en', ebookId: 2701 },
  { id: 'the-picture-of-dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', year: 1890, language: 'en', ebookId: 174 },
  { id: 'the-adventures-of-tom-sawyer', title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', year: 1876, language: 'en', ebookId: 74 },
  { id: 'adventures-of-huckleberry-finn', title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', year: 1884, language: 'en', ebookId: 76 },
  { id: 'wuthering-heights', title: 'Wuthering Heights', author: 'Emily Bronte', year: 1847, language: 'en', ebookId: 768 },
  { id: 'the-strange-case-of-dr-jekyll-and-mr-hyde', title: 'The Strange Case of Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson', year: 1886, language: 'en', ebookId: 43 },
  { id: 'treasure-island', title: 'Treasure Island', author: 'Robert Louis Stevenson', year: 1883, language: 'en', ebookId: 120 },
  { id: 'little-women', title: 'Little Women', author: 'Louisa May Alcott', year: 1868, language: 'en', ebookId: 37106 },
  { id: 'the-wonderful-wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', year: 1900, language: 'en', ebookId: 55 },
]

function normalizeSource(source) {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n')
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function createChunks(text, chapterNumber) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.replace(/\n+/g, ' ').trim()).filter(Boolean)
  const chunks = []
  let current = []
  let words = 0
  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph)
    if (words >= 300 && words + paragraphWords > 500) {
      chunks.push({ id: `cap${chapterNumber}-p${chunks.length + 1}`, text: current.join('\n\n') })
      current = []
      words = 0
    }
    current.push(paragraph)
    words += paragraphWords
  }
  if (current.length) chunks.push({ id: `cap${chapterNumber}-p${chunks.length + 1}`, text: current.join('\n\n') })
  return chunks
}

function findChapters(source) {
  const body = source.replace(/^[\s\S]*?\n\s*(?:CHAPTER|Chapter|CANTO|Canto)\s+(?:I|1)\.?\s*\n/m, (match) => match.slice(-match.match(/(?:CHAPTER|Chapter|CANTO|Canto)\s+(?:I|1)\.?\s*\n/m)[0].length))
  const lines = body.split('\n')
  const matches = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (/^(chapter|capitolo)\s+([ivxlcdm]+|\d+)\.?$/i.test(line) || /^(chapter|capitolo)\s+\d+\s*:/i.test(line) || /\b(canto|canto)\s+[ivxlcdm]+\b/i.test(line) || /^\s*[ivxlcdm]+\.\s+\S/i.test(line) || /^[A-Z][A-Z '’:-]{5,}$/.test(line)) {
      matches.push({ index, title: lines[index + 1]?.trim() || line })
    }
  }
  if (matches.length < 2) throw new Error('No reliable chapter headings found.')
  return matches.map((heading, index) => {
    const end = matches[index + 1]?.index ?? lines.length
    const text = lines.slice(heading.index + 1, end).join('\n').trim()
    return text ? { title: heading.title, text } : null
  }).filter(Boolean).map((chapter, index) => ({
    number: index + 1,
    title: chapter.title,
    text: chapter.text,
    chunks: createChunks(chapter.text, index + 1),
  }))
}

async function enrichWithOllama(book, chapters) {
  if (!useOllama) return { overview: `Full text of ${book.title} by ${book.author}.`, mainCharacters: [] }
  const prompt = `Return JSON only with keys overview and mainCharacters. Write a faithful 100-word overview and up to 12 main character names for ${book.title} by ${book.author}. Do not invent details.`
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5-coder:7b', prompt, stream: false, format: 'json' }),
  })
  if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`)
  const result = JSON.parse(await response.text())
  const metadata = JSON.parse(result.response)
  return { overview: metadata.overview, mainCharacters: metadata.mainCharacters }
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
for (const book of books) {
  const response = await fetch(`https://www.gutenberg.org/cache/epub/${book.ebookId}/pg${book.ebookId}.txt`)
  if (!response.ok) throw new Error(`${book.title}: source download failed (${response.status})`)
  const source = normalizeSource(await response.text())
  const chapters = findChapters(source)
  const metadata = await enrichWithOllama(book, chapters)
  const prepared = {
    id: book.id, title: book.title, author: book.author, year: book.year, language: book.language,
    source: { provider: 'Project Gutenberg', ebookId: book.ebookId, url: `https://www.gutenberg.org/ebooks/${book.ebookId}` },
    overview: metadata.overview, main_characters: metadata.mainCharacters,
    chapters: chapters.map(({ text, ...chapter }) => ({ ...chapter, summary: `Chapter ${chapter.number} of ${book.title}.`, characters: [], location: 'Not specified by the source edition.' })),
  }
  await writeFile(resolve(outputDirectory, 'books', `${book.id}.json`), `${JSON.stringify(prepared, null, 2)}\n`)
  const entry = { id: book.id, title: book.title, author: book.author, year: book.year, language: book.language, file: `/data/books/${book.id}.json` }
  const existing = catalog.findIndex((item) => item.id === book.id)
  if (existing === -1) catalog.push(entry)
  else catalog[existing] = entry
  console.log(`Prepared ${book.title}: ${chapters.length} chapters.`)
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
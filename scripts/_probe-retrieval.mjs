import { readFileSync } from 'node:fs'
import MiniSearch from 'minisearch'

const load = (id) => JSON.parse(readFileSync(`public/data/books/${id}.json`, 'utf8'))

function probe(book, query) {
  const docs = [{ id: 'overview', title: book.title, characters: (book.main_characters ?? []).join(', '), location: '', text: book.overview ?? '' }]
  for (const c of book.chapters) {
    if (c.summary) docs.push({ id: `c${c.number}`, title: c.title, characters: (c.characters ?? []).join(', '), location: c.location ?? '', text: c.summary })
    for (const k of c.chunks) docs.push({ id: `${c.number}:${k.id}`, title: c.title, characters: (c.characters ?? []).join(', '), location: c.location ?? '', text: k.text })
  }
  const ms = new MiniSearch({ fields: ['title', 'characters', 'location', 'text'], storeFields: ['id'] })
  ms.addAll(docs)
  const results = ms.search(query, { boost: { characters: 4, title: 3, location: 2, text: 1 }, fuzzy: 0.2, prefix: true, combineWith: 'OR' })

  const terms = [...new Set((query.toLowerCase().match(/\p{L}+/gu) ?? []).filter((t) => t.length > 3))]
  const matched = new Set(results.slice(0, 5).flatMap((r) => r.terms))
  const covered = terms.filter((t) => matched.has(t))

  console.log(
    String(Math.round((results[0]?.score ?? 0) * 10) / 10).padStart(7),
    String(results.length).padStart(5),
    `${String(terms.length ? Math.round((100 * covered.length) / terms.length) : 0).padStart(3)}%`,
    ' ', query,
  )
}

const pinocchio = load('le-avventure-di-pinocchio')
const alice = load('alice-adventures-in-wonderland')

console.log('  score  hits  cov   query')
probe(pinocchio, 'Chi è Geppetto e cosa fa con il pezzo di legno?')
probe(pinocchio, 'Perché al burattino cresce il naso?')
probe(pinocchio, 'Chi è la Fata dai capelli turchini?')
probe(pinocchio, 'Quanto costa un biglietto aereo per Tokyo?')
probe(pinocchio, 'Qual è la capitale della Francia?')
probe(alice, 'Who is the Cheshire Cat?')
probe(alice, 'What happens at the Mad Tea-Party?')
probe(alice, 'What is the current price of Bitcoin?')
probe(alice, 'How do I install Docker on Windows?')

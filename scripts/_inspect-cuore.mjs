import { readFileSync, writeFileSync } from 'node:fs'

const xml = readFileSync(process.env.TEMP + '/cuore-real-extracted/content.xml', 'utf8')

// Convert paragraph/heading boundaries to newlines, then strip remaining tags.
let text = xml
  .replace(/<text:p[^>]*>/g, '\n')
  .replace(/<text:h[^>]*>/g, '\n\n')
  .replace(/<text:line-break\s*\/>/g, '\n')
  .replace(/<text:tab\s*\/>/g, '\t')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")

writeFileSync(process.env.TEMP + '/cuore-plain.txt', text)
console.log('length', text.length)
console.log(text.slice(0, 3000))

import { readFileSync } from 'node:fs'

const xml = readFileSync(process.env.TEMP + '/cuore-real-extracted/content.xml', 'utf8')

const headingRe = /<text:h ([^>]*)>(.*?)<\/text:h>/gs
let m
let count = 0
const headings = []
while ((m = headingRe.exec(xml))) {
  const attrs = m[1]
  const levelMatch = attrs.match(/text:outline-level="(\d+)"/)
  const level = levelMatch ? levelMatch[1] : '?'
  const inner = m[2].replace(/<[^>]+>/g, '').trim()
  count++
  headings.push({ count, level, inner, index: m.index })
}
console.log('total headings', count)
console.log('--- L1 headings ---')
for (const h of headings.filter((h) => h.level === '1')) console.log(h.count, JSON.stringify(h.inner), 'at', h.index)
console.log('--- last 15 headings ---')
for (const h of headings.slice(-15)) console.log(h.count, 'L' + h.level, JSON.stringify(h.inner), 'at', h.index)


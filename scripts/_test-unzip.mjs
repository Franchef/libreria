import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

// Minimal ZIP reader (ODT files are standard ZIP archives) supporting store (0) and deflate (8).
function readZipEntry(buffer, entryName) {
  const eocdSignature = 0x06054b50
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP archive (EOCD not found).')

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16)
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)

  let offset = centralDirOffset
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Malformed central directory entry.')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)

    if (fileName === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error('Malformed local file header.')
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize)
      if (method === 0) return compressedData
      if (method === 8) return inflateRawSync(compressedData)
      throw new Error(`Unsupported ZIP compression method ${method} for entry ${entryName}.`)
    }

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  throw new Error(`Entry ${entryName} not found in ZIP archive.`)
}

const odt = readFileSync('C:/Users/francesco.carbone_am/AppData/Local/Temp/cuore-real.odt')
const xml = readZipEntry(odt, 'content.xml').toString('utf8')
console.log('xml length', xml.length)
console.log(xml.slice(0, 200))

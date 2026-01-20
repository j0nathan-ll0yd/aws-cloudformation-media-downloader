/**
 * ZIP Utilities
 *
 * Utilities for creating ZIP buffers in memory for Lambda deployment.
 */

/* eslint-disable no-bitwise -- Bitwise operations required for ZIP format */

/**
 * Creates a minimal ZIP buffer from a map of filenames to contents.
 * This is a simplified implementation for LocalStack testing.
 *
 * @param files - Map of filename to file content
 * @returns Buffer containing the ZIP file
 */
export async function createZipBuffer(files: Record<string, string>): Promise<Uint8Array> {
  const entries = Object.entries(files)
  if (entries.length !== 1) {
    throw new Error('createZipBuffer currently only supports single file')
  }

  const [filename, content] = entries[0]

  // Create a valid ZIP file structure
  // ZIP file format: local file header + data + central directory + end of central directory

  const fileNameBuffer = Buffer.from(filename, 'utf-8')
  const fileDataBuffer = Buffer.from(content, 'utf-8')

  const date = new Date()
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff

  // Calculate CRC32
  const crc = crc32(fileDataBuffer)

  // Local file header
  const localHeader = Buffer.alloc(30 + fileNameBuffer.length)
  localHeader.writeUInt32LE(0x04034b50, 0) // Local file header signature
  localHeader.writeUInt16LE(20, 4) // Version needed to extract
  localHeader.writeUInt16LE(0, 6) // General purpose bit flag
  localHeader.writeUInt16LE(0, 8) // Compression method (0 = stored)
  localHeader.writeUInt16LE(dosTime, 10) // Last mod time
  localHeader.writeUInt16LE(dosDate, 12) // Last mod date
  localHeader.writeUInt32LE(crc, 14) // CRC-32
  localHeader.writeUInt32LE(fileDataBuffer.length, 18) // Compressed size
  localHeader.writeUInt32LE(fileDataBuffer.length, 22) // Uncompressed size
  localHeader.writeUInt16LE(fileNameBuffer.length, 26) // Filename length
  localHeader.writeUInt16LE(0, 28) // Extra field length
  fileNameBuffer.copy(localHeader, 30)

  // Central directory header
  const centralHeader = Buffer.alloc(46 + fileNameBuffer.length)
  const localHeaderOffset = 0

  centralHeader.writeUInt32LE(0x02014b50, 0) // Central directory signature
  centralHeader.writeUInt16LE(20, 4) // Version made by
  centralHeader.writeUInt16LE(20, 6) // Version needed to extract
  centralHeader.writeUInt16LE(0, 8) // General purpose bit flag
  centralHeader.writeUInt16LE(0, 10) // Compression method
  centralHeader.writeUInt16LE(dosTime, 12) // Last mod time
  centralHeader.writeUInt16LE(dosDate, 14) // Last mod date
  centralHeader.writeUInt32LE(crc, 16) // CRC-32
  centralHeader.writeUInt32LE(fileDataBuffer.length, 20) // Compressed size
  centralHeader.writeUInt32LE(fileDataBuffer.length, 24) // Uncompressed size
  centralHeader.writeUInt16LE(fileNameBuffer.length, 28) // Filename length
  centralHeader.writeUInt16LE(0, 30) // Extra field length
  centralHeader.writeUInt16LE(0, 32) // File comment length
  centralHeader.writeUInt16LE(0, 34) // Disk number start
  centralHeader.writeUInt16LE(0, 36) // Internal file attributes
  centralHeader.writeUInt32LE(0, 38) // External file attributes
  centralHeader.writeUInt32LE(localHeaderOffset, 42) // Relative offset of local header
  fileNameBuffer.copy(centralHeader, 46)

  // End of central directory record
  const centralDirOffset = localHeader.length + fileDataBuffer.length
  const centralDirSize = centralHeader.length
  const endOfCentralDir = Buffer.alloc(22)

  endOfCentralDir.writeUInt32LE(0x06054b50, 0) // End of central dir signature
  endOfCentralDir.writeUInt16LE(0, 4) // Number of this disk
  endOfCentralDir.writeUInt16LE(0, 6) // Disk where central directory starts
  endOfCentralDir.writeUInt16LE(1, 8) // Number of central directory records on this disk
  endOfCentralDir.writeUInt16LE(1, 10) // Total number of central directory records
  endOfCentralDir.writeUInt32LE(centralDirSize, 12) // Size of central directory
  endOfCentralDir.writeUInt32LE(centralDirOffset, 16) // Offset of start of central directory
  endOfCentralDir.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([localHeader, fileDataBuffer, centralHeader, endOfCentralDir])
}

/**
 * Calculate CRC32 checksum
 */
function crc32(data: Buffer): number {
  let crc = 0xffffffff
  const table = getCrc32Table()

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

let crc32Table: number[] | null = null

function getCrc32Table(): number[] {
  if (crc32Table) {
    return crc32Table
  }

  crc32Table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    crc32Table[n] = c
  }

  return crc32Table
}

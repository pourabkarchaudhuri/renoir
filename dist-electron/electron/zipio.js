// Minimal zip writer/reader implemented from scratch (DEFLATE via zlib).
// Avoids native deps so install works on locked-down corp networks.
//
// Spec ref: PKZIP APPNOTE.TXT (versions 6.x). We support stored + deflate.
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosTime(d = new Date()) {
    const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
    const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
    return { time, date };
}
export function zipBuffer(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, 'utf8');
        const compressed = deflateRawSync(e.data);
        const useDeflate = compressed.length < e.data.length;
        const stored = useDeflate ? compressed : e.data;
        const crc = crc32(e.data);
        const { time, date } = dosTime();
        // Local file header
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(0, 6);
        lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
        lh.writeUInt16LE(time, 10);
        lh.writeUInt16LE(date, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(stored.length, 18);
        lh.writeUInt32LE(e.data.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        lh.writeUInt16LE(0, 28);
        localParts.push(lh, nameBuf, stored);
        // Central directory header
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0);
        ch.writeUInt16LE(0x031E, 4); // version made by — Unix
        ch.writeUInt16LE(20, 6);
        ch.writeUInt16LE(0, 8);
        ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
        ch.writeUInt16LE(time, 12);
        ch.writeUInt16LE(date, 14);
        ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(stored.length, 20);
        ch.writeUInt32LE(e.data.length, 24);
        ch.writeUInt16LE(nameBuf.length, 28);
        ch.writeUInt16LE(0, 30);
        ch.writeUInt16LE(0, 32);
        ch.writeUInt16LE(0, 34);
        ch.writeUInt16LE(0, 36);
        ch.writeUInt32LE(0, 38);
        ch.writeUInt32LE(offset, 42);
        centralParts.push(ch, nameBuf);
        offset += lh.length + nameBuf.length + stored.length;
    }
    const localBuf = Buffer.concat(localParts);
    const centralBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(localBuf.length, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([localBuf, centralBuf, eocd]);
}
export function unzipBuffer(buf) {
    const entries = [];
    let i = 0;
    while (i + 4 <= buf.length) {
        const sig = buf.readUInt32LE(i);
        if (sig !== 0x04034b50)
            break; // hit central directory
        const method = buf.readUInt16LE(i + 8);
        const compSize = buf.readUInt32LE(i + 18);
        const nameLen = buf.readUInt16LE(i + 26);
        const extraLen = buf.readUInt16LE(i + 28);
        const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
        const dataStart = i + 30 + nameLen + extraLen;
        const dataEnd = dataStart + compSize;
        const raw = buf.slice(dataStart, dataEnd);
        let data;
        if (method === 0)
            data = raw;
        else if (method === 8)
            data = inflateRawSync(raw);
        else {
            i = dataEnd;
            continue;
        }
        if (!name.endsWith('/'))
            entries.push({ name, data });
        i = dataEnd;
    }
    return entries;
}
export function writeZipToFile(filePath, entries) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, zipBuffer(entries));
}
export function readZipFromFile(filePath) {
    return unzipBuffer(fs.readFileSync(filePath));
}

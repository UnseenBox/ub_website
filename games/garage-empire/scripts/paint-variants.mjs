// Generate hue-shifted copies of Kenney's colormap so restored cars can get
// a genuinely new paint job. Near-grey texels (glass, tires, rims) are left
// alone, so only paint hues rotate. No dependencies (raw PNG codec).
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(b) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  t.copy(out, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length)
  return out
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let h = 0
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (mx === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hsl2rgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

const [src, out, degRaw] = process.argv.slice(2)
const shift = (Number(degRaw) / 360 + 1) % 1
const buf = readFileSync(src)
const w = buf.readUInt32BE(16)
const h = buf.readUInt32BE(20)
// concat IDATs
const parts = []
let o = 8
while (o < buf.length) {
  const len = buf.readUInt32BE(o)
  const type = buf.subarray(o + 4, o + 8).toString()
  if (type === 'IDAT') parts.push(buf.subarray(o + 8, o + 8 + len))
  o += 12 + len
  if (type === 'IEND') break
}
const raw = inflateSync(Buffer.concat(parts))
const bpp = 4
const stride = w * bpp
const out2 = Buffer.alloc(raw.length)
for (let y = 0; y < h; y++) {
  const ro = y * (stride + 1)
  const filter = raw[ro]
  const prev = y === 0 ? null : out2.subarray((y - 1) * stride, y * stride)
  for (let x = 0; x < stride; x++) {
    const i = ro + 1 + x
    const a = x >= bpp ? out2[y * stride + x - bpp] : 0
    const b2 = prev ? prev[x] : 0
    const c = prev && x >= bpp ? prev[x - bpp] : 0
    let v = raw[i]
    if (filter === 1) v = (v + a) & 0xff
    else if (filter === 2) v = (v + b2) & 0xff
    else if (filter === 3) v = (v + ((a + b2) >> 1)) & 0xff
    else if (filter === 4) {
      const pa = Math.abs(b2 - c), pb = Math.abs(a - c), pc = Math.abs(a + b2 - 2 * c)
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c
      v = (v + pr) & 0xff
    }
    out2[y * stride + x] = v
  }
}
// hue shift
for (let i = 0; i < w * h; i++) {
  const r = out2[i * 4], g = out2[i * 4 + 1], b = out2[i * 4 + 2]
  const [hh, ss, ll] = rgb2hsl(r, g, b)
  if (ss < 0.09 || ll < 0.06 || ll > 0.94) continue
  const [nr, ng, nb] = hsl2rgb((hh + shift) % 1, Math.min(1, ss * 1.05), ll)
  out2[i * 4] = nr; out2[i * 4 + 1] = ng; out2[i * 4 + 2] = nb
}
// refilter None + rebuild
const reframed = Buffer.alloc(h * (stride + 1))
for (let y = 0; y < h; y++) {
  reframed[y * (stride + 1)] = 0
  out2.copy(reframed, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(reframed)),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(out, png)
console.log('wrote', out, png.length, 'bytes')

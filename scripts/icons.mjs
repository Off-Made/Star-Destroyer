// Genera le icone PWA (PNG) dalla pixel art della nave, senza dipendenze esterne.
import fs from 'node:fs';
import zlib from 'node:zlib';

const SHIP = ['........','.......W','.......W','......WC','......WC','.....WBC','..R..WBC','..R.WWBC','..WWWBBC','.WWBWWBC','.WWBBWWW','WWW.BBWW','WW...BW.','W.....W.','......R.','........'];
const PAL = { W: [255,255,255], C: [56,232,255], B: [47,91,255], R: [255,47,69] };
const rows = SHIP.map((r) => r + [...r].reverse().join(''));

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pad) {
  const px = Math.floor((size * (1 - pad * 2)) / 16);
  const off = Math.floor((size - px * 16) / 2);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - off) / px), sy = Math.floor((y - off) / px);
      let c = [0, 0, 0];
      if (sx >= 0 && sy >= 0 && sx < 16 && sy < 16 && rows[sy][sx] !== '.') c = PAL[rows[sy][sx]];
      else if (((x * 7 + y * 13) % 211) === 0) c = [180, 190, 255]; // qualche stella
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync('public/icons', { recursive: true });
for (const [name, size, pad] of [['icon-180', 180, 0.12], ['icon-192', 192, 0.12], ['icon-512', 512, 0.12], ['maskable-512', 512, 0.22]]) {
  fs.writeFileSync(`public/icons/${name}.png`, png(size, pad));
}
console.log('icone generate in public/icons/');

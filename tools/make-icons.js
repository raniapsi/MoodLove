// Génère icon-192.png et icon-512.png : un coeur blanc sur un dégradé rose.
// Node pur (zlib), aucune dépendance. Relancer avec : node tools/make-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf){
  let c = 0xFFFFFFFF;
  for(let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data){
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Coeur implicite : (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
function insideHeart(x, y){
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}

function renderIcon(size){
  const SS = 3; // suréchantillonnage pour lisser les bords
  const scale = size * 0.31;
  const rows = [];

  for(let py = 0; py < size; py++){
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filtre "none"
    for(let px = 0; px < size; px++){
      // Dégradé de fond, en diagonale
      const t = (px / size + py / size) / 2;
      const bgR = Math.round(255 + (232 - 255) * t);
      const bgG = Math.round(143 + (74 - 143) * t);
      const bgB = Math.round(184 + (136 - 184) * t);

      let hits = 0;
      for(let sy = 0; sy < SS; sy++){
        for(let sx = 0; sx < SS; sx++){
          const fx = px + (sx + 0.5) / SS;
          const fy = py + (sy + 0.5) / SS;
          const x = (fx - size / 2) / scale;
          const y = (size * 0.53 - fy) / scale;
          if(insideHeart(x, y)) hits++;
        }
      }
      const alpha = hits / (SS * SS);
      const off = 1 + px * 3;
      row[off]     = Math.round(bgR + (255 - bgR) * alpha);
      row[off + 1] = Math.round(bgG + (251 - bgG) * alpha);
      row[off + 2] = Math.round(bgB + (248 - bgB) * alpha);
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // 8 bits par canal
  ihdr[9] = 2;  // couleur RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, '..');
[192, 512].forEach(size => {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, renderIcon(size));
  console.log('écrit', path.basename(file), fs.statSync(file).size, 'octets');
});

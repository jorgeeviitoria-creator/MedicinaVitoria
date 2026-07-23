#!/usr/bin/env node
/**
 * gerar-icones.js — gera os PNGs do PWA (fundo roxo + "V" branco), sem dependências.
 * Uso: node scripts/gerar-icones.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAIZ = path.resolve(__dirname, '..');
const ROXO = [109, 40, 217];   // #6D28D9
const BRANCO = [255, 255, 255];

/* ---- CRC32 (necessário para os chunks PNG) ---- */
const TABELA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

/* ---- distância de um ponto a um segmento (pra desenhar o "V") ---- */
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function gerar(tamanho, arquivo) {
  const s = tamanho;
  const esq = Math.round(s * 0.09); // espessura do traço
  // "V": dois segmentos partindo do topo até o vértice de baixo
  const ax = s * 0.32, ay = s * 0.29;
  const bx = s * 0.68, by = s * 0.29;
  const vx = s * 0.50, vy = s * 0.72;

  const linhas = [];
  for (let y = 0; y < s; y++) {
    const linha = Buffer.alloc(1 + s * 4); // 1 byte de filtro + RGBA
    linha[0] = 0;
    for (let x = 0; x < s; x++) {
      const d = Math.min(distSeg(x, y, ax, ay, vx, vy), distSeg(x, y, bx, by, vx, vy));
      // antialias simples na borda do traço
      const alpha = Math.max(0, Math.min(1, (esq - d) / 1.5));
      const cor = [
        Math.round(ROXO[0] + (BRANCO[0] - ROXO[0]) * alpha),
        Math.round(ROXO[1] + (BRANCO[1] - ROXO[1]) * alpha),
        Math.round(ROXO[2] + (BRANCO[2] - ROXO[2]) * alpha),
      ];
      const o = 1 + x * 4;
      linha[o] = cor[0]; linha[o + 1] = cor[1]; linha[o + 2] = cor[2]; linha[o + 3] = 255;
    }
    linhas.push(linha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(linhas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(RAIZ, arquivo), png);
  console.log('[ok]', arquivo, '(' + s + 'x' + s + ', ' + png.length + ' bytes)');
}

gerar(192, 'icone-192.png');
gerar(512, 'icone-512.png');

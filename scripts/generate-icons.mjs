#!/usr/bin/env node
/**
 * Generates valid 32-bit RGBA PNGs and Windows .ico files in src-tauri/icons/
 * Required by tauri-build and tauri-action on Windows & Linux CI runners.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const iconsDir = path.join(process.cwd(), 'src-tauri', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createRgbaPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type (required by Tauri v2)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  const radius = Math.floor(width * 0.22);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      // Rounded square mask
      let inside = true;
      if (x < radius && y < radius) {
        inside = Math.hypot(radius - x, radius - y) <= radius;
      } else if (x >= width - radius && y < radius) {
        inside = Math.hypot(x - (width - radius - 1), radius - y) <= radius;
      } else if (x < radius && y >= height - radius) {
        inside = Math.hypot(radius - x, y - (height - radius - 1)) <= radius;
      } else if (x >= width - radius && y >= height - radius) {
        inside = Math.hypot(x - (width - radius - 1), y - (height - radius - 1)) <= radius;
      }

      if (inside) {
        // WhatsApp Emerald #00A884
        raw[px] = 0x00;
        raw[px + 1] = 0xa8;
        raw[px + 2] = 0x84;
        raw[px + 3] = 0xff;
      } else {
        raw[px] = 0x00;
        raw[px + 1] = 0x00;
        raw[px + 2] = 0x00;
        raw[px + 3] = 0x00;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIcoFromPng(pngBuf, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = width >= 256 ? 0 : width;
  entry[1] = height >= 256 ? 0 : height;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuf]);
}

const png32 = createRgbaPng(32, 32);
const png128 = createRgbaPng(128, 128);
const png256 = createRgbaPng(256, 256);
const png512 = createRgbaPng(512, 512);
const ico = createIcoFromPng(png256, 256, 256);

fs.writeFileSync(path.join(iconsDir, '32x32.png'), png32);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), png128);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), png512);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);

console.log('Verified RGBA icons in src-tauri/icons/');

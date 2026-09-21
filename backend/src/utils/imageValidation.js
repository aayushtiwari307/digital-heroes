'use strict';

const MAGIC = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: Buffer.from([0xff, 0xd8, 0xff]),
  webp: Buffer.from('RIFF'),
};

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 8).equals(MAGIC.png)) return 'png';
  if (buffer.subarray(0, 3).equals(MAGIC.jpg)) return 'jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).equals(MAGIC.webp) && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function expectedMimeType(type) {
  return type === 'jpeg' ? 'image/jpeg' : type ? `image/${type}` : null;
}

module.exports = { MAGIC, detectImageType, expectedMimeType };

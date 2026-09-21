'use strict';
const {detectImageType,expectedMimeType}=require('../imageValidation');

describe('image content validation',()=>{
  test.each([
    [Buffer.from('89504e470d0a1a0a','hex'),'png','image/png'],
    [Buffer.from('ffd8ff001122','hex'),'jpeg','image/jpeg'],
    [Buffer.from('524946460000000057454250','hex'),'webp','image/webp'],
  ])('detects %s content and MIME mapping', (buffer,type,mime)=>{
    expect(detectImageType(buffer)).toBe(type);
    expect(expectedMimeType(type)).toBe(mime);
  });

  test('rejects mismatched or malformed image content',()=>{
    expect(detectImageType(Buffer.from('not-an-image'))).toBeNull();
    expect(expectedMimeType(null)).toBeNull();
  });
});

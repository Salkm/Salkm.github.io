import fs from "node:fs/promises";
import assert from "node:assert/strict";

const input = "artifacts/source-assets/character-base.glb";
const output = "public/character-runtime.glb";
const source = await fs.readFile(input);
assert.equal(source.readUInt32LE(0), 0x46546c67);
assert.equal(source.readUInt32LE(4), 2);
const jsonLength = source.readUInt32LE(12);
const document = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
assert.equal(document.buffers.length, 1);
assert.equal(document.extensionsUsed, undefined);
const binaryStart = 20 + jsonLength + 8;
const binary = source.subarray(binaryStart);
const imageViews = new Set(document.images.map((image) => image.bufferView));
const mapping = new Map();
const views = [];
const chunks = [];
let offset = 0;
for (const [index, view] of document.bufferViews.entries()) {
  if (imageViews.has(index)) continue;
  assert.equal(view.buffer, 0);
  const padding = (4 - offset % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  const bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  assert.equal(bytes.length, view.byteLength);
  mapping.set(index, views.length);
  views.push({ ...view, byteOffset: offset });
  chunks.push(bytes);
  offset += bytes.length;
}
function remap(view) {
  assert.ok(mapping.has(view), "Geometry must never reference an image buffer");
  return mapping.get(view);
}
for (const accessor of document.accessors) {
  if (accessor.bufferView !== undefined) accessor.bufferView = remap(accessor.bufferView);
  if (accessor.sparse) {
    accessor.sparse.indices.bufferView = remap(accessor.sparse.indices.bufferView);
    accessor.sparse.values.bufferView = remap(accessor.sparse.values.bufferView);
  }
}
for (const material of document.materials) {
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
  delete material.pbrMetallicRoughness?.baseColorTexture;
  delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
}
delete document.images;
delete document.textures;
delete document.samplers;
document.bufferViews = views;
document.buffers = [{ byteLength: offset }];
document.asset.extras = { optimization: "Unused texture images removed; geometry and skeleton buffers unchanged." };
let json = Buffer.from(JSON.stringify(document));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
let bin = Buffer.concat(chunks);
bin = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
await fs.writeFile(output, Buffer.concat([header, json, binHeader, bin]));
console.log(JSON.stringify({ input, output, originalBytes: source.length, optimizedBytes: header.length + json.length + 8 + bin.length, geometryViewsPreserved: views.length }));

import { open, stat, rename, unlink } from 'node:fs/promises';
import { closeSync, openSync, writeSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundlePath, loadSourceMap, mapLocation } from './profileSourceMaps.mjs';

const [inputPath, requestedOutputPath] = process.argv.slice(2);
if (!inputPath?.endsWith('.heapsnapshot')) {
  throw new Error('Usage: node scripts/mapHeapSnapshot.mjs <snapshot.heapsnapshot> [output.tsv]');
}
const outputPath = requestedOutputPath ?? inputPath.replace(/\.heapsnapshot$/, '.source-mapped-locations.tsv');
if (resolve(inputPath) === resolve(outputPath)) {
  throw new Error('The location index must have a different path from the snapshot');
}

// An imported snapshot has no live debugger connection. Chrome cannot link its
// script IDs to files, so emit an @objectId lookup table instead of modifying
// the object graph and producing a misleading .heapsnapshot file.
const markers = ['"nodes":[', '"edges":[', '"locations":[', '"strings":['];
const file = await open(inputPath, 'r');
const { size } = await stat(inputPath);

async function findSections() {
  const positions = new Map();
  const chunk = Buffer.allocUnsafe(4 * 1024 * 1024);
  let carry = Buffer.alloc(0);
  let offset = 0;
  while (offset < size && positions.size < markers.length) {
    const { bytesRead } = await file.read(chunk, 0, chunk.length, offset);
    if (!bytesRead) break;
    const search = Buffer.concat([carry, chunk.subarray(0, bytesRead)]);
    const base = offset - carry.length;
    for (const marker of markers) {
      if (positions.has(marker)) continue;
      const index = search.indexOf(marker);
      if (index >= 0) positions.set(marker, base + index);
    }
    carry = Buffer.from(search.subarray(Math.max(0, search.length - 32)));
    offset += bytesRead;
  }
  if (
    positions.size !== markers.length ||
    !(
      positions.get(markers[0]) < positions.get(markers[1]) &&
      positions.get(markers[1]) < positions.get(markers[2]) &&
      positions.get(markers[2]) < positions.get(markers[3])
    )
  ) {
    throw new Error('Unsupported or incomplete V8 heap snapshot sections');
  }
  return positions;
}

async function readAt(start, length) {
  const buffer = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await file.read(buffer, offset, length - offset, start + offset);
    if (!bytesRead) throw new Error('Heap snapshot ended unexpectedly');
    offset += bytesRead;
  }
  return buffer;
}

function parseNumbers(buffer, visit) {
  let value = 0;
  let inNumber = false;
  let count = 0;
  for (const byte of buffer) {
    if (byte >= 48 && byte <= 57) {
      value = value * 10 + byte - 48;
      inNumber = true;
    } else if (inNumber) {
      visit(value, count++);
      value = 0;
      inNumber = false;
    }
  }
  if (inNumber) visit(value, count++);
  return count;
}

try {
  const positions = await findSections();
  const nodeStart = positions.get(markers[0]);
  const header = (await readAt(0, nodeStart)).toString('utf8').replace(/,\s*$/, '');
  const { snapshot } = JSON.parse(`${header}}`);
  const nodeFields = snapshot.meta.node_fields;
  const locationFields = snapshot.meta.location_fields;
  const nodeNameOffset = nodeFields.indexOf('name');
  const nodeIdOffset = nodeFields.indexOf('id');
  const objectIndexOffset = locationFields.indexOf('object_index');
  const scriptIndexOffset = locationFields.indexOf('script_object_index');
  const scriptIdOffset = locationFields.indexOf('script_id');
  const lineOffset = locationFields.indexOf('line');
  const columnOffset = locationFields.indexOf('column');
  if (
    [nodeNameOffset, nodeIdOffset, objectIndexOffset, scriptIndexOffset, scriptIdOffset, lineOffset, columnOffset].some(
      offset => offset < 0
    )
  ) {
    throw new Error('Unsupported heap snapshot node or location fields');
  }

  const nodes = await readAt(nodeStart + markers[0].length, positions.get(markers[1]) - nodeStart - markers[0].length);
  const nodeNames = new Uint32Array(snapshot.node_count);
  const nodeIds = new Float64Array(snapshot.node_count);
  const nodeValues = parseNumbers(nodes, (value, index) => {
    const field = index % nodeFields.length;
    const nodeIndex = Math.floor(index / nodeFields.length);
    if (field === nodeNameOffset) nodeNames[nodeIndex] = value;
    if (field === nodeIdOffset) nodeIds[nodeIndex] = value;
  });
  if (nodeValues !== snapshot.node_count * nodeFields.length) {
    throw new Error('Heap snapshot node count does not match its metadata');
  }

  const stringStart = positions.get(markers[3]);
  const stringSection = await readAt(stringStart + '"strings":'.length, size - stringStart - '"strings":'.length);
  const strings = JSON.parse(stringSection.subarray(0, stringSection.lastIndexOf(93) + 1).toString('utf8'));

  const locationStart = positions.get(markers[2]);
  const locationSection = await readAt(
    locationStart + markers[2].length,
    stringStart - locationStart - markers[2].length
  );
  const locationValues = [];
  const count = parseNumbers(locationSection, value => locationValues.push(value));
  if (count % locationFields.length !== 0) throw new Error('Incomplete heap snapshot location table');

  const scriptPaths = new Map();
  const scriptMaps = new Map();
  const nodeWidth = nodeFields.length;
  for (let i = 0; i < count; i += locationFields.length) {
    const scriptIndex = locationValues[i + scriptIndexOffset];
    if (scriptPaths.has(scriptIndex)) continue;
    const scriptOrdinal = scriptIndex / nodeWidth;
    const name =
      Number.isInteger(scriptOrdinal) && scriptOrdinal < nodeNames.length
        ? strings[nodeNames[scriptOrdinal]]
        : undefined;
    const prefix = 'system / Script / ';
    const path =
      typeof name === 'string' && name.startsWith(prefix) ? bundlePath(name.slice(prefix.length)) : undefined;
    scriptPaths.set(scriptIndex, path);
    if (path && !scriptMaps.has(path)) scriptMaps.set(path, await loadSourceMap(path));
  }

  const temporaryPath = `${outputPath}.tmp`;
  const output = openSync(temporaryPath, 'w');
  let pending =
    'object_id\tobject_name\tscript_id\tgenerated_url\tgenerated_line\tgenerated_column\tsource_url\tsource_line\tsource_column\torigin\n';
  let mapped = 0;
  let ownSource = 0;
  const repoPackages = resolve(import.meta.dirname, '../packages');
  try {
    for (let i = 0; i < count; i += locationFields.length) {
      const scriptIndex = locationValues[i + scriptIndexOffset];
      const path = scriptPaths.get(scriptIndex);
      if (!path) continue;
      const mappedPosition = mapLocation(
        scriptMaps.get(path),
        path,
        locationValues[i + lineOffset],
        locationValues[i + columnOffset]
      );
      if (!mappedPosition) continue;
      const objectIndex = locationValues[i + objectIndexOffset];
      const ordinal = objectIndex / nodeWidth;
      if (!Number.isInteger(ordinal) || ordinal >= nodeIds.length) continue;
      let sourcePath;
      try {
        sourcePath = fileURLToPath(mappedPosition.url);
      } catch {
        sourcePath = '';
      }
      const rel = relative(repoPackages, sourcePath);
      const isOwnSource = sourcePath && !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('dist');
      if (isOwnSource) ownSource++;
      const objectName = JSON.stringify(strings[nodeNames[ordinal]] ?? '');
      pending +=
        `${nodeIds[ordinal]}\t${objectName}\t${locationValues[i + scriptIdOffset]}\t${path}\t` +
        `${locationValues[i + lineOffset] + 1}\t${locationValues[i + columnOffset] + 1}\t` +
        `${mappedPosition.url}\t${mappedPosition.lineNumber + 1}\t${mappedPosition.columnNumber + 1}\t` +
        `${isOwnSource ? 'repository' : 'dependency'}\n`;
      mapped++;
      if (pending.length >= 1024 * 1024) {
        writeSync(output, pending);
        pending = '';
      }
    }
    if (pending) writeSync(output, pending);
  } finally {
    closeSync(output);
  }
  if (mapped === 0) {
    await unlink(temporaryPath);
    throw new Error('No extension bundle snapshot locations could be mapped');
  }
  await rename(temporaryPath, outputPath);
  console.log(`Saved source-mapped heap snapshot locations: ${outputPath}`);
  console.log(`Mapped ${mapped} of ${count / locationFields.length} locations (${ownSource} in repository source).`);
  console.log('Find an object shown as @123 in Chrome with: rg "^123\\t" ' + outputPath);
} finally {
  await file.close();
}

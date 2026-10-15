import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { remapCallFrames } from './profileSourceMaps.mjs';

const [inputPath, requestedOutputPath] = process.argv.slice(2);
if (!inputPath?.endsWith('.heapprofile')) {
  throw new Error('Usage: node scripts/remapHeapProfile.mjs <profile.heapprofile> [output.heapprofile]');
}

const outputPath = requestedOutputPath ?? inputPath.replace(/\.heapprofile$/, '.source-mapped.heapprofile');
if (resolve(inputPath) === resolve(outputPath)) {
  throw new Error('The source-mapped profile must have a different path from the raw profile');
}

const profile = JSON.parse(await readFile(inputPath, 'utf8'));
if (!profile.head?.callFrame || !Array.isArray(profile.samples)) {
  throw new Error(`Invalid sampling heap profile: ${inputPath}`);
}

const frames = [];
const pending = [profile.head];
while (pending.length) {
  const node = pending.pop();
  frames.push(node.callFrame);
  pending.push(...(node.children ?? []));
}
const { mappedFrames, totalBundleFrames, mappedBundles } = await remapCallFrames(frames);
if (mappedFrames === 0) {
  throw new Error('No extension bundle frames could be mapped; the raw heap profile is still available');
}

// VS Code exports a second copy of some frames for its own source navigation.
// Keep those keys aligned with the rewritten sampling tree.
const metadataFrames = profile.$vscode?.locations?.map(location => location.callFrame).filter(Boolean) ?? [];
const metadata = await remapCallFrames(metadataFrames);

await writeFile(outputPath, JSON.stringify(profile));
console.log(`Saved source-mapped heap profile: ${outputPath}`);
console.log(`Mapped ${mappedFrames} of ${totalBundleFrames} heap frames across ${mappedBundles} bundle(s).`);
if (metadataFrames.length) {
  console.log(`Mapped ${metadata.mappedFrames} VS Code location metadata frames.`);
}

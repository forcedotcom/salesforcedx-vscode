import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { remapCallFrames } from './profileSourceMaps.mjs';

const [inputPath, requestedOutputPath] = process.argv.slice(2);
if (!inputPath?.endsWith('.cpuprofile')) {
  throw new Error('Usage: node scripts/remapCpuProfile.mjs <profile.cpuprofile> [output.cpuprofile]');
}

const outputPath = requestedOutputPath ?? inputPath.replace(/\.cpuprofile$/, '.source-mapped.cpuprofile');
if (resolve(inputPath) === resolve(outputPath)) {
  throw new Error('The source-mapped profile must have a different path from the raw profile');
}

const profile = JSON.parse(await readFile(inputPath, 'utf8'));
if (!Array.isArray(profile.nodes)) {
  throw new Error(`Invalid CPU profile: ${inputPath}`);
}

const originalLocations = profile.nodes.map(node => ({ node, url: node.callFrame?.url }));
const { mappedFrames, totalBundleFrames, mappedBundles } = await remapCallFrames(
  profile.nodes.map(node => node.callFrame)
);
for (const { node, url } of originalLocations) {
  if (node.callFrame?.url !== url) delete node.positionTicks;
}

if (mappedFrames === 0) {
  throw new Error('No extension bundle frames could be mapped; the raw CPU profile is still available');
}

const metadataFrames = profile.$vscode?.locations?.map(location => location.callFrame).filter(Boolean) ?? [];
const metadata = await remapCallFrames(metadataFrames);

await writeFile(outputPath, JSON.stringify(profile));
console.log(`Saved source-mapped CPU profile: ${outputPath}`);
console.log(
  `Mapped ${mappedFrames} of ${totalBundleFrames} extension bundle frames across ${mappedBundles} bundle(s).`
);
if (metadataFrames.length) {
  console.log(`Mapped ${metadata.mappedFrames} VS Code location metadata frames.`);
}

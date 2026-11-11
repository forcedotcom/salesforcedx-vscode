import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const testClientPath = join(packageDirectory, 'dist/sdr-stl-worker-client-test.cjs');
await build({
  bundle: true,
  entryPoints: [join(packageDirectory, 'out/src/sdrStlWorker/nodeClient.js')],
  format: 'cjs',
  outfile: testClientPath,
  platform: 'node',
  target: 'node24.18.0'
});
const { SdrNodeWorkerClient } = createRequire(import.meta.url)(testClientPath);
const projectDirectory = await mkdtemp(join(tmpdir(), 'vse-sdr-stl-worker-'));
const sourceDirectory = join(projectDirectory, 'force-app/main/default/classes');

try {
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(
    join(projectDirectory, 'sfdx-project.json'),
    JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '67.0' })
  );
  await writeFile(join(sourceDirectory, 'Example.cls'), 'public class Example {}\n');
  await writeFile(
    join(sourceDirectory, 'Example.cls-meta.xml'),
    '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
  );

  const client = await SdrNodeWorkerClient.make(join(packageDirectory, 'dist/sdr-stl-worker.cjs'));
  try {
    assert.equal(await client.getSourceTrackingKey('ApexClass', 'Example'), 'ApexClass###Example');
    const componentSet = await client.fromSource({ projectDirectory, paths: [sourceDirectory] });
    assert.match(await componentSet.getPackageXml(), /<name>ApexClass<\/name>/);
    assert.deepEqual(await componentSet.getComponentSummary(), [
      { fullName: 'Example', type: 'ApexClass', isSourceBacked: true }
    ]);
    await componentSet.dispose();
  } finally {
    await client.close();
  }
} finally {
  await rm(projectDirectory, { force: true, recursive: true });
}

console.log('VSE SDR worker integration test passed');

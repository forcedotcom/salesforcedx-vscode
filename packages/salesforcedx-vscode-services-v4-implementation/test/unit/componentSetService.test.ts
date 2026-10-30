/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { ComponentSetService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ChannelServiceLayer } from '../../src/channelService.js';
import { FileChangePubSubLayer } from '../../src/changePubSubs.js';
import { ComponentSetServiceLayer } from '../../src/componentSetService.js';
import { ConfigServiceLayer } from '../../src/configService.js';
import { MetadataRegistryServiceLayer } from '../../src/metadataRegistryService.js';
import { ProjectServiceLayer } from '../../src/projectService.js';
import { orgLayers } from '../../src/targetOrgRef.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';

const originalFs = coreFs.fs;
const directories: string[] = [];
const graph = ComponentSetServiceLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(ProjectServiceLayer, MetadataRegistryServiceLayer, ConfigServiceLayer)),
  Layer.provideMerge(Layer.mergeAll(WorkspaceServiceLayer, orgLayers, FileChangePubSubLayer, ChannelServiceLayer))
);
const setup = async (backend: 'node' | 'memfs') => {
  vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
  vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
  coreFs.setFs(coreFs.getVirtualFs());
  SfProject.clearInstances();
  const directory =
    backend === 'node'
      ? await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-components-'))
      : '/v4-components';
  if (backend === 'node') directories.push(directory);
  const root = backend === 'node' ? URI.file(directory) : URI.parse(`memfs:${directory}`);
  const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
  const fsPath = (uri: URI) => (backend === 'node' ? uri.fsPath : uri.path);
  await coreFs.fs.promises.mkdir(fsPath(classes), { recursive: true });
  await coreFs.fs.promises.writeFile(
    fsPath(Utils.joinPath(root, 'sfdx-project.json')),
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sourceApiVersion: '67.0'
    })
  );
  await coreFs.fs.promises.mkdir(fsPath(Utils.joinPath(root, '.sf')), { recursive: true });
  await coreFs.fs.promises.writeFile(
    fsPath(Utils.joinPath(root, '.sf', 'config.json')),
    JSON.stringify({ 'org-api-version': '68.0' })
  );
  for (const name of ['One', 'Other']) {
    await coreFs.fs.promises.writeFile(fsPath(Utils.joinPath(classes, `${name}.cls`)), `public class ${name} {}`);
    await coreFs.fs.promises.writeFile(
      fsPath(Utils.joinPath(classes, `${name}.cls-meta.xml`)),
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
    );
  }
  const manifest = Utils.joinPath(root, 'package.xml');
  await coreFs.fs.promises.writeFile(
    fsPath(manifest),
    '<Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>One</members><name>ApexClass</name></types><version>66.0</version></Package>'
  );
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: root, name: 'components', index: 0 }]
  });
  vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
  return { runtime: ManagedRuntime.make(graph), classes, manifest, root };
};
afterEach(async () => {
  vi.restoreAllMocks();
  SfProject.clearInstances();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

// Memory discovery runs in foundations/projectRuntime.mjs with the shipped browser fs aliases; unbundled SDR uses Node fs.
it('discovers actual Node SDK components from URIs, manifest, and filtered project directories', async () => {
  const { runtime, classes, manifest, root } = await setup('node');
  try {
    const service = await runtime.runPromise(ComponentSetService);
    const components = await runtime.runPromise(
      service.getComponentSetFromUris([classes, Utils.joinPath(classes, 'One.cls'), classes])
    );
    expect(components).toBeInstanceOf(ComponentSet);
    expect([...components.getSourceComponents()].map(component => component.fullName).toSorted()).toEqual([
      'One',
      'Other'
    ]);
    expect(components.apiVersion).toBe('68.0');
    expect(components.sourceApiVersion).toBe('67.0');
    expect(components.projectDirectory).toBe(root.fsPath);
    const fromManifest = await runtime.runPromise(service.getComponentSetFromManifest(manifest));
    expect([...fromManifest.getSourceComponents()].map(component => component.fullName)).toEqual(['One']);
    const filtered = await runtime.runPromise(
      service.getComponentSetFromProjectDirectories({ metadataMembers: [{ type: 'ApexClass', fullName: 'Other' }] })
    );
    expect([...filtered.getSourceComponents()].map(component => component.fullName)).toEqual(['Other']);
    expect(await runtime.runPromise(service.ensureNonEmptyComponentSet(filtered))).toBe(filtered);
    const customOutput = Utils.joinPath(root, '.sf', 'output');
    await runtime.runPromise(service.setComponentSetProperties(filtered, customOutput));
    expect(filtered.projectDirectory).toBe(customOutput.fsPath);
  } finally {
    await runtime.dispose();
  }
});

it('reports native resolution failures, validates empty sets, and rejects retained calls after owner disposal', async () => {
  const { runtime, classes } = await setup('memfs');
  try {
    const service = await runtime.runPromise(ComponentSetService);
    expect(
      await runtime.runPromise(service.ensureNonEmptyComponentSet(new ComponentSet()).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'EmptyComponentSetError', size: 0 });
    expect(
      await runtime.runPromise(
        service.getComponentSetFromManifest(Utils.joinPath(classes, 'missing.xml')).pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'FailedToBuildComponentSetError' });
    await runtime.dispose();
    expect(Exit.isFailure(await Effect.runPromiseExit(service.getComponentSetFromUris([classes])))).toBe(true);
    expect(Exit.isFailure(await Effect.runPromiseExit(service.ensureNonEmptyComponentSet(new ComponentSet())))).toBe(
      true
    );
  } finally {
    await runtime.dispose();
  }
});

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { projectLayers } from '@salesforce/vscode-services-v4-implementation/projectLayers';
import { WebFileSystemProvider } from '@salesforce/vscode-services-v4-implementation/webFileSystemProvider';
import { ComponentSetService, MetadataRegistryService, ProjectService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { tmpdir } from 'node:os';
import { URI, Utils } from 'vscode-uri';
import { window, workspace } from 'vscode';

const web = process.env.ESBUILD_PLATFORM === 'web';
const fs = coreFs.fs;
const directory = web ? '/fixture-project' : await fs.promises.mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-packed-project-`);
const root = web ? URI.parse(`memfs:${directory}`) : URI.file(directory);
const path = uri => uri.scheme === 'memfs' ? uri.path : uri.fsPath;
const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
const manifest = Utils.joinPath(root, 'package.xml');
const output = Utils.joinPath(root, '.sf', 'output');
let createdChannels = 0;
let disposedChannels = 0;
window.createOutputChannel = () => {
  createdChannels++;
  return { appendLine() {}, clear() {}, show() {}, dispose() { disposedChannels++; } };
};
workspace.workspaceFolders = [{ uri: root, name: 'project', index: 0 }];
workspace.fs = {
  readFile: uri => fs.promises.readFile(path(uri)),
  writeFile: (uri, content) => fs.promises.writeFile(path(uri), content),
  createDirectory: uri => fs.promises.mkdir(path(uri), { recursive: true }).then(() => undefined),
  delete: (uri, options) => fs.promises.rm(path(uri), { recursive: options?.recursive ?? false }),
  rename: (source, target) => fs.promises.rename(path(source), path(target)),
  stat: async uri => { const value = await fs.promises.stat(path(uri)); return {
    type: value.isDirectory() ? 2 : 1, ctime: value.ctimeMs, mtime: value.mtimeMs, size: value.size
  }; },
  readDirectory: async uri => (await fs.promises.readdir(path(uri), { withFileTypes: true })).map(entry => [entry.name, entry.isDirectory() ? 2 : 1])
};
await fs.promises.mkdir(path(classes), { recursive: true });
await fs.promises.writeFile(path(Utils.joinPath(root, 'sfdx-project.json')), JSON.stringify({
  packageDirectories: [{ path: 'force-app', default: true }], namespace: 'Fixture', sourceApiVersion: '67.0'
}));
await fs.promises.mkdir(path(Utils.joinPath(root, '.sf')), { recursive: true });
await fs.promises.writeFile(path(Utils.joinPath(root, '.sf', 'config.json')), '{"org-api-version":"68.0"}');
for (const name of ['One', 'Other']) {
  await fs.promises.writeFile(path(Utils.joinPath(classes, `${name}.cls`)), `public class ${name} {}`);
  await fs.promises.writeFile(path(Utils.joinPath(classes, `${name}.cls-meta.xml`)), '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>');
}
await fs.promises.writeFile(path(manifest), '<Package xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>One</members><name>ApexClass</name></types><version>66.0</version></Package>');
const runtime = ManagedRuntime.make(projectLayers.pipe(Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))));
let observed;
try {
  const service = await runtime.runPromise(ComponentSetService);
  const nativeProject = await runtime.runPromise(ProjectService.use(project => project.getSfProject()));
  const registry = await runtime.runPromise(MetadataRegistryService.use(value => value.getRegistryAccess()));
  const outside = Utils.joinPath(root, 'outside', 'Foo.cls');
  const outsideError = await runtime.runPromise(ProjectService.use(project => project.ensureInPackageDirectories([outside])).pipe(Effect.flip));
  const components = await runtime.runPromise(service.getComponentSetFromUris([classes, Utils.joinPath(classes, 'One.cls'), classes]));
  const fromManifest = await runtime.runPromise(service.getComponentSetFromManifest(manifest));
  const filtered = await runtime.runPromise(service.getComponentSetFromProjectDirectories({ metadataMembers: [{ type: 'ApexClass', fullName: 'Other' }] }));
  const nonEmpty = await runtime.runPromise(service.ensureNonEmptyComponentSet(filtered));
  await runtime.runPromise(service.setComponentSetProperties(filtered, output));
  observed = { backend: web ? 'memfs' : 'node', names: [...components.getSourceComponents()].map(value => value.fullName).toSorted(),
    manifestNames: [...fromManifest.getSourceComponents()].map(value => value.fullName),
    filteredNames: [...filtered.getSourceComponents()].map(value => value.fullName), sameNonEmpty: nonEmpty === filtered,
    apiVersion: components.apiVersion, sourceApiVersion: components.sourceApiVersion, projectDirectory: components.projectDirectory,
    expectedProjectDirectory: path(root), customOutput: filtered.projectDirectory, expectedOutput: path(output),
    namespace: await runtime.runPromise(ProjectService.use(project => project.getProjectNamespace())),
    projectPath: nativeProject.getPath(), registrySuffix: registry.getTypeByName('ApexClass').suffix,
    nativeProject: nativeProject instanceof SfProject, nativeRegistry: registry instanceof RegistryAccess,
    namespaceEligible: await runtime.runPromise(ProjectService.use(project => project.isArtifactNamespaceWorkspaceEligible('fixture'))),
    nullNamespaceEligible: await runtime.runPromise(ProjectService.use(project => project.isArtifactNamespaceWorkspaceEligible(null))),
    debugLogsFolder: (await runtime.runPromise(ProjectService.use(project => project.getDebugLogsFolder()))).toString(),
    expectedDebugLogsFolder: Utils.joinPath(root, '.sfdx', 'tools', 'debug', 'logs').toString(),
    inPackageDirectories: await runtime.runPromise(ProjectService.use(project => project.isInPackageDirectories(Utils.joinPath(classes, 'One.cls')))),
    outsideError: outsideError._tag, outsideUris: outsideError.uris.map(uri => uri.toString()), expectedOutsideUris: [outside.toString()] };
  await runtime.dispose();
  observed.closedAdmission = Exit.isFailure(await Effect.runPromiseExit(service.getComponentSetFromUris([classes])));
} finally {
  await runtime.dispose();
  await fs.promises.rm(path(root), { recursive: true, force: true });
}
observed.createdChannels = createdChannels;
observed.disposedChannels = disposedChannels;
export { observed };

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { catalogProviderLayers } from '@salesforce/vscode-services-v4-implementation/catalogLayers';
import { createCatalogRuntime } from '@salesforce/vscode-services-v4-implementation/catalogRuntime';
import { ConnectionHost } from '@salesforce/vscode-services-v4-implementation/connectionHost';
import { MetadataOperationMessages } from '@salesforce/vscode-services-v4-implementation/metadataOperationMessages';
import { OrgCatalogMessages } from '@salesforce/vscode-services-v4-implementation/orgCatalogMessages';
import { WebFileSystemProvider } from '@salesforce/vscode-services-v4-implementation/webFileSystemProvider';
import { ActiveMetadataOperationRef, ComponentSetService, ConnectionService, LightningComponentService, MetadataDeleteService, MetadataDeployService, MetadataRetrieveService, OrgId, OrgMetadataCatalogChangePubSub, QueryService, SalesforceId, TargetOrgRef, publicServiceKeys } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Stream from 'effect/Stream';
import { tmpdir } from 'node:os';
import { URI, Utils } from 'vscode-uri';
import { window, workspace } from 'vscode';

const web = process.env.ESBUILD_PLATFORM === 'web';
if (!web) Reflect.set(process.env, 'FORCE_MEMFS', 'false');
const originalFs = coreFs.fs;
coreFs.setFs(coreFs.getVirtualFs());
const fs = coreFs.fs;
const directory = web ? '/fixture-catalog' : await fs.promises.mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-packed-catalog-`);
const root = web ? URI.parse(`memfs:${directory}`) : URI.file(directory);
const path = uri => uri.scheme === 'memfs' ? uri.path : uri.fsPath;
const globalPaths = new Map(['SF_DIR', 'SFDX_DIR', 'DIR'].map(name => [name, Object.getOwnPropertyDescriptor(Global, name)]));
for (const name of globalPaths.keys()) Object.defineProperty(Global, name, { configurable: true, get: () => path(Utils.joinPath(root, 'home', name === 'SF_DIR' ? '.sf' : '.sfdx')) });
await StateAggregator.clearInstanceAsync();
workspace.workspaceFolders = [{ uri: root, name: 'catalog', index: 0 }];
workspace.fs = {
  readFile: uri => fs.promises.readFile(path(uri)),
  writeFile: (uri, content) => fs.promises.writeFile(path(uri), content),
  createDirectory: uri => fs.promises.mkdir(path(uri), { recursive: true }).then(() => undefined),
  delete: (uri, options) => fs.promises.rm(path(uri), { recursive: options?.recursive ?? false, force: true }),
  rename: (source, target) => fs.promises.rename(path(source), path(target)),
  copy: (source, target) => fs.promises.copyFile(path(source), path(target)),
  stat: async uri => { const value = await fs.promises.stat(path(uri)); return { type: value.isDirectory() ? 2 : 1, ctime: value.ctimeMs, mtime: value.mtimeMs, size: value.size }; },
  readDirectory: async uri => (await fs.promises.readdir(path(uri), { withFileTypes: true })).map(entry => [entry.name, entry.isDirectory() ? 2 : 1])
};
let createdChannels = 0;
let disposedChannels = 0;
let progressListeners = 0;
let disposedProgressListeners = 0;
let createdProviders = 0;
let disposedProviders = 0;
const progressTitles = [];
let provider;
workspace.registerTextDocumentContentProvider = (scheme, value) => {
  if (scheme !== 'sf-org-metadata') throw new Error('Unexpected provider scheme');
  createdProviders++; provider = value;
  return { dispose() { disposedProviders++; } };
};
window.tabGroups = { all: [], close: async () => true };
window.createOutputChannel = () => { createdChannels++; return { appendLine() {}, clear() {}, show() {}, dispose() { disposedChannels++; } }; };
window.withProgress = async (options, task) => {
  progressTitles.push(options.title);
  return task({ report() {} }, { isCancellationRequested: false,
    onCancellationRequested() { progressListeners++; return { dispose() { disposedProgressListeners++; } }; } });
};
const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
await fs.promises.mkdir(path(classes), { recursive: true });
await fs.promises.writeFile(path(Utils.joinPath(root, 'sfdx-project.json')), JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], namespace: '', sourceApiVersion: '67.0' }));
const source = Utils.joinPath(classes, 'Local.cls');
await fs.promises.writeFile(path(source), 'public class Local { /* unchanged */ }');
await fs.promises.writeFile(path(Utils.joinPath(classes, 'Local.cls-meta.xml')), '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>');
const config = '{"target-org":"catalog@example.com","org-api-version":"67.0"}';
for (const folder of [Utils.joinPath(root, '.sf'), URI.file(Global.SF_DIR), URI.file(Global.SFDX_DIR)]) {
  await fs.promises.mkdir(path(folder), { recursive: true });
  await fs.promises.writeFile(path(Utils.joinPath(folder, 'config.json')), config);
}
await fs.promises.writeFile(path(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json')), '{"orgs":{}}');
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const settings = workspace.getConfiguration('salesforce-web-console');
await settings.update('instanceUrl', 'https://fixture.example');
await settings.update('accessToken', 'fixture-secret');
await settings.update('sessionContext', { username: 'catalog@example.com', orgId, userId: '005000000000001', namespacePrefix: '', isDevHub: false, isScratch: false, isSandbox: false });
const auth = await AuthInfo.create({ accessTokenOptions: { username: 'catalog@example.com', orgId, accessToken: 'fixture-secret', instanceUrl: 'https://fixture.example', isDevHub: false, namespacePrefix: '', isScratch: false, isSandbox: false } });
auth.update({ refreshToken: 'fixture-refresh-secret', tracksSource: false });
await auth.save();
const originalCreate = Connection.create;
const request = Object.getOwnPropertyDescriptor(Connection.prototype, 'request');
const retrieveMaxApiVersion = Object.getOwnPropertyDescriptor(Connection.prototype, 'retrieveMaxApiVersion');
Connection.create = options => originalCreate.call(Connection, { ...options, connectionOptions: { version: '67.0' } });
Object.defineProperty(Connection.prototype, 'request', { configurable: true, value: function () { return Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: this.getUsername() }] }); } });
// This is the offline server's version response, not a replacement for native retrieve/extraction.
Object.defineProperty(Connection.prototype, 'retrieveMaxApiVersion', { configurable: true, value: async () => '67.0' });
const host = Layer.succeed(ConnectionHost, { globalState: { get: () => undefined, update: async () => undefined, keys: () => [], setKeysForSync() {} },
  messages: { expired: 'Expired', expiredDetail: 'Expired', login: 'Login', refreshFailed: 'Failed', orgChanged: id => `Org changed: ${id}` } });
const messages = Layer.succeed(OrgCatalogMessages, {
  workspaceMissingContent: (type, xml, content) => `Missing ${type} content: ${xml} → ${content}`,
  workspaceScanFailed: (type, error) => `Cannot scan ${type}: ${error}`
});
const operationMessages = Layer.succeed(MetadataOperationMessages, {
  deploying: count => `Deploying ${count} component${count === 1 ? '' : 's'}`,
  deleting: count => `Deleting ${count} component${count === 1 ? '' : 's'}`
});
const owner = await createCatalogRuntime(catalogProviderLayers.pipe(Layer.provide(Layer.mergeAll(host, messages, operationMessages, Layer.succeed(WebFileSystemProvider, { get: () => undefined }))), Layer.orDie), text => text.replaceAll('fixture-secret', '<redacted>'));
const run = program => Effect.runPromise(program.pipe(Effect.provide(owner.v2.services.prebuiltServicesLayer)));
const binaryZip = 'UEsDBBQAAAAIAAAAXl15gOphCAAAAAYAAAAoAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZWP438DAyAQAUEsDBBQAAAAIAAAAXl25MvtsegAAAKcAAAAxAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZS1tZXRhLnhtbFWOwQrCMBBEf0V6txtEPEjMxR+Q6g+s60oLSTYkU9C/N0d7G2beMOPvYCwyabO1iu4+KeZ2GWagnImacRnb23oyiiU6OHcid6Sk4BeDh+CFZdarZVSL4bY+4yKeNqaXLjTj8S0auJRO9EnLZALFvqEqp975ozxtb4UfUEsDBBQAAAAIAAAAXl3+6OwVeQAAAJsAAAAWAAAAdW5wYWNrYWdlZC9wYWNrYWdlLnhtbDWOUQrCQAxEryI9wGYRqSAxH55A6gnSNWqxu1maKHp7i7Sfb5g3DJ45Pfkum08eix2bh3s9AJhyDXbTKUlImmEbYwtxB1mcr+zcEPq3ihFmyb1MRqdRe4SVsHAWujj7kDoxfc1DCP8QYTHfc3HQQu0+RISVEJZH9ANQSwECFAMUAAAACAAAAF5deYDqYQgAAAAGAAAAKAAAAAAAAAAAAAAAgAEAAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZVBLAQIUAxQAAAAIAAAAXl25MvtsegAAAKcAAAAxAAAAAAAAAAAAAACAAU4AAAB1bnBhY2thZ2VkL3N0YXRpY3Jlc291cmNlcy9CbG9iLnJlc291cmNlLW1ldGEueG1sUEsBAhQDFAAAAAgAAABeXf7o7BV5AAAAmwAAABYAAAAAAAAAAAAAAIABFwEAAHVucGFja2FnZWQvcGFja2FnZS54bWxQSwUGAAAAAAMAAwD5AAAAxAEAAAAA';
let observed;
try {
  const connection = await run(Effect.gen(function* () {
    const ref = yield* TargetOrgRef;
    const before = yield* SubscriptionRef.get(ref);
    const subscription = yield* OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
    const value = yield* ConnectionService.use(service => service.getConnection());
    if (before.orgId !== orgId) yield* PubSub.take(subscription).pipe(Effect.repeat({ while: event => event.kind !== 'org' || event.orgId !== orgId }));
    return value;
  }).pipe(Effect.scoped));
  let retrieves = 0;
  connection.metadata.retrieve = async () => { retrieves++; return { id: '09S000000000001', done: false, state: 'InProgress' }; };
  connection.metadata.checkRetrieveStatus = async () => ({ id: '09S000000000001', done: true, success: true, status: 'Succeeded', zipFile: binaryZip,
    fileProperties: [{ fullName: 'Blob', type: 'StaticResource', fileName: 'unpackaged/staticresources/Blob.resource', lastModifiedDate: '2026-10-30T00:00:00.000Z' }] });
  connection.metadata.list = async () => [{ fullName: 'Blob', type: 'StaticResource', lastModifiedDate: '2026-10-30T00:00:00.000Z' }];
  const retrieve = await run(MetadataRetrieveService);
  const components = await run(retrieve.buildComponentSet([{ type: 'StaticResource', fullName: 'Blob' }]).pipe(Effect.flatMap(value => ComponentSetService.use(service => service.ensureNonEmptyComponentSet(value)))));
  const output = Utils.joinPath(root, '.sf', 'orgs', orgId, 'remoteMetadata', 'fixture-retrieve');
  const result = await run(retrieve.retrieveComponentSetToDirectory(components, output, { expectedOrgId: orgId }));
  const nativeSource = [...result.components.getSourceComponents()].find(component => component.fullName === 'Blob');
  const extracted = [...await fs.promises.readFile(nativeSource.content)];
  const documentUri = URI.parse(`sf-org-metadata:/orgs/${orgId}/StaticResource/Blob.resource`);
  // Invoke the actually registered provider; it owns the real remote-source/retrieve/shadow graph.
  await provider.provideTextDocumentContent(documentUri);
  const revisions = Utils.joinPath(root, '.sf', 'orgs', orgId, 'metadata-shadow', 'StaticResource', 'Blob', 'revisions');
  const manifests = (await fs.promises.readdir(path(revisions), { recursive: true })).map(name => name.replaceAll('\\', '/')).filter(name => name.endsWith('/.catalog.json'));
  if (manifests.length !== 1) throw new Error('Expected one complete native shadow revision');
  const manifestUri = Utils.joinPath(revisions, ...manifests[0].split('/'));
  const manifest = JSON.parse(String(await fs.promises.readFile(path(manifestUri))));
  const primaryUri = Utils.joinPath(Utils.dirname(manifestUri), ...manifest.primaryPath.split('/'));
  let notify;
  const notified = new Promise(resolve => { notify = resolve; });
  const listener = provider.onDidChange(uri => notify(uri.toString()));
  await run(OrgMetadataCatalogChangePubSub.pipe(Effect.flatMap(pubsub => PubSub.publish(pubsub, { kind: 'tracking', orgId, references: [{ xmlName: 'StaticResource', fullName: 'Blob' }] }))));
  const notification = await notified;
  listener.dispose();
  const merged = await run(retrieve.retrieve([{ type: 'StaticResource', fullName: 'Blob' }], { expectedOrgId: orgId }));
  const mergedSource = [...merged.components.getSourceComponents()].find(component => component.fullName === 'Blob');
  const mergedBytes = [...await fs.promises.readFile(mergedSource.content)];
  let deploys = 0;
  const deployZipSizes = [];
  connection.metadata.deploy = async zip => { deploys++; deployZipSizes.push(zip.byteLength); return { id: '0Af000000000001', done: false, state: 'Queued' }; };
  connection.metadata.checkDeployStatus = async () => ({ id: '0Af000000000001', done: true, success: true, status: 'Succeeded',
    details: { componentFailures: [], componentSuccesses: [{ fullName: 'Blob', componentType: 'StaticResource', fileName: 'staticresources/Blob.resource', success: true, changed: deploys === 1, created: false, deleted: deploys > 1 }] } });
  const deployed = await run(MetadataDeployService.use(service => service.deploy(merged.components)));
  const deleted = await run(MetadataDeleteService.use(service => service.markComponentsForDeletion(merged.components)));
  const destructiveMarked = [...deleted.getSourceComponents()].every(component => component.isMarkedForDelete());
  const deleteResult = await run(MetadataDeployService.use(service => service.deploy(deleted)));
  await run(MetadataDeleteService.use(service => service.deleteLocalFiles(deleted)));
  const localDeleted = await fs.promises.stat(mergedSource.content).then(() => false, error => error.code === 'ENOENT');
  const bundle = Utils.joinPath(root, 'force-app', 'main', 'default', 'lwc', 'oldBundle');
  await fs.promises.mkdir(path(Utils.joinPath(bundle, '__tests__')), { recursive: true });
  for (const file of ['oldBundle.js', 'oldBundle.html', 'other.js', '__tests__/oldBundle.small.test.js'])
    await fs.promises.writeFile(path(Utils.joinPath(bundle, ...file.split('/'))), file);
  const renamed = await run(LightningComponentService.use(service => service.renameBundle({ bundleUri: bundle, oldName: 'oldBundle', newName: 'newBundle', kind: 'lwc' })));
  const renamedFiles = (await fs.promises.readdir(path(renamed), { recursive: true })).map(file => file.replaceAll('\\', '/')).sort();
  const queryRows = await run(QueryService.use(service => service.query({ soql: 'SELECT Id, Username FROM User', orgId }, Schema.Struct({ Id: SalesforceId, Username: Schema.String }))).pipe(Effect.flatMap(result => Stream.runCollect(result.records))));
  const legacy = await owner.host.getConnection(undefined, new AbortController().signal);
  observed = { backend: web ? 'memfs' : 'node', nativeConnection: connection instanceof Connection, extracted,
    mergedBytes, deploys, deployZipSizes, deployedStatus: deployed.response.status, destructiveMarked, deleteStates: deleteResult.getFileResponses().map(response => response.state), localDeleted, renamedFiles, progressTitles, queriedUsernames: queryRows.map(row => row.Username),
    materialized: [...await fs.promises.readFile(path(primaryUri))], primary: primaryUri.path,
    revision: manifest.remoteLastModifiedDate, fileCount: manifest.files.length, retrieves, notification,
    sameLegacyConnection: legacy._tag === 'Success' && legacy.value === connection,
    contextKeys: [...owner.v2.services.prebuiltServicesDependencies.mapUnsafe.keys()].sort(), expectedContextKeys: Object.values(publicServiceKeys).map(key => key.key).sort(),
    unchangedSource: String(await fs.promises.readFile(path(source))), active: await run(ActiveMetadataOperationRef.pipe(Effect.flatMap(SubscriptionRef.get))),
    staging: await fs.promises.readdir(path(Utils.joinPath(root, '.sf', 'orgs', orgId, 'remoteMetadata', 'catalog-staging')), { recursive: true }) };
  if ((await owner.dispose())._tag !== 'Success') throw new Error('Catalog owner disposal failed');
  observed.closedAdmission = await provider.provideTextDocumentContent(documentUri).then(() => false, () => true);
} finally {
  await owner.dispose();
  Connection.create = originalCreate;
  if (request) Object.defineProperty(Connection.prototype, 'request', request); else Reflect.deleteProperty(Connection.prototype, 'request');
  if (retrieveMaxApiVersion) Object.defineProperty(Connection.prototype, 'retrieveMaxApiVersion', retrieveMaxApiVersion); else Reflect.deleteProperty(Connection.prototype, 'retrieveMaxApiVersion');
  await StateAggregator.clearInstanceAsync();
  for (const [name, descriptor] of globalPaths) if (descriptor) Object.defineProperty(Global, name, descriptor); else Reflect.deleteProperty(Global, name);
  await fs.promises.rm(path(root), { recursive: true, force: true });
  coreFs.setFs(originalFs);
}
Object.assign(observed, { createdChannels, disposedChannels, progressListeners, disposedProgressListeners, createdProviders, disposedProviders });
export { observed };

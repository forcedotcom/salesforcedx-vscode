/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { catalogProviderLayers } from 'salesforcedx-vscode-services/out/src/services/catalogLayers.js';
import { createCatalogRuntime } from 'salesforcedx-vscode-services/out/src/services/catalogRuntime.js';
import { ConnectionHost } from 'salesforcedx-vscode-services/out/src/services/connectionHost.js';
import { HostFileSystem } from 'salesforcedx-vscode-services/out/src/services/hostFileSystem.js';
import { MetadataOperationMessages } from 'salesforcedx-vscode-services/out/src/services/metadataOperationMessages.js';
import { MediaDescriptions } from 'salesforcedx-vscode-services/out/src/services/mediaDescriptions.js';
import { PromptMessages } from 'salesforcedx-vscode-services/out/src/services/promptMessages.js';
import { TemplateMessages } from 'salesforcedx-vscode-services/out/src/services/templateMessages.js';
import { OrgCatalogMessages } from 'salesforcedx-vscode-services/out/src/services/orgCatalog/orgCatalogMessages.js';
import { WebFileSystemProvider } from 'salesforcedx-vscode-services/out/src/services/webFileSystemProvider.js';
import { ActiveMetadataOperationRef, ComponentSetService, ConnectionService, EditorService, LightningComponentService, MetadataDeleteService, MetadataDeployService, MetadataRetrieveService, OrgId, OrgMetadataCatalogChangePubSub, QueryService, SalesforceId, TargetOrgRef, publicServiceKeys } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import { tmpdir } from 'node:os';
import { URI, Utils } from 'vscode-uri';
import { commands, extensions, languages, window, workspace } from 'vscode';
import * as caller from '../decoderConsumer/consumer.js';

const web = process.env.ESBUILD_PLATFORM === 'web';
if (!web) Reflect.set(process.env, 'FORCE_MEMFS', 'false');
const originalFs = coreFs.fs;
coreFs.setFs(coreFs.getVirtualFs());
const fs = coreFs.fs;
const directory = web ? '/fixture-catalog' : await fs.promises.mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-packed-catalog-`);
const root = web ? URI.parse(`memfs:${directory}`) : URI.file(directory);
const extensionUri = web ? URI.parse('https://fixture.example/extension') : Utils.joinPath(root, 'extension');
extensions.getExtension = id => id === 'salesforce.salesforcedx-vscode-services' ? { extensionUri } : undefined;
// Minimal real SDK-compatible extension assets; web must fetch and stage them, not read npm's templates directory.
const templateAssets = new Map([
  ['apexclass/DefaultApexClass.cls', 'public with sharing class <%= apiName %> { public <%= apiName %>() {} }'],
  ['apexclass/_class.cls-meta.xml', '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion><%= apiVersion %></apiVersion><status>Active</status></ApexClass>']
]);
const assetReads = [];
const extensionAssets = new Map([...templateAssets, ['manifest.json', JSON.stringify([...templateAssets.keys()])]].map(([name, content]) =>
  [Utils.joinPath(extensionUri, 'dist', 'templates', name).toString(), new TextEncoder().encode(content)]));
const path = uri => uri.scheme === 'memfs' ? uri.path : uri.fsPath;
const globalPaths = new Map(['SF_DIR', 'SFDX_DIR', 'DIR'].map(name => [name, Object.getOwnPropertyDescriptor(Global, name)]));
for (const name of globalPaths.keys()) Object.defineProperty(Global, name, { configurable: true, get: () => path(Utils.joinPath(root, 'home', name === 'SF_DIR' ? '.sf' : '.sfdx')) });
await StateAggregator.clearInstanceAsync();
workspace.workspaceFolders = [{ uri: root, name: 'catalog', index: 0 }];
workspace.fs = {
  readFile: uri => {
    const asset = extensionAssets.get(uri.toString());
    if (asset) { assetReads.push(uri.toString()); return Promise.resolve(asset); }
    return fs.promises.readFile(path(uri));
  },
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
let createdEditorListeners = 0;
let disposedEditorListeners = 0;
let createdExtensionListeners = 0;
let disposedExtensionListeners = 0;
extensions.onDidChange = () => { createdExtensionListeners++; return { dispose() { disposedExtensionListeners++; } }; };
let disposedDiagnostics = 0;
const diagnosticEntries = new Map();
const channelMessages = [];
languages.createDiagnosticCollection = () => ({
  delete(uri) { diagnosticEntries.delete(uri.toString()); },
  set(uri, values) { diagnosticEntries.set(uri.toString(), values); },
  dispose() { disposedDiagnostics++; diagnosticEntries.clear(); }
});
const progressTitles = [];
let provider;
workspace.registerTextDocumentContentProvider = (scheme, value) => {
  if (scheme !== 'sf-org-metadata') throw new Error('Unexpected provider scheme');
  createdProviders++; provider = value;
  return { dispose() { disposedProviders++; } };
};
window.tabGroups = { all: [], close: async () => true };
window.onDidChangeActiveTextEditor = () => { createdEditorListeners++; return { dispose() { disposedEditorListeners++; } }; };
window.createOutputChannel = () => { createdChannels++; return { appendLine(value) { channelMessages.push(value); }, clear() { channelMessages.splice(0); }, show() {}, dispose() { disposedChannels++; } }; };
window.withProgress = async (options, task) => {
  progressTitles.push(options.title);
  return task({ report() {} }, { isCancellationRequested: false,
    onCancellationRequested() { progressListeners++; return { dispose() { disposedProgressListeners++; } }; } });
};
const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
if (!web) for (const [name, content] of templateAssets) {
  const uri = Utils.joinPath(extensionUri, 'dist', 'templates', name);
  await fs.promises.mkdir(path(Utils.dirname(uri)), { recursive: true });
  await fs.promises.writeFile(path(uri), content);
}
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
const callerRequests = [];
let invalidCallerPage = false;
Object.defineProperty(Connection.prototype, 'request', { configurable: true, value: function (request) {
  const url = typeof request === 'string' ? request : request.url;
  if (url.includes('TraceFlag')) return Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '7tf000000000001', LogType: 'DEVELOPER_LOG', StartDate: null, ExpirationDate: '2030-01-01T00:00:00.000Z', DebugLevelId: null, DebugLevel: null, TracedEntityId: null }] });
  if (url.includes('/services/Soap/')) {
    const failed = request.body.includes('bad apex');
    return Promise.resolve({ 'soapenv:Envelope': {
      'soapenv:Header': { DebuggingInfo: { debugLog: 'Packed anonymous log' } },
      'soapenv:Body': { executeAnonymousResponse: { result: { compiled: failed ? 'false' : 'true', success: failed ? 'false' : 'true', line: 3, column: 2,
        compileProblem: failed ? 'Unexpected token' : '', exceptionMessage: '', exceptionStackTrace: '' } } }
    } });
  }
  if (url.includes('/sobjects/ApexLog/') && url.endsWith('/Body')) return Promise.resolve('Packed Apex log body');
  if (url.includes('ApexLog')) return Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '07L000000000001', LogLength: 20, StartTime: '2026-11-02T00:00:00Z', Status: 'Success', Application: null, LogUser: { Name: null } }] });
  if (url.includes('CallerDecoder') || url.includes('/caller-next')) {
    const next = url.includes('/caller-next');
    callerRequests.push(next ? 'next' : 'first');
    return Promise.resolve(next ? { totalSize: 3, done: true, records: [{ Id: '005000000000003', Username: 'Third' }] }
      : { totalSize: 3, done: false, nextRecordsUrl: '/services/data/v67.0/query/caller-next', records: [
        { Id: '005000000000001', Username: 'First' }, { Id: invalidCallerPage ? 'invalid' : '005000000000002', Username: 'Second' }
      ] });
  }
  return Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: this.getUsername() }] });
} });
// This is the offline server's version response, not a replacement for native retrieve/extraction.
Object.defineProperty(Connection.prototype, 'retrieveMaxApiVersion', { configurable: true, value: async () => '67.0' });
const host = Layer.succeed(ConnectionHost, { globalState: { get: () => undefined, update: async () => undefined, keys: () => [], setKeysForSync() {} },
  messages: { expired: 'Expired', expiredDetail: 'Expired', login: 'Login', refreshFailed: 'Failed', orgChanged: id => `Org changed: ${id}` } });
const hostFileSystem = Layer.succeed(HostFileSystem, { get: () => ({ watch: fs.watch.bind(fs) }) });
const messages = Layer.succeed(OrgCatalogMessages, {
  workspaceMissingContent: (type, xml, content) => `Missing ${type} content: ${xml} → ${content}`,
  workspaceScanFailed: (type, error) => `Cannot scan ${type}: ${error}`
});
const operationMessages = Layer.succeed(MetadataOperationMessages, {
  deploying: count => `Deploying ${count} component${count === 1 ? '' : 's'}`,
  deleting: count => `Deleting ${count} component${count === 1 ? '' : 's'}`
});
const owner = await createCatalogRuntime(catalogProviderLayers.pipe(Layer.provide(Layer.mergeAll(host, hostFileSystem, messages, operationMessages,
  Layer.succeed(PromptMessages, { overwriteConfirmation: path => `Overwrite ${path}?`, overwriteButton: 'Overwrite', chooseDifferentFolder: 'Other Folder', selectFolder: 'Select Folder' }),
  Layer.succeed(TemplateMessages, { extensionUnavailable: 'Extension context not available', manifestLoadFailed: cause => `Manifest load failed: ${cause}`, manifestParseFailed: 'Manifest parse failed', fileCopyFailed: (path, cause) => `File copy failed: ${path} ${cause}`, missingSourceApiVersion: 'sourceApiVersion is not defined' }),
  Layer.succeed(MediaDescriptions, icon => `Localized ${icon}`), Layer.succeed(WebFileSystemProvider, { get: () => undefined }))), Layer.orDie), text => text.replaceAll('fixture-secret', '<redacted>'), { orgOperationSuperseded: 'Org changed', viewSuggestions: 'View Suggestions' }, orgId => `Org changed: ${orgId}`);
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
  const queryRows = await run(QueryService.use(service => service.query({ soql: 'SELECT Id, Username FROM User', orgId }, Schema.decodeUnknownEffect(Schema.Struct({
    totalSize: Schema.Number, done: Schema.optional(Schema.Boolean), nextRecordsUrl: Schema.optional(Schema.String),
    records: Schema.optional(Schema.Array(Schema.Struct({ Id: SalesforceId, Username: Schema.String })))
  })))).pipe(Effect.flatMap(result => Stream.runCollect(result.records))));
  const callerQuery = decode => QueryService.use(service => service.query({ soql: 'SELECT Id, Username FROM CallerDecoder', orgId }, decode));
  const first = await run(callerQuery(caller.decodePage).pipe(Effect.provideService(caller.DecoderSettings, { prefix: 'first:' })));
  if (callerRequests.join(',') !== 'first') throw new Error('Query fetched a later page during acquisition');
  const firstRows = await run(first.records.pipe(Stream.take(2), Stream.runCollect, Effect.provideService(caller.DecoderSettings, { prefix: 'unused:' })));
  if (callerRequests.join(',') !== 'first') throw new Error('Early stream termination fetched an unnecessary later page');
  const collections = [];
  for (const prefix of ['second:', 'third:']) collections.push(await run(first.records.pipe(Stream.runCollect,
    Effect.provideService(caller.DecoderSettings, { prefix }), Effect.withSpan('packed.records'))));
  if (callerRequests.join(',') !== 'first,next,next') throw new Error('Recollection did not replay the first page and independently fetch subsequent pages');
  const rejection = await run(callerQuery(caller.rejectPage).pipe(Effect.flip));
  invalidCallerPage = true;
  let callerSchemaError;
  const schemaError = await run(callerQuery(input => caller.decodePage(input).pipe(Effect.tapError(error => Effect.sync(() => { callerSchemaError = error; })))).pipe(
    Effect.provideService(caller.DecoderSettings, { prefix: 'unused:' }), Effect.flip
  ));
  invalidCallerPage = false;
  let notifyDecoderStarted;
  const started = new Promise(resolve => { notifyDecoderStarted = resolve; });
  const controller = new AbortController();
  let finalized = false;
  const operation = Effect.runPromiseExit(callerQuery(caller.suspendedDecoder(() => notifyDecoderStarted(), () => { finalized = true; })).pipe(
    Effect.provide(owner.v2.services.prebuiltServicesLayer)
  ), { signal: controller.signal });
  await started;
  controller.abort();
  const interrupted = await operation;
  const callerDecoding = {
    firstPageLabels: firstRows.map(row => row.label),
    subsequentLabels: collections.map(rows => rows.at(-1).label),
    initialSpan: Option.getOrUndefined(firstRows[0].parentSpan), laterSpan: Option.getOrUndefined(collections[0].at(-1).parentSpan),
    typedErrorIdentity: rejection === caller.rejection,
    schemaErrorPath: schemaError === callerSchemaError && schemaError._tag === 'SchemaError' && /records.*1.*Id/s.test(schemaError.message),
    finalizedOnInterrupt: finalized && Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)
  };
  const legacy = await owner.host.getConnection(undefined, new AbortController().signal);
  const editor = await run(EditorService);
  window.activeTextEditor = { document: { uri: source, getText: () => 'public class Local { /* unchanged */ }' }, selection: { isEmpty: true, start: { line: 7, character: 12 } } };
  const editorContext = await run(editor.getActiveEditorContext(true));
  const media = await run(owner.v2.services.MediaService);
  const iconDescription = await run(media.getIconDescription(media.ICONS.SF_DEFAULT_ORG));
  const prompt = await run(owner.v2.services.PromptService);
  const warningCalls = [];
  window.showWarningMessage = async (message, options, ...buttons) => { warningCalls.push({ message, options, buttons }); return buttons[0]; };
  await run(prompt.confirmOrThrow({ message: 'Confirm action', confirmLabel: 'Proceed', detail: 'Details' }));
  await run(prompt.ensureMetadataOverwriteOrThrow({ uris: [source] }));
  const alternateClasses = Utils.joinPath(root, 'force-app', 'other', 'classes');
  await fs.promises.mkdir(path(alternateClasses), { recursive: true });
  let directoryLabels;
  window.showQuickPick = async items => {
    directoryLabels = items.map(item => item.label);
    return items.find(item => item.uri?.toString() === alternateClasses.toString());
  };
  const chosenDirectory = await run(prompt.promptForOutputDir({ defaultUri: classes, folderName: 'classes', pickerPlaceHolder: 'Choose classes' }));
  const promptSelection = { warningCalls, directoryLabels, sameDirectory: chosenDirectory.toString() === alternateClasses.toString() };
  let disposedStatus = 0;
  let disposedStatusCommand = 0;
  let actionRan = false;
  let chooseAction;
  let notifyActionRan;
  const selection = new Promise(resolve => { chooseAction = resolve; });
  const ran = new Promise(resolve => { notifyActionRan = resolve; });
  const statusCommands = new Map();
  const statusItem = { name: '', text: '', command: undefined, show() {}, hide() {}, dispose() { disposedStatus++; } };
  window.createStatusBarItem = () => statusItem;
  commands.registerCommand = (id, callback) => { statusCommands.set(id, callback); return { dispose() { statusCommands.delete(id); disposedStatusCommand++; } }; };
  const toastMessages = [];
  window.showInformationMessage = (message, ...labels) => { toastMessages.push({ message, labels }); return selection; };
  await workspace.getConfiguration('fixture-notifications').update('extensionLevelNotifications', 'progressToastSuccessToast');
  const notificationRuntime = ManagedRuntime.make(Layer.merge(
    owner.v2.services.prebuiltServicesLayer,
    owner.v2.services.NotificationModeServiceLayer('fixture-notifications', 'fixture.notifications', 'Fixture notifications')
  ));
  let callerNotifications;
  try {
    const notifications = await notificationRuntime.runPromise(owner.v2.services.NotificationModeService);
    const progressLocation = await notificationRuntime.runPromise(notifications.getProgressLocation('Command'));
    await notificationRuntime.runPromise(notifications.showSuccessNotification('Command', 'Native toast', false, [{ label: 'Open', run: () => { actionRan = true; notifyActionRan(); } }]));
    const returnedBeforeSelection = !actionRan;
    chooseAction('Open'); await ran;
    await workspace.getConfiguration('fixture-notifications').update('extensionLevelNotifications', 'progressStatusBarSuccessStatusBar');
    await notificationRuntime.runPromise(notifications.showSuccessNotification('Command', 'Native status'));
    await statusCommands.get('fixture.notifications.showToast')();
    callerNotifications = { progressLocation, returnedBeforeSelection, actionRan, text: statusItem.text, name: statusItem.name, toastMessages };
  } finally { await notificationRuntime.dispose(); }
  callerNotifications.disposedStatus = disposedStatus;
  callerNotifications.disposedCommand = disposedStatusCommand;
  callerNotifications.commandClosed = statusCommands.size === 0;
  callerNotifications.sameConnection = connection === await run(ConnectionService.use(service => service.getConnection()));
  const terminalService = await run(owner.v2.services.TerminalService);
  const terminal = web
    ? { errorType: (await run(terminalService.simpleExec({ executable: 'sf', args: ['org', 'display'], parse: value => value }).pipe(Effect.flip))).errorType }
    : { result: await run(terminalService.simpleExec({
        executable: process.execPath,
        args: ['-e', 'process.stdout.write(JSON.stringify({args:process.argv.slice(1),overlay:process.env.PACKED_TERMINAL}));process.stderr.write("x".repeat(2*1024*1024))', '--', 'space value', '; echo injected'],
        env: { PACKED_TERMINAL: 'preserved' }, parse: value => JSON.parse(value)
      })) };
  const templates = await run(owner.v2.services.TemplateService);
  const logs = await run(owner.v2.services.ApexLogService);
  const apexLogs = { records: await run(logs.listLogs(1)), body: await run(logs.getLogBody('07L000000000001')) };
  const templateNames = await run(templates.getBuiltInTemplateNames('apexclass', /\.cls$/));
  const generatedDirectory = Utils.joinPath(root, 'generated');
  const generated = await run(templates.create({
    cwd: path(root), templateType: owner.v2.services.TemplateType.ApexClass,
    options: { classname: 'FixtureCreated', template: 'DefaultApexClass' }, outputdir: generatedDirectory
  }));
  const createdClass = await fs.promises.readFile(path(Utils.joinPath(generatedDirectory, 'FixtureCreated.cls')), 'utf8');
  const createdMeta = await fs.promises.readFile(path(Utils.joinPath(generatedDirectory, 'FixtureCreated.cls-meta.xml')), 'utf8');
  const templateCreation = { names: templateNames, created: generated.created.map(name => name.replaceAll('\\', '/')).sort(), classContent: createdClass,
    versionFromProject: createdMeta.includes('<apiVersion>67.0</apiVersion>'),
    outputDirectory: generated.outputDir === path(generatedDirectory), stagedFiles: assetReads.length };
  const callerScope = Effect.runSync(Scope.make());
  let callerProgress;
  try {
    const value = await run(prompt.withCancellableProgress('Caller progress')(caller.progressValue).pipe(
      Effect.provideService(caller.DecoderSettings, { prefix: 'independent-progress' }), Scope.provide(callerScope), Effect.withSpan('packed.progress')
    ));
    callerProgress = { prefix: value.prefix, sameScope: value.scope === callerScope, span: value.span };
  } finally { await Effect.runPromise(Scope.close(callerScope, Exit.void)); }
  const callerContexts = [];
  for (const displayName of ['First extension', 'Second extension', undefined]) {
    const nativeContext = { extension: { packageJSON: { displayName } } };
    const layer = Layer.merge(owner.v2.services.prebuiltServicesLayer, owner.v2.services.ExtensionContextServiceLayer(nativeContext));
    callerContexts.push(await Effect.runPromise(Effect.gen(function* () {
      const contextService = yield* owner.v2.services.ExtensionContextService;
      const value = yield* contextService.getContext;
      const name = yield* contextService.getDisplayName;
      const sharedConnection = yield* ConnectionService.use(service => service.getConnection());
      return { nativeIdentity: value === nativeContext, displayName: name, sharedConnection: sharedConnection === connection };
    }).pipe(Effect.provide(layer))));
  }
  const anonymousService = await run(owner.v2.services.ExecuteAnonymousService);
  const traceFlags = await run(owner.v2.services.TraceFlagService);
  const traceFlagRecords = (await run(traceFlags.getTraceFlags())).map(value => ({
    id: value.id, logType: value.logType, expirationDate: value.expirationDate.toISOString(), isActive: value.isActive,
    missingStartDate: value.startDate === undefined, missingDebugLevel: value.debugLevelId === undefined
  }));
  const anonymous = await run(anonymousService.executeAndRetrieveLog('bad apex'));
  await run(anonymousService.reportExecResult(anonymous.result, source, 5, anonymous.logBody));
  const anonymousExecution = { result: anonymous.result, logBody: anonymous.logBody, output: channelMessages.slice(),
    diagnostic: diagnosticEntries.get(source.toString())?.map(value => ({ message: value.message, line: value.range.start.line, character: value.range.start.character })) };
  observed = { backend: web ? 'memfs' : 'node', nativeConnection: connection instanceof Connection, extracted,
    mergedBytes, deploys, deployZipSizes, deployedStatus: deployed.response.status, destructiveMarked, deleteStates: deleteResult.getFileResponses().map(response => response.state), localDeleted, renamedFiles, progressTitles, queriedUsernames: queryRows.map(row => row.Username),
    materialized: [...await fs.promises.readFile(path(primaryUri))], primary: primaryUri.path,
    revision: manifest.remoteLastModifiedDate, fileCount: manifest.files.length, retrieves, notification,
    sameLegacyConnection: legacy._tag === 'Success' && legacy.value === connection,
    contextKeys: [...owner.v2.services.prebuiltServicesDependencies.mapUnsafe.keys()].sort(), expectedContextKeys: Object.values(publicServiceKeys).map(key => key.key).sort(),
    unchangedSource: String(await fs.promises.readFile(path(source))), active: await run(ActiveMetadataOperationRef.pipe(Effect.flatMap(SubscriptionRef.get))),
    staging: await fs.promises.readdir(path(Utils.joinPath(root, '.sf', 'orgs', orgId, 'remoteMetadata', 'catalog-staging')), { recursive: true }), callerDecoding,
    editorContext: { text: editorContext.text, documentUri: editorContext.documentUri.toString(), selectionStart: editorContext.selectionStart, selectionRange: editorContext.selectionRange },
    callerContexts, callerContextsOwnerUnchanged: !owner.v2.services.prebuiltServicesDependencies.mapUnsafe.has(owner.v2.services.ExtensionContextService.key), iconDescription, callerProgress, promptSelection, callerNotifications, terminal, templateCreation, apexLogs, anonymousExecution, traceFlagRecords };
  if ((await owner.dispose())._tag !== 'Success') throw new Error('Catalog owner disposal failed');
  observed.editorClosed = await Effect.runPromise(PubSub.isShutdown(editor.pubsub));
  observed.traceFlagsClosed = await Effect.runPromise(PubSub.isShutdown(traceFlags.traceFlagsChanged));
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
Object.assign(observed, { createdChannels, disposedChannels, progressListeners, disposedProgressListeners, createdProviders, disposedProviders, createdEditorListeners, disposedEditorListeners, createdExtensionListeners, disposedExtensionListeners, disposedDiagnostics });
export { observed };

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, SfProject, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { ComponentSetService, ConnectionService, MetadataRetrieveService, OrgId } from '@salesforce/vscode-services-v2';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
// eslint-disable-next-line no-restricted-imports -- Node-only SDK integration fixture owns real isolated directories; never bundled in an extension.
import * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { catalogLayers } from '../../src/catalogLayers.js';
import { ConnectionHost } from '../../src/connectionHost.js';
import { LightningComponentServiceLayer } from '../../src/lightningComponentService.js';
import { MetadataDeleteServiceLayer } from '../../src/metadataDeleteService.js';
import { MetadataDeployServiceLayer } from '../../src/metadataDeployService.js';
import { MetadataOperationMessages } from '../../src/metadataOperationMessages.js';
import { OrgCatalogMessages } from '../../src/orgCatalog/orgCatalogMessages.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { installVscodeFs } from './vscodeFs.js';

const createConnection = Connection.create.bind(Connection);
const originalFs = coreFs.fs;
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const graph = Layer.mergeAll(
  MetadataDeployServiceLayer,
  MetadataDeleteServiceLayer,
  LightningComponentServiceLayer
).pipe(
  Layer.provideMerge(catalogLayers),
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(ConnectionHost, {
        globalState: {
          get: () => undefined,
          update: () => Promise.resolve(undefined),
          keys: () => [],
          setKeysForSync: () => undefined
        },
        messages: {
          expired: 'expired',
          expiredDetail: 'expired',
          login: 'login',
          refreshFailed: 'failed',
          orgChanged: id => `Org changed: ${id}`
        }
      }),
      Layer.succeed(MetadataOperationMessages, {
        deploying: count => `Deploying ${count} component${count === 1 ? '' : 's'}`,
        deleting: count => `Deleting ${count} component${count === 1 ? '' : 's'}`
      }),
      Layer.succeed(OrgCatalogMessages, {
        workspaceMissingContent: (type, xml, content) => `Missing ${type}: ${xml} → ${content}`,
        workspaceScanFailed: (type, error) => `Cannot scan ${type}: ${error}`
      }),
      Layer.succeed(WebFileSystemProvider, { get: () => undefined })
    )
  )
);

/** Actual Node SDK graph and disk, with only VS Code hosting and Salesforce transport supplied by the test. */
export const createMetadataOperationTest = async ({
  tracksSource = false,
  withApexClass = true,
  sourceMembers = []
}: {
  tracksSource?: boolean;
  withApexClass?: boolean;
  sourceMembers?: readonly Record<string, unknown>[];
} = {}): Promise<{
  runtime: ManagedRuntime.ManagedRuntime<Layer.Success<typeof graph>, Layer.Error<typeof graph>>;
  connection: Connection;
  components: ComponentSet;
  root: URI;
  classes: URI;
  source: URI;
  orgId: OrgId;
  requestCancel: () => void;
  listenerDisposals: () => number;
  dispose: () => Promise<void>;
}> => {
  vi.stubEnv('FORCE_MEMFS', 'false');
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  coreFs.setFs(coreFs.getVirtualFs());
  SfProject.clearInstances();
  await StateAggregator.clearInstanceAsync();
  installVscodeFs(FsPromises);
  const directory = await FsPromises.mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'v4-metadata-operation-'));
  const root = URI.file(directory);
  const fs = coreFs.fs.promises;
  vi.stubEnv('HOME', directory);
  vi.spyOn(Global, 'SF_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sf').fsPath);
  vi.spyOn(Global, 'SFDX_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  vi.spyOn(Global, 'DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
  const source = Utils.joinPath(classes, 'Remote.cls');
  await fs.mkdir(Utils.joinPath(root, 'force-app').fsPath, { recursive: true });
  if (withApexClass) {
    await fs.mkdir(classes.fsPath, { recursive: true });
    await fs.writeFile(source.fsPath, 'public class Remote { /* local */ }');
    await fs.writeFile(
      Utils.joinPath(classes, 'Remote.cls-meta.xml').fsPath,
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
    );
  }
  await fs.writeFile(
    Utils.joinPath(root, 'sfdx-project.json').fsPath,
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sourceApiVersion: '67.0'
    })
  );
  const config = '{"target-org":"operation@example.com","org-api-version":"67.0"}';
  for (const folder of [Utils.joinPath(root, '.sf').fsPath, Global.SF_DIR, Global.SFDX_DIR]) {
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(join(folder, 'config.json'), config);
  }
  await fs.writeFile(join(Global.SFDX_DIR, 'alias.json'), '{"orgs":{}}');
  const auth = await AuthInfo.create({
    accessTokenOptions: {
      username: 'operation@example.com',
      orgId,
      accessToken: 'fixture-secret',
      instanceUrl: 'https://fixture.example',
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  });
  auth.update({ refreshToken: 'fixture-refresh-secret', tracksSource });
  await auth.save();
  const settings: Record<string, unknown> = {
    instanceUrl: 'https://fixture.example',
    accessToken: 'fixture-secret',
    apiVersion: '67.0',
    sessionContext: {
      username: 'operation@example.com',
      orgId,
      userId: '005000000000001',
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  };
  const configuration = vscode.workspace.getConfiguration();
  vi.spyOn(configuration, 'get').mockImplementation((key): unknown => settings[key]);
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(configuration);
  vi.spyOn(Connection, 'create').mockImplementation(options =>
    createConnection({ ...options, connectionOptions: { version: '67.0' } })
  );
  vi.spyOn(Connection.prototype, 'retrieveMaxApiVersion').mockResolvedValue('67.0');
  vi.spyOn(Connection.prototype, 'request').mockImplementation(function (this: Connection, options) {
    const url = decodeURIComponent(typeof options === 'string' ? options : options.url).replaceAll('+', ' ');
    const records = url.includes('FROM SourceMember')
      ? sourceMembers
      : [{ Id: '005000000000001', Username: this.getUsername() }];
    return Object.assign(Promise.resolve({ totalSize: records.length, done: true, records }), {
      stream: () => {
        throw new Error('JSON identity transport only');
      }
    });
  });
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: root, name: 'operation', index: 0 }]
  });
  vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
  vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
    ignoreCreateEvents: false,
    ignoreChangeEvents: false,
    ignoreDeleteEvents: false
  }));
  vi.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(() => ({ dispose: () => undefined }));
  let cancelRequested = false;
  let cancelListener: (() => void) | undefined;
  let listenerDisposals = 0;
  vi.mocked(vscode.window.withProgress).mockImplementation((_options, task) =>
    Promise.resolve(
      task(
        { report: () => undefined },
        {
          get isCancellationRequested() {
            return cancelRequested;
          },
          onCancellationRequested: listener => {
            cancelListener = () => {
              listener(undefined);
            };
            return {
              dispose: () => {
                cancelListener = undefined;
                listenerDisposals++;
              }
            };
          }
        }
      )
    )
  );
  const runtime = ManagedRuntime.make(graph);
  const connection = await runtime.runPromise(ConnectionService.use(service => service.getConnection()));
  const components = await runtime.runPromise(
    withApexClass
      ? ComponentSetService.use(service => service.getComponentSetFromUris([source]))
      : MetadataRetrieveService.use(service => service.buildComponentSet([{ type: 'ApexClass', fullName: 'Remote' }]))
  );
  return {
    runtime,
    connection,
    components,
    root,
    classes,
    source,
    orgId,
    requestCancel: () => {
      cancelRequested = true;
      cancelListener?.();
    },
    listenerDisposals: () => listenerDisposals,
    dispose: async () => {
      try {
        await runtime.dispose();
      } finally {
        await StateAggregator.clearInstanceAsync();
        SfProject.clearInstances();
        vi.restoreAllMocks();
        coreFs.setFs(originalFs);
        vi.unstubAllEnvs();
        await FsPromises.rm(directory, { recursive: true, force: true });
      }
    }
  };
};

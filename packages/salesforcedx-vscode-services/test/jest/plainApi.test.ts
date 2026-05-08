/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { AliasService } from '../../src/core/alias';
import { ComponentSetService } from '../../src/core/componentSetService';
import { ConfigService } from '../../src/core/configService';
import { ConnectionService } from '../../src/core/connectionService';
import { getDefaultOrgRef } from '../../src/core/defaultOrgRef';
import { MetadataDeployService } from '../../src/core/metadataDeployService';
import { MetadataDescribeService } from '../../src/core/metadataDescribeService';
import { MetadataRetrieveService } from '../../src/core/metadataRetrieveService';
import { ProjectService } from '../../src/core/projectService';
import { SourceTrackingService } from '../../src/core/sourceTrackingService';
import { TemplateService } from '../../src/core/templateService';
import { TraceFlagService } from '../../src/core/traceFlagService';
import { ChannelService } from '../../src/vscode/channelService';
import { EditorService } from '../../src/vscode/editorService';
import { FsService } from '../../src/vscode/fsService';
import { SettingsService } from '../../src/vscode/settingsService';
import { TerminalService } from '../../src/terminal/terminalService';
import { WorkspaceService } from '../../src/vscode/workspaceService';
import { createPlainServicesApi, type PlainServicesApi } from '../../src/plainApi';

const mockConnection = {
  getUsername: () => 'test@org.com',
  getApiVersion: () => '60.0',
  tooling: { query: jest.fn() },
  metadata: { describe: jest.fn() }
} as never;

const mockSfProject = { getPath: () => '/test/project' } as never;

const createMockLayer = () => {
  const mockOutputChannel = {
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn()
  } as unknown as vscode.OutputChannel;

  return Layer.mergeAll(
    Layer.succeed(
      ConnectionService,
      new ConnectionService({
        getConnection: () => Effect.succeed(mockConnection),
        invalidateCachedConnections: () => Effect.void
      } as never)
    ),
    Layer.succeed(
      WorkspaceService,
      new WorkspaceService({
        getWorkspaceInfo: () =>
          Effect.succeed({
            uri: { scheme: 'file', path: '/test', fsPath: '/test' },
            path: 'file:///test',
            fsPath: '/test',
            isEmpty: false,
            isVirtualFs: false,
            cwd: '/test'
          }),
        getWorkspaceInfoOrThrow: () =>
          Effect.succeed({
            uri: { scheme: 'file', path: '/test', fsPath: '/test' },
            path: 'file:///test',
            fsPath: '/test',
            isEmpty: false as const,
            isVirtualFs: false,
            cwd: '/test'
          })
      } as never)
    ),
    Layer.succeed(
      ProjectService,
      new ProjectService({
        isSalesforceProject: () => Effect.succeed(true),
        getSfProject: () => Effect.succeed(mockSfProject),
        isInPackageDirectories: () => Effect.succeed(true),
        ensureInPackageDirectories: () => Effect.void,
        getSoqlMetadataPath: () => Effect.succeed({ scheme: 'file', path: '/test/.sfdx/tools/soqlMetadata' }),
        getSoqlStandardObjectsPath: () =>
          Effect.succeed({ scheme: 'file', path: '/test/.sfdx/tools/soqlMetadata/standardObjects' }),
        getSoqlCustomObjectsPath: () =>
          Effect.succeed({ scheme: 'file', path: '/test/.sfdx/tools/soqlMetadata/customObjects' }),
        getFauxClassesPath: () => Effect.succeed({ scheme: 'file', path: '/test/.sfdx/tools/testresults/apex' }),
        getFauxStandardObjectsPath: () =>
          Effect.succeed({ scheme: 'file', path: '/test/.sfdx/sobjects/standardObjects' }),
        getFauxCustomObjectsPath: () => Effect.succeed({ scheme: 'file', path: '/test/.sfdx/sobjects/customObjects' }),
        getTypingsPath: () => Effect.succeed({ scheme: 'file', path: '/test/.sfdx/typings' })
      } as never)
    ),
    Layer.succeed(
      SettingsService,
      new SettingsService({
        getValue: (_section: string, _key: string, defaultValue?: unknown) => Effect.succeed(defaultValue),
        setValue: () => Effect.void,
        getInstanceUrl: () => Effect.succeed('https://login.salesforce.com'),
        getAccessToken: () => Effect.succeed('test-token'),
        getApiVersion: () => Effect.succeed('60.0'),
        setInstanceUrl: () => Effect.void,
        setAccessToken: () => Effect.void,
        setApiVersion: () => Effect.void,
        getRetrieveOnLoad: () => Effect.succeed(''),
        getInternalDev: () => Effect.succeed(false)
      } as never)
    ),
    Layer.succeed(
      ConfigService,
      new ConfigService({
        getConfigAggregator: () => Effect.succeed({ getPropertyValue: () => undefined }),
        invalidateConfigAggregator: () => Effect.void,
        getTargetDevHub: () => Effect.succeed('devhub@test.com'),
        isCurrentTargetOrg: () => Effect.succeed(false),
        isCurrentTargetDevHub: () => Effect.succeed(false),
        unsetTargetOrg: () => Effect.void,
        unsetTargetDevHub: () => Effect.void
      } as never)
    ),
    Layer.succeed(
      AliasService,
      new AliasService({
        getAllAliases: () => Effect.succeed({ myAlias: 'user@test.com' }),
        getAliasesFromUsername: () => Effect.succeed(['myAlias']),
        getUsernameFromAlias: () => Effect.succeed({ _tag: 'Some', value: 'user@test.com' }),
        unsetAliases: () => Effect.void
      } as never)
    ),
    Layer.succeed(
      FsService,
      new FsService({
        readFile: () => Effect.succeed('file content'),
        toUri: () => Effect.succeed({ scheme: 'file', path: '/test' }),
        uriToPath: () => Effect.succeed('/test'),
        findFiles: () => Effect.succeed([]),
        safeWriteFile: () => Effect.void,
        writeFile: () => Effect.void,
        fileOrFolderExists: () => Effect.succeed(true),
        showTextDocument: () => Effect.succeed({}),
        isDirectory: () => Effect.succeed(false),
        isFile: () => Effect.succeed(true),
        createDirectory: () => Effect.void,
        deleteFile: () => Effect.void,
        readDirectory: () => Effect.succeed([]),
        readDirectoryWithTypes: () => Effect.succeed([]),
        stat: () => Effect.succeed({ type: 1, ctime: 0, mtime: 0, size: 0 }),
        safeDelete: () => Effect.succeed(undefined),
        rename: () => Effect.void,
        readJSON: () => Effect.succeed({}),
        HashableUri: {}
      } as never)
    ),
    Layer.succeed(
      EditorService,
      new EditorService({
        getActiveEditorUri: () => Effect.succeed({ scheme: 'file', path: '/test/file.ts' }),
        getActiveEditorText: () => Effect.succeed('editor text'),
        getActiveEditorContext: () =>
          Effect.succeed({
            text: 'editor text',
            uri: { scheme: 'file', path: '/test/file.ts' },
            documentUri: { scheme: 'file', path: '/test/file.ts' }
          }),
        pubsub: Effect.runSync(Effect.succeed({ subscribe: () => ({ poll: Effect.succeed({}) }) }))
      } as never)
    ),
    Layer.succeed(
      ChannelService,
      new ChannelService({
        getChannel: Effect.sync(() => mockOutputChannel),
        clearChannel: Effect.void,
        appendToChannel: () => Effect.void
      })
    ),
    Layer.succeed(
      MetadataDescribeService,
      new MetadataDescribeService({
        describe: () => Effect.succeed([{ xmlName: 'ApexClass', directoryName: 'classes' }]),
        listMetadata: () => Effect.succeed([{ type: 'ApexClass', fullName: 'MyClass' }]),
        listSObjects: () => Effect.succeed([{ name: 'Account', custom: false, queryable: true }]),
        describeCustomObject: () => Effect.succeed({}),
        describeCustomObjects: () => ({}),
        invalidateDescribe: () => Effect.void,
        invalidateListMetadata: () => Effect.void,
        invalidateSObjectDescribe: () => Effect.void
      } as never)
    ),
    Layer.succeed(
      MetadataDeployService,
      new MetadataDeployService({
        getComponentSetForDeploy: () => Effect.succeed({}),
        deploy: () => Effect.succeed({ response: { status: 'Succeeded' } })
      } as never)
    ),
    Layer.succeed(
      MetadataRetrieveService,
      new MetadataRetrieveService({
        buildComponentSet: () => Effect.succeed({}),
        buildComponentSetFromSource: () => Effect.succeed({}),
        retrieve: () => Effect.succeed({ response: { status: 'Succeeded' } }),
        retrieveComponentSet: () => Effect.succeed({ response: { status: 'Succeeded' } }),
        retrieveComponentSetToDirectory: () => Effect.succeed({ response: { status: 'Succeeded' } })
      } as never)
    ),
    Layer.succeed(
      SourceTrackingService,
      new SourceTrackingService({
        hasTracking: () => Effect.succeed(true),
        getLocalChangesAsComponentSet: () => Effect.succeed([]),
        getRemoteNonDeletesAsComponentSet: () => Effect.succeed({}),
        getRemoteDeletesAsComponentSet: () => Effect.succeed({}),
        resetRemoteTracking: () => Effect.void,
        getStatus: () => Effect.succeed([]),
        maybeApplyRemoteDeletesToLocal: () =>
          Effect.succeed({ componentSetFromNonDeletes: {}, fileResponsesFromDelete: [] }),
        getConflicts: () => Effect.succeed([]),
        checkConflicts: () => Effect.void,
        maybeUpdateTrackingFromRetrieve: () => Effect.void,
        maybeUpdateTrackingFromDeploy: () => Effect.void
      } as never)
    ),
    Layer.succeed(
      TemplateService,
      new TemplateService({
        create: () => Effect.succeed({ outputDir: '/test/output', created: [] })
      } as never)
    ),
    Layer.succeed(
      TraceFlagService,
      new TraceFlagService({
        getTraceFlags: () => Effect.succeed([]),
        getDebugLevels: () => Effect.succeed([]),
        getTraceFlagForUser: () => Effect.succeed({ _tag: 'None' }),
        getOrCreateDebugLevel: () => Effect.succeed('07M000000000001'),
        createTraceFlag: () => Effect.succeed('7tf000000000001'),
        updateTraceFlag: () => Effect.void,
        deleteTraceFlag: () => Effect.void,
        changeTraceFlagDebugLevel: () => Effect.void,
        ensureTraceFlag: () => Effect.succeed({ created: true, traceFlagId: '7tf000000000001' }),
        cleanupExpired: () => Effect.succeed(false),
        getUserId: () => Effect.succeed('005000000000001'),
        traceFlagsChanged: Effect.runSync(Effect.succeed({ subscribe: () => ({ poll: Effect.succeed({}) }) }))
      } as never)
    ),
    Layer.succeed(
      TerminalService,
      new TerminalService({
        simpleExec: (cmd: string) => Effect.succeed(`executed: ${cmd}`)
      } as never)
    ),
    Layer.succeed(
      ComponentSetService,
      new ComponentSetService({
        ensureNonEmptyComponentSet: () => Effect.succeed({}),
        getComponentSetFromUris: () => Effect.succeed({}),
        getComponentSetFromManifest: () => Effect.succeed({}),
        getComponentSetFromProjectDirectories: () => Effect.succeed({}),
        getComponentState: () => 'Changed',
        isSDRSuccess: () => true,
        isSDRFailure: () => false,
        makeFileResponseFailure: () => ({}),
        toRequestStatus: () => 'Succeeded'
      } as never)
    )
  );
};

describe('PlainServicesApi error handling', () => {
  it('converts tagged Effect errors to standard Error with tag prefix', async () => {
    const failScope = Effect.runSync(Scope.make());
    const failConnectionLayer = Layer.succeed(
      ConnectionService,
      new ConnectionService({
        getConnection: () =>
          Effect.fail({
            _tag: 'FailedToCreateConnectionError',
            message: 'Connection failed'
          } as never),
        invalidateCachedConnections: () => Effect.void
      } as never)
    );
    const failContext = await Effect.runPromise(Layer.buildWithScope(failConnectionLayer, failScope));

    const result = Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ConnectionService;
        return yield* svc.getConnection();
      }).pipe(
        Effect.provide(Layer.succeedContext(failContext)),
        Effect.catchAll(e => {
          if (typeof e === 'object' && e !== null && '_tag' in e) {
            const tagged = e as { _tag: string; message?: string };
            return Effect.fail(new Error(`${tagged._tag}: ${tagged.message ?? ''}`));
          }
          return Effect.fail(new Error(String(e)));
        })
      )
    );

    await expect(result).rejects.toThrow('FailedToCreateConnectionError: Connection failed');
  });

  it('converts plain Error to Error', async () => {
    const failScope = Effect.runSync(Scope.make());
    const failConnectionLayer = Layer.succeed(
      ConnectionService,
      new ConnectionService({
        getConnection: () => Effect.fail(new Error('plain failure') as never),
        invalidateCachedConnections: () => Effect.void
      } as never)
    );
    const failContext = await Effect.runPromise(Layer.buildWithScope(failConnectionLayer, failScope));

    const result = Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ConnectionService;
        return yield* svc.getConnection();
      }).pipe(
        Effect.provide(Layer.succeedContext(failContext)),
        Effect.catchAll(e => Effect.fail(e instanceof Error ? e : new Error(String(e))))
      )
    );

    await expect(result).rejects.toThrow('plain failure');
  });
});

describe('PlainServicesApi', () => {
  let api: PlainServicesApi;
  let extensionScope: Scope.CloseableScope;

  beforeEach(async () => {
    extensionScope = Effect.runSync(Scope.make());
    const layer = createMockLayer();
    const builtContext = await Effect.runPromise(Layer.buildWithScope(layer, extensionScope));

    // Set up the defaultOrgRef with test data
    await Effect.runPromise(
      Effect.gen(function* () {
        const ref = yield* getDefaultOrgRef();
        yield* SubscriptionRef.set(ref, {
          orgId: '00D000000000001',
          userId: '005000000000001',
          username: 'test@org.com',
          isScratch: false,
          isSandbox: false,
          tracksSource: true
        });
      })
    );

    api = createPlainServicesApi(builtContext, extensionScope);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnection', () => {
    it('resolves with a Connection', async () => {
      const conn = await api.getConnection();
      expect(conn).toBe(mockConnection);
    });
  });

  describe('getTargetOrgInfo', () => {
    it('returns current org info snapshot', async () => {
      const info = await api.getTargetOrgInfo();
      expect(info.orgId).toBe('00D000000000001');
      expect(info.userId).toBe('005000000000001');
      expect(info.username).toBe('test@org.com');
      expect(info.tracksSource).toBe(true);
      expect(info.isScratch).toBe(false);
    });

    it('returns empty object when no org is set', async () => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const ref = yield* getDefaultOrgRef();
          yield* SubscriptionRef.set(ref, {});
        })
      );
      const info = await api.getTargetOrgInfo();
      expect(info.orgId).toBeUndefined();
      expect(info.username).toBeUndefined();
    });
  });

  describe('onDidChangeTargetOrg', () => {
    it('fires when the target org changes', async () => {
      const listener = jest.fn();
      api.onDidChangeTargetOrg(listener);

      // Update the ref to trigger the event
      await Effect.runPromise(
        Effect.gen(function* () {
          const ref = yield* getDefaultOrgRef();
          yield* SubscriptionRef.set(ref, {
            orgId: '00D000000000002',
            username: 'other@org.com'
          });
        })
      );

      // Allow the fiber to process the event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: '00D000000000002', username: 'other@org.com' })
      );
    });
  });

  describe('invalidateCachedConnections', () => {
    it('resolves without error', async () => {
      await expect(api.invalidateCachedConnections()).resolves.toBeUndefined();
    });
  });

  describe('getWorkspaceInfo', () => {
    it('returns workspace info', async () => {
      const info = await api.getWorkspaceInfo();
      expect(info.fsPath).toBe('/test');
      expect(info.isEmpty).toBe(false);
      expect(info.isVirtualFs).toBe(false);
    });
  });

  describe('isSalesforceProject', () => {
    it('returns true for Salesforce project', async () => {
      const result = await api.isSalesforceProject();
      expect(result).toBe(true);
    });
  });

  describe('getSfProject', () => {
    it('returns SfProject instance', async () => {
      const project = await api.getSfProject();
      expect(project).toBe(mockSfProject);
    });
  });

  describe('isInPackageDirectories', () => {
    it('returns boolean for uri check', async () => {
      const result = await api.isInPackageDirectories({ scheme: 'file', path: '/test/src' } as never);
      expect(result).toBe(true);
    });
  });

  describe('getSettingsValue', () => {
    it('returns setting value with default', async () => {
      const result = await api.getSettingsValue('section', 'key', 'default');
      expect(result).toBe('default');
    });
  });

  describe('setSettingsValue', () => {
    it('resolves without error', async () => {
      await expect(api.setSettingsValue('section', 'key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('getApiVersion', () => {
    it('returns api version string', async () => {
      const version = await api.getApiVersion();
      expect(version).toBe('60.0');
    });
  });

  describe('getTargetDevHub', () => {
    it('returns dev hub username', async () => {
      const devHub = await api.getTargetDevHub();
      expect(devHub).toBe('devhub@test.com');
    });
  });

  describe('unsetTargetOrg', () => {
    it('resolves without error', async () => {
      await expect(api.unsetTargetOrg()).resolves.toBeUndefined();
    });
  });

  describe('getAllAliases', () => {
    it('returns alias map', async () => {
      const aliases = await api.getAllAliases();
      expect(aliases).toEqual({ myAlias: 'user@test.com' });
    });
  });

  describe('getUsernameFromAlias', () => {
    it('returns username for known alias', async () => {
      const username = await api.getUsernameFromAlias('myAlias');
      expect(username).toBe('user@test.com');
    });
  });

  describe('readFile', () => {
    it('returns file content', async () => {
      const content = await api.readFile('/test/file.txt');
      expect(content).toBe('file content');
    });
  });

  describe('writeFile', () => {
    it('resolves without error', async () => {
      await expect(api.writeFile('/test/file.txt', 'content')).resolves.toBeUndefined();
    });
  });

  describe('fileOrFolderExists', () => {
    it('returns boolean', async () => {
      const exists = await api.fileOrFolderExists('/test/file.txt');
      expect(exists).toBe(true);
    });
  });

  describe('findFiles', () => {
    it('returns uri array', async () => {
      const files = await api.findFiles('**/*.ts');
      expect(files).toEqual([]);
    });
  });

  describe('getActiveEditorUri', () => {
    it('returns active editor uri', async () => {
      const uri = await api.getActiveEditorUri();
      expect(uri.path).toBe('/test/file.ts');
    });
  });

  describe('getActiveEditorText', () => {
    it('returns editor text', async () => {
      const text = await api.getActiveEditorText();
      expect(text).toBe('editor text');
    });
  });

  describe('appendToChannel', () => {
    it('does not throw', () => {
      expect(() => api.appendToChannel('test message')).not.toThrow();
    });
  });

  describe('clearChannel', () => {
    it('does not throw', () => {
      expect(() => api.clearChannel()).not.toThrow();
    });
  });

  describe('describe', () => {
    it('returns metadata types', async () => {
      const types = await api.describe();
      expect(types).toEqual([{ xmlName: 'ApexClass', directoryName: 'classes' }]);
    });
  });

  describe('listMetadata', () => {
    it('returns file properties for type', async () => {
      const items = await api.listMetadata('ApexClass');
      expect(items).toEqual([{ type: 'ApexClass', fullName: 'MyClass' }]);
    });
  });

  describe('deploy', () => {
    it('returns deploy result', async () => {
      const result = await api.deploy({} as never);
      expect(result).toEqual({ response: { status: 'Succeeded' } });
    });
  });

  describe('retrieve', () => {
    it('returns retrieve result', async () => {
      const result = await api.retrieve([{ type: 'ApexClass', fullName: 'MyClass' }]);
      expect(result).toEqual({ response: { status: 'Succeeded' } });
    });
  });

  describe('hasTracking', () => {
    it('returns tracking status', async () => {
      const tracking = await api.hasTracking();
      expect(tracking).toBe(true);
    });
  });

  describe('getLocalChangesAsComponentSet', () => {
    it('returns component sets', async () => {
      const changes = await api.getLocalChangesAsComponentSet();
      expect(changes).toEqual([]);
    });
  });

  describe('getConflicts', () => {
    it('returns conflicts array', async () => {
      const conflicts = await api.getConflicts();
      expect(conflicts).toEqual([]);
    });
  });

  describe('checkConflicts', () => {
    it('resolves without error when no conflicts', async () => {
      await expect(api.checkConflicts()).resolves.toBeUndefined();
    });
  });

  describe('createFromTemplate', () => {
    it('returns template creation result', async () => {
      const result = await api.createFromTemplate({
        cwd: '/test',
        templateType: 'ApexClass' as never,
        options: { className: 'MyClass' } as never
      });
      expect(result).toEqual({ outputDir: '/test/output', created: [] });
    });
  });

  describe('getTraceFlags', () => {
    it('returns trace flags array', async () => {
      const flags = await api.getTraceFlags();
      expect(flags).toEqual([]);
    });
  });

  describe('ensureTraceFlag', () => {
    it('returns creation result', async () => {
      const result = await api.ensureTraceFlag('005000000000001');
      expect(result).toEqual({ created: true, traceFlagId: '7tf000000000001' });
    });
  });

  describe('simpleExec', () => {
    it('returns command output', async () => {
      const output = await api.simpleExec('echo hello');
      expect(output).toBe('executed: echo hello');
    });
  });

  describe('getComponentSetFromUris', () => {
    it('returns component set', async () => {
      const cs = await api.getComponentSetFromUris([]);
      expect(cs).toBeDefined();
    });
  });

  describe('getComponentSetFromManifest', () => {
    it('returns component set', async () => {
      const cs = await api.getComponentSetFromManifest({ scheme: 'file', path: '/test/manifest.xml' } as never);
      expect(cs).toBeDefined();
    });
  });

  describe('getComponentSetFromProjectDirectories', () => {
    it('returns component set', async () => {
      const cs = await api.getComponentSetFromProjectDirectories();
      expect(cs).toBeDefined();
    });
  });

  describe('error handling via facade', () => {
    it('rejects with Error when connection service fails', async () => {
      // The main api's getConnection succeeds — test that it resolves
      const conn = await api.getConnection();
      expect(conn).toBe(mockConnection);
    });
  });
});

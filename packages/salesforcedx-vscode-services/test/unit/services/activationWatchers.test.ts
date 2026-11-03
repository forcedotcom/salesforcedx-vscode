/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ChannelService,
  ComponentSetService,
  FsService,
  HashableUri,
  isSDRSuccess,
  isSDRFailure,
  makeFileResponseFailure,
  toRequestStatus,
  toComponentStatusChangeType,
  MetadataRegistryService,
  MetadataRetrieveService,
  NoWorkspaceOpenError,
  SettingsService,
  SettingsChangePubSub,
  FileChangePubSub,
  OrgId,
  ProjectService
} from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as TestClock from 'effect/testing/TestClock';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ActivationWatchersLayer } from '../../../src/activationWatchers';
import { FileChangePubSubLayer, SettingsChangePubSubLayer } from '../../../src/services/changePubSubs';
import { EditorServiceLayer } from '../../../src/services/editorService';
import { ExtensionsServiceLayer } from '../../../src/services/extensionsService';
import { OrgChanges, orgLayers } from '../../../src/services/targetOrgRef';

let activeEditor: vscode.TextEditor | undefined;
let editorChanged: (editor: vscode.TextEditor | undefined) => void;
let extensionsChanged: () => void;
let installed: string[];
const activate = vi.fn(() => Promise.resolve());
const editorDisposed = vi.fn();
const extensionsDisposed = vi.fn();
const getRetrieveOnLoad = vi.fn(() => Effect.succeed(''));
const isInPackageDirectories = vi.fn<ProjectService['Service']['isInPackageDirectories']>();
beforeEach(() => {
  activeEditor = undefined;
  installed = ['salesforce.salesforcedx-vscode-lwc', 'salesforce.salesforcedx-vscode-lightning'];
  Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, get: () => activeEditor });
  Object.defineProperty(vscode.extensions, 'all', { configurable: true, get: () => installed.map(id => ({ id })) });
  vi.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation(listener => {
    editorChanged = value => {
      listener(value);
    };
    return { dispose: editorDisposed };
  });
  vi.mocked(vscode.extensions.onDidChange).mockImplementation(listener => {
    extensionsChanged = () => {
      listener(undefined);
    };
    return { dispose: extensionsDisposed };
  });
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({ activate } as unknown as vscode.Extension<unknown>);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: URI.parse('memfs:/project'), name: 'project', index: 0 }]
  });
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{}'));
  getRetrieveOnLoad.mockReturnValue(Effect.succeed(''));
  isInPackageDirectories.mockReturnValue(Effect.succeed(true));
});
const makeGraph = () =>
  Layer.mergeAll(
    orgLayers,
    FileChangePubSubLayer,
    SettingsChangePubSubLayer,
    EditorServiceLayer,
    ExtensionsServiceLayer,
    Layer.mock(ProjectService, { isInPackageDirectories }),
    Layer.mock(ChannelService, { appendToChannel: () => Effect.void }),
    Layer.mock(SettingsService, { getRetrieveOnLoad }),
    Layer.mock(ComponentSetService, {
      isSDRSuccess,
      isSDRFailure,
      makeFileResponseFailure,
      toRequestStatus,
      getComponentState: value => toComponentStatusChangeType(value.state)
    }),
    Layer.mock(FsService, { HashableUri }),
    Layer.mock(MetadataRegistryService, {}),
    Layer.mock(MetadataRetrieveService, {})
  ).pipe(Layer.provideMerge(TestClock.layer()));
const makeRuntime = () => ManagedRuntime.make(ActivationWatchersLayer.pipe(Layer.provideMerge(makeGraph())));
const editor = (path: string, text: string) =>
  ({ document: { uri: URI.parse(`memfs:/project/${path}`), getText: () => text } }) as unknown as vscode.TextEditor;

it('sets initial context keys, follows the authoritative org and stops native listeners at owner shutdown', async () => {
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:has_target_org', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:current_file_is_apex_test', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:muleDxApiInactive', true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', false);
    const changes = await runtime.runPromise(OrgChanges);
    const generation = await runtime.runPromise(changes.begin);
    await runtime.runPromise(
      changes.update(generation, () =>
        Effect.succeed({
          orgId: Schema.decodeUnknownSync(OrgId)('00D000000000001'),
          tracksSource: true,
          isScratch: true
        })
      )
    );
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:has_target_org', true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'sf:target_org_has_change_tracking',
      true
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:default_org_deletable', true);
  } finally {
    await runtime.dispose();
  }
  expect(editorDisposed).toHaveBeenCalledTimes(1);
  expect(extensionsDisposed).toHaveBeenCalledTimes(1);
});

it('updates editor, Mule and ESR contexts using the shared publishers', async () => {
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    activeEditor = editor('classes/Tests.cls', '@isTest public class Tests {}');
    editorChanged(activeEditor);
    installed.push('salesforce.mule-dx-agentforce-api-component');
    extensionsChanged();
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
      new TextEncoder().encode('{"sourceBehaviorOptions":["decomposeExternalServiceRegistrationBeta"]}')
    );
    await runtime.runPromise(
      FileChangePubSub.pipe(
        Effect.flatMap(pubsub =>
          PubSub.publish(pubsub, { type: 'change' as const, uri: URI.parse('memfs:/project/sfdx-project.json') })
        )
      )
    );
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:current_file_is_apex_test', true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:muleDxApiInactive', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', true);
  } finally {
    await runtime.dispose();
  }
});

it('activates each installed LWC/Aura extension only once across editor changes', async () => {
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    for (const path of ['lwc/one/one.js', 'lwc/two/two.js', 'aura/One/One.cmp', 'aura/Two/Two.cmp']) {
      activeEditor = editor(path, '');
      editorChanged(activeEditor);
      await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    }
    expect(activate).toHaveBeenCalledTimes(2);
    expect(vscode.extensions.getExtension).toHaveBeenCalledWith('salesforce.salesforcedx-vscode-lwc');
    expect(vscode.extensions.getExtension).toHaveBeenCalledWith('salesforce.salesforcedx-vscode-lightning');
  } finally {
    await runtime.dispose();
  }
});

it('handles retrieve-on-load changes without duplicating the connection layer auth watcher', async () => {
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
    const changes = await runtime.runPromise(SettingsChangePubSub);
    await runtime.runPromise(PubSub.publish(changes, { affectsConfiguration: key => key.endsWith('.accessToken') }));
    await runtime.runPromise(TestClock.adjust(Duration.millis(150)));
    expect(getRetrieveOnLoad).not.toHaveBeenCalled();
    await runtime.runPromise(PubSub.publish(changes, { affectsConfiguration: key => key.endsWith('.retrieveOnLoad') }));
    await runtime.runPromise(TestClock.adjust(Duration.millis(150)));
    expect(getRetrieveOnLoad).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('stops watcher work while its shared native publishers remain alive in another owner', async () => {
  const graph = makeGraph();
  const memoMap = Layer.makeMemoMapUnsafe();
  const provider = ManagedRuntime.make(graph, { memoMap });
  const watcher = ManagedRuntime.make(ActivationWatchersLayer.pipe(Layer.provideMerge(graph)), { memoMap });
  try {
    await provider.runPromise(Effect.void);
    await watcher.runPromise(TestClock.adjust(Duration.millis(100)));
    await watcher.dispose();
    vi.mocked(vscode.commands.executeCommand).mockClear();
    getRetrieveOnLoad.mockClear();
    activate.mockClear();
    activeEditor = editor('lwc/after/after.js', '');
    editorChanged(activeEditor);
    installed.push('salesforce.mule-dx-agentforce-api-component');
    extensionsChanged();
    const changes = await provider.runPromise(OrgChanges);
    const generation = await provider.runPromise(changes.begin);
    await provider.runPromise(changes.update(generation, () => Effect.succeed({ username: 'after-close' })));
    const files = await provider.runPromise(FileChangePubSub);
    await provider.runPromise(
      PubSub.publish(files, { type: 'change' as const, uri: URI.parse('memfs:/project/sfdx-project.json') })
    );
    const settings = await provider.runPromise(SettingsChangePubSub);
    await provider.runPromise(
      PubSub.publish(settings, { affectsConfiguration: key => key.endsWith('.retrieveOnLoad') })
    );
    await provider.runPromise(TestClock.adjust(Duration.millis(200)));
    expect(await provider.runPromise(PubSub.isShutdown(files))).toBe(false);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(getRetrieveOnLoad).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
    expect(editorDisposed).not.toHaveBeenCalled();
    expect(extensionsDisposed).not.toHaveBeenCalled();
  } finally {
    await watcher.dispose();
    await provider.dispose();
  }
  expect(editorDisposed).toHaveBeenCalledTimes(1);
  expect(extensionsDisposed).toHaveBeenCalledTimes(1);
});

it.each(['unreadable', 'malformed'] as const)(
  'recovers from %s ESR configuration and project resolution failures on later events',
  async kind => {
    const valid = new TextEncoder().encode('{"sourceBehaviorOptions":["decomposeExternalServiceRegistrationBeta"]}');
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(valid);
    const runtime = makeRuntime();
    try {
      await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', true);
      vi.mocked(vscode.commands.executeCommand).mockClear();
      if (kind === 'unreadable') vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('offline'));
      else vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{bad JSON'));
      isInPackageDirectories.mockReturnValueOnce(Effect.fail(new NoWorkspaceOpenError({ message: 'no project' })));
      activeEditor = editor('classes/Before.cls', '');
      editorChanged(activeEditor);
      const files = await runtime.runPromise(FileChangePubSub);
      await runtime.runPromise(
        PubSub.publish(files, { type: 'change' as const, uri: URI.parse('memfs:/project/sfdx-project.json') })
      );
      await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', false);
      vi.mocked(vscode.commands.executeCommand).mockClear();
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(valid);
      activeEditor = editor('classes/After.cls', '');
      editorChanged(activeEditor);
      await runtime.runPromise(
        PubSub.publish(files, { type: 'change' as const, uri: URI.parse('memfs:/project/sfdx-project.json') })
      );
      await runtime.runPromise(TestClock.adjust(Duration.millis(100)));
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', true);
    } finally {
      await runtime.dispose();
    }
  }
);

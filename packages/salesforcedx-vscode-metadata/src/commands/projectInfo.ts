/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { sourceComponentToPaths } from '../shared/diff/diffHelpers';

type MetadataTypeStat = {
  componentCount: number;
  fileCount: number;
  totalSizeKb: number;
};

type OrgInfo = {
  orgType: string;
  tracksSource: boolean | undefined;
  sourceMemberCount: string | number;
};

type MetadataInfo = {
  typeStats: readonly (readonly [string, MetadataTypeStat])[];
  sourceApiVersion: string;
  packageDirCount: number;
  namespace: string;
};

type EnvInfo = {
  cliVersion: string;
  javaVersion: string;
  vscodeVersion: string;
  nodeVersion: string;
  os: string;
  extensions: readonly { id: string; version: string }[];
};

const gatherMetadataInfo = Effect.fn('gatherMetadataInfo')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
  const project = yield* api.services.ProjectService.getSfProject();
  const fsService = yield* api.services.FsService;

  const components = Array.from(componentSet.getSourceComponents());

  const typeGroups = Map.groupBy(components, comp => comp.type.name);

  const fileSizesMap = yield* Stream.fromIterable(components).pipe(
    Stream.mapConcat(comp => sourceComponentToPaths(comp).map(file => ({ typeName: comp.type.name, file }))),
    Stream.mapEffect(({ typeName, file }) =>
      fsService.stat(file).pipe(
        Effect.map(s => ({ typeName, size: s.size })),
        Effect.orElseSucceed(() => ({ typeName, size: 0 }))
      )
    ),
    Stream.runFold(new Map<string, { totalSize: number; fileCount: number }>(), (acc, { typeName, size }) => {
      const prev = acc.get(typeName) ?? { totalSize: 0, fileCount: 0 };
      return acc.set(typeName, { totalSize: prev.totalSize + size, fileCount: prev.fileCount + 1 });
    })
  );

  const typeStats = [...typeGroups.keys()]
    .toSorted((a, b) => a.localeCompare(b))
    .map(typeName => {
      const { totalSize = 0, fileCount = 0 } = fileSizesMap.get(typeName) ?? {};
      return [
        typeName,
        {
          componentCount: typeGroups.get(typeName)?.length ?? 0,
          fileCount,
          totalSizeKb: Math.round(totalSize / 1024)
        }
      ] as const;
    });

  return {
    typeStats,
    sourceApiVersion: componentSet.sourceApiVersion ?? 'unknown',
    packageDirCount: project.getPackageDirectories().length,
    namespace: project.getSfProjectJson().getContents().namespace ?? 'none'
  };
});

const gatherOrgInfo = Effect.fn('gatherOrgInfo')(
  function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* api.services.TargetOrgRef();
    const orgInfo = yield* SubscriptionRef.get(ref);
    const orgType = orgInfo.isScratch ? 'scratch' : orgInfo.isSandbox ? 'sandbox' : 'production';

    const conn = yield* api.services.ConnectionService.getConnection();
    const sourceMemberCount = orgInfo.tracksSource
      ? yield* Effect.tryPromise(
          async () => (await conn.tooling.query('SELECT COUNT() FROM SourceMember')).totalSize
        ).pipe(Effect.orElseSucceed(() => 'query failed'))
      : 'N/A';

    return {
      orgType,
      tracksSource: orgInfo.tracksSource,
      sourceMemberCount
    };
  },
  // Org section degrades gracefully so the report is always produced
  Effect.catchAll(() =>
    Effect.succeed<OrgInfo>({
      orgType: 'N/A',
      tracksSource: undefined,
      sourceMemberCount: 'N/A'
    })
  )
);

const getSettingEntry = (fullKey: string): readonly [string, unknown] => {
  const firstDot = fullKey.indexOf('.');
  return [fullKey, vscode.workspace.getConfiguration(fullKey.slice(0, firstDot)).get(fullKey.slice(firstDot + 1))];
};

const gatherSettings = (): readonly (readonly [string, unknown])[] => [
  getSettingEntry('salesforcedx-vscode-metadata.showSuccessNotification'),
  getSettingEntry('salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds'),
  getSettingEntry('salesforcedx-vscode-core.push-or-deploy-on-save.enabled'),
  getSettingEntry('salesforcedx-vscode-core.push-or-deploy-on-save.ignoreConflictsOnPush'),
  getSettingEntry('salesforcedx-vscode-core.detectConflictsForDeployAndRetrieve'),
  getSettingEntry('salesforcedx-vscode-core.clearOutputTab'),
  getSettingEntry('salesforcedx-vscode-core.show-cli-success-msg'),
  getSettingEntry('salesforcedx-vscode-core.telemetry.enabled'),
  getSettingEntry('salesforcedx-vscode-core.enable-sobject-refresh-on-startup'),
  getSettingEntry('salesforcedx-vscode-core.telemetry-tag'),
  getSettingEntry('salesforcedx-vscode-salesforcedx.enableLocalTraces'),
  getSettingEntry('salesforcedx-vscode-salesforcedx.enableConsoleTraces'),
  getSettingEntry('salesforcedx-vscode-salesforcedx.enableFileTraces'),
  getSettingEntry('salesforcedx-vscode-apex.java.home')
];

const gatherEnvironment = Effect.fn('gatherEnvironment')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminalService = yield* api.services.TerminalService;
  const [cliVersion, javaVersion] = yield* Effect.all(
    [
      terminalService.simpleExec('sf --version').pipe(Effect.orElseSucceed(() => 'unknown')),
      terminalService.simpleExec('java --version').pipe(
        Effect.map(out => out.split('\n')[0]?.trim() ?? out),
        Effect.orElseSucceed(() => 'unknown')
      )
    ],
    { concurrency: 'unbounded' }
  );
  const extensions = vscode.extensions.all
    .filter(e => e.packageJSON?.publisher === 'salesforce')
    .map(e => ({ id: e.id, version: String(e.packageJSON.version) }))
    .toSorted((a, b) => a.id.localeCompare(b.id));
  return {
    cliVersion,
    javaVersion,
    vscodeVersion: vscode.version,
    nodeVersion: process.version,
    os: `${os.type()} ${os.release()}`,
    extensions
  };
});

const mdTable = (headers: string[], rows: readonly string[][]): string => {
  const header = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
  return [header, separator, body].join('\n');
};

const renderMarkdown = ({
  metadataInfo,
  orgInfo,
  settings,
  envInfo
}: {
  metadataInfo: MetadataInfo;
  orgInfo: OrgInfo;
  settings: readonly (readonly [string, unknown])[];
  envInfo: EnvInfo;
}): string => {
  const timestamp = new Date().toISOString();

  const metaSection = [
    '## Metadata',
    '',
    `sourceApiVersion: ${metadataInfo.sourceApiVersion}`,
    `packageDirectories: ${metadataInfo.packageDirCount}`,
    `namespace: ${metadataInfo.namespace}`,
    '',
    '### Types',
    '',
    mdTable(
      ['Type', 'Components', 'Files', 'Size (KB)'],
      metadataInfo.typeStats.map(([typeName, stat]) => [
        typeName,
        String(stat.componentCount),
        String(stat.fileCount),
        String(stat.totalSizeKb)
      ])
    )
  ].join('\n');

  const orgSection = [
    '## Org',
    '',
    mdTable(
      ['Key', 'Value'],
      [
        ['Org type', orgInfo.orgType],
        ['Source tracking', String(orgInfo.tracksSource ?? 'unknown')],
        ['SourceMember count', String(orgInfo.sourceMemberCount)]
      ]
    )
  ].join('\n');

  const settingsSection = [
    '## Settings',
    '',
    mdTable(
      ['Setting', 'Value'],
      settings.map(([key, value]) => [key, String(value ?? '')])
    )
  ].join('\n');

  const envSection = [
    '## Environment',
    '',
    mdTable(
      ['Key', 'Value'],
      [
        ['Salesforce CLI', envInfo.cliVersion],
        ['Java', envInfo.javaVersion],
        ['VS Code', envInfo.vscodeVersion],
        ['Node', envInfo.nodeVersion],
        ['OS', envInfo.os]
      ]
    )
  ].join('\n');

  const extensionsSection = [
    '## Extensions (Salesforce)',
    '',
    mdTable(
      ['Extension', 'Version'],
      envInfo.extensions.map(e => [e.id, e.version])
    )
  ].join('\n');

  return [
    '# Project Info',
    '',
    `Generated: ${timestamp}`,
    '',
    metaSection,
    '',
    orgSection,
    '',
    settingsSection,
    '',
    envSection,
    '',
    extensionsSection,
    ''
  ].join('\n');
};

const doProjectInfo = Effect.fn('doProjectInfo')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const [metadataInfo, orgInfo, envInfo] = yield* Effect.all(
    [gatherMetadataInfo(), gatherOrgInfo(), gatherEnvironment()],
    { concurrency: 'unbounded' }
  );
  const settings = gatherSettings();

  const content = renderMarkdown({ metadataInfo, orgInfo, settings, envInfo });

  const workspaceService = yield* api.services.WorkspaceService;
  const { uri: workspaceUri } = yield* workspaceService.getWorkspaceInfo();
  const outputUri = Utils.joinPath(workspaceUri, '.sf', 'project-info.md');

  yield* api.services.FsService.safeWriteFile(outputUri, content);

  yield* Effect.sync(() => {
    void vscode.window
      .showInformationMessage(nls.localize('project_info_written_message'), nls.localize('open_button'))
      .then(selection => {
        if (selection === nls.localize('open_button')) {
          void vscode.window.showTextDocument(outputUri);
        }
      });
  });
});

export const projectInfoCommand = Effect.fn('projectInfoCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  return yield* doProjectInfo().pipe(promptService.withProgress(nls.localize('project_info_gathering_progress')));
});

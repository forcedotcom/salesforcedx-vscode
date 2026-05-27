/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, ConfigUtil, getConnection } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  CliCommandExecutor: jest.fn(),
  ConfigUtil: { getTargetOrgOrAlias: jest.fn() },
  getConnection: jest.fn(),
  workspaceUtils: { getRootWorkspacePath: jest.fn().mockReturnValue('/workspace') }
}));

jest.mock('../../../src/channels', () => ({
  OUTPUT_CHANNEL: {
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
    hide: jest.fn(),
    replace: jest.fn(),
    append: jest.fn(),
    name: 'Salesforce CLI'
  },
  channelService: { appendLine: jest.fn(), showChannelOutput: jest.fn() }
}));

jest.mock('../../../src/messages', () => ({
  nls: { localize: (key: string) => key }
}));

import { PackageInstallExecutor, PackageIdAndInstallationKey } from '../../../src/commands/packageInstall';

const MockCliCommandExecutor = CliCommandExecutor as jest.MockedClass<typeof CliCommandExecutor>;
const mockGetTargetOrgOrAlias = jest.mocked(ConfigUtil.getTargetOrgOrAlias);
const mockGetConnection = jest.mocked(getConnection);

const PACKAGE_ID = '04tKY000000MF7uYAG';

const makeResponse = (
  packageId: string,
  installationKey = ''
): { type: 'CONTINUE'; data: PackageIdAndInstallationKey } => ({
  type: 'CONTINUE',
  data: { packageId, installationKey }
});

const mockProgress: vscode.Progress<{ message?: string }> = { report: jest.fn() };
const mockToken = new vscode.CancellationTokenSource().token;

// Executor with zero poll delay so tests run instantly
const makeExecutor = () => new PackageInstallExecutor(0);

// Build a mock tooling.query that returns the given sequence of statuses
const setupConnectionMock = (...statuses: (string | null)[]) => {
  const queryFn = jest.fn();
  for (const status of statuses) {
    if (status === null) {
      queryFn.mockResolvedValueOnce({ records: [] });
    } else {
      queryFn.mockResolvedValueOnce({
        records: [{ Status: status, SubscriberPackageVersionKey: PACKAGE_ID }]
      });
    }
  }
  mockGetConnection.mockResolvedValue({
    tooling: { query: queryFn }
  } as any);
  return queryFn;
};

beforeEach(() => {
  mockGetTargetOrgOrAlias.mockResolvedValue('testOrg');
  MockCliCommandExecutor.mockImplementation(
    () =>
      ({
        execute: jest.fn().mockReturnValue({
          command: { toString: () => 'sf', logName: 'pkg', command: 'sf', args: [] },
          processExitSubject: { subscribe: jest.fn() },
          processErrorSubject: { subscribe: jest.fn() },
          stdoutSubject: { subscribe: jest.fn() },
          stderrSubject: { subscribe: jest.fn() }
        })
      }) as any
  );
});

describe('PackageInstallExecutor.run', () => {
  it('returns true when first poll is SUCCESS', async () => {
    setupConnectionMock('SUCCESS');

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
  });

  it('returns false when first poll is ERROR', async () => {
    setupConnectionMock('ERROR');

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(false);
  });

  it('keeps polling through IN_PROGRESS until SUCCESS', async () => {
    const queryFn = setupConnectionMock('IN_PROGRESS', 'IN_PROGRESS', 'SUCCESS');

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('retries when getConnection throws (transient error)', async () => {
    const queryFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('auth error'))
      .mockResolvedValueOnce({ records: [{ Status: 'SUCCESS', SubscriberPackageVersionKey: PACKAGE_ID }] });
    mockGetConnection
      .mockRejectedValueOnce(new Error('auth error'))
      .mockResolvedValue({ tooling: { query: queryFn } } as any);

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
  });

  it('retries when query returns empty records (request not created yet)', async () => {
    const queryFn = setupConnectionMock(null, 'SUCCESS');

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('matches by 15-char prefix when stored ID is 15 chars', async () => {
    const queryFn = jest.fn().mockResolvedValueOnce({
      records: [{ Status: 'SUCCESS', SubscriberPackageVersionKey: PACKAGE_ID.slice(0, 15) }]
    });
    mockGetConnection.mockResolvedValue({ tooling: { query: queryFn } } as any);

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
  });

  it('passes targetOrg to getConnection', async () => {
    setupConnectionMock('SUCCESS');

    await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(mockGetConnection).toHaveBeenCalledWith('testOrg');
  });

  it('passes undefined targetOrg to getConnection when org is not configured', async () => {
    mockGetTargetOrgOrAlias.mockResolvedValue(undefined);
    setupConnectionMock('SUCCESS');

    await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(mockGetConnection).toHaveBeenCalledWith(undefined);
  });

  it('shows polling progress message', async () => {
    setupConnectionMock('SUCCESS');

    const progress: vscode.Progress<{ message?: string }> = { report: jest.fn() };
    await makeExecutor().run(makeResponse(PACKAGE_ID), progress, mockToken);

    expect(progress.report).toHaveBeenCalledWith({ message: 'package_install_polling_message' });
  });

  it('passes --installation-key to install command', async () => {
    setupConnectionMock('SUCCESS');

    await makeExecutor().run(makeResponse(PACKAGE_ID, 'mySecretKey'), mockProgress, mockToken);

    const installArgs = MockCliCommandExecutor.mock.calls[0][0].args;
    expect(installArgs).toContain('--installation-key');
    expect(installArgs).toContain('mySecretKey');
  });

  it('passes --target-org to install command', async () => {
    setupConnectionMock('SUCCESS');

    await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    const installArgs = MockCliCommandExecutor.mock.calls[0][0].args;
    expect(installArgs).toContain('--target-org');
    expect(installArgs).toContain('testOrg');
  });

  it('falls back to result[0] when package ID is not in list', async () => {
    const queryFn = jest.fn().mockResolvedValueOnce({
      records: [{ Status: 'SUCCESS', SubscriberPackageVersionKey: '04tOTHER000000000' }]
    });
    mockGetConnection.mockResolvedValue({ tooling: { query: queryFn } } as any);

    const result = await makeExecutor().run(makeResponse(PACKAGE_ID), mockProgress, mockToken);

    expect(result).toBe(true);
  });
});

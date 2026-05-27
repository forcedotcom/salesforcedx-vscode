/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CancelResponse,
  CliCommandExecutor,
  CompositeParametersGatherer,
  ConfigUtil,
  ContinueResponse,
  getConnection,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { PKG_ID_PREFIX } from '../constants';
import { nls } from '../messages';
import { EmptyPreChecker } from './util';

const POLL_INTERVAL_MS = 30_000;

const isAlphaNumString = (value: string | undefined): boolean =>
  value !== undefined && value !== '' && !/\W/.test(value);

const isRecordIdFormat = (value: string = '', prefix: string): boolean =>
  isAlphaNumString(value) && value.startsWith(prefix) && (value.length === 15 || value.length === 18);

export type PackageIdAndInstallationKey = PackageID & InstallationKey;

type PackageID = {
  packageId: string;
};

type InstallationKey = {
  installationKey: string;
};

export class PackageInstallExecutor extends LibraryCommandletExecutor<PackageIdAndInstallationKey> {
  private readonly pollIntervalMs: number;

  constructor(pollIntervalMs = POLL_INTERVAL_MS) {
    super(nls.localize('package_install_text'), 'package_install', OUTPUT_CHANNEL);
    this.cancellable = true;
    this.pollIntervalMs = pollIntervalMs;
  }

  public async run(
    response: ContinueResponse<PackageIdAndInstallationKey>,
    progress?: vscode.Progress<{ message?: string }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    const { packageId, installationKey } = response.data;
    const targetOrg = await ConfigUtil.getTargetOrgOrAlias();
    const cwd = workspaceUtils.getRootWorkspacePath();

    // Fire the install with --wait 0; we never read its output because the
    // sf CLI process hangs on some versions regardless of flags.
    const installBuilder = new SfCommandBuilder()
      .withDescription(nls.localize('package_install_text'))
      .withArg('package:install')
      .withFlag('--package', packageId)
      .withFlag('--wait', '0')
      .withJson()
      .withLogName('package_install');

    if (installationKey) {
      installBuilder.withFlag('--installation-key', installationKey);
    }
    if (targetOrg) {
      installBuilder.withFlag('--target-org', targetOrg);
    }

    new CliCommandExecutor(installBuilder.build(), {
      cwd,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(token);

    // Poll the org directly via @salesforce/core Connection — no CLI processes,
    // no hanging, no timeouts needed.
    progress?.report({ message: nls.localize('package_install_polling_message') });

    while (true) {
      await sleep(this.pollIntervalMs, token);

      if (token?.isCancellationRequested) {
        return false;
      }

      const status = await queryInstallStatus(packageId, targetOrg);

      if (status === 'SUCCESS') {
        return true;
      }
      if (status === 'ERROR') {
        return false;
      }
      // undefined (not created yet / transient error) or IN_PROGRESS — keep polling
    }
  }
}

// Normalize a 15- or 18-char Salesforce ID to its 15-char prefix for comparison.
const to15 = (id: string) => id.slice(0, 15);

const queryInstallStatus = async (packageId: string, targetOrg: string | undefined): Promise<string | undefined> => {
  try {
    const conn = await getConnection(targetOrg);
    const result = await conn.tooling.query<{ Status: string; SubscriberPackageVersionKey: string }>(
      `SELECT Status, SubscriberPackageVersionKey FROM PackageInstallRequest
       ORDER BY CreatedDate DESC LIMIT 10`
    );
    channelService.appendLine(`[package install] poll: ${JSON.stringify(result.records)}`);
    const match = result.records?.find(r => to15(r.SubscriberPackageVersionKey) === to15(packageId));
    return match?.Status ?? result.records?.[0]?.Status;
  } catch (err) {
    channelService.appendLine(`[package install] poll error: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
};

const sleep = (ms: number, token?: vscode.CancellationToken): Promise<void> =>
  new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    token?.onCancellationRequested(() => {
      clearTimeout(timer);
      resolve();
    });
  });

class SelectPackageID implements ParametersGatherer<PackageID> {
  public async gather(): Promise<CancelResponse | ContinueResponse<PackageID>> {
    const packageIdInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_package_id'),
      placeHolder: nls.localize('package_id_gatherer_placeholder'),
      validateInput: value =>
        isRecordIdFormat(value, PKG_ID_PREFIX) || value === '' ? null : nls.localize('package_id_validation_error')
    };

    const packageId = await vscode.window.showInputBox(packageIdInputOptions);
    return packageId ? { type: 'CONTINUE', data: { packageId } } : { type: 'CANCEL' };
  }
}

class SelectInstallationKey implements ParametersGatherer<InstallationKey> {
  public async gather(): Promise<CancelResponse | ContinueResponse<InstallationKey>> {
    const installationKeyInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_installation_key_if_necessary')
    };

    const installationKey = await vscode.window.showInputBox(installationKeyInputOptions);
    return installationKey || installationKey === ''
      ? { type: 'CONTINUE', data: { installationKey } }
      : { type: 'CANCEL' };
  }
}

export const packageInstall = async (): Promise<void> => {
  const sfPackageInstallCommandlet = new SfCommandlet(
    new EmptyPreChecker(),
    new CompositeParametersGatherer(new SelectPackageID(), new SelectInstallationKey()),
    new PackageInstallExecutor()
  );

  await sfPackageInstallCommandlet.run();
};

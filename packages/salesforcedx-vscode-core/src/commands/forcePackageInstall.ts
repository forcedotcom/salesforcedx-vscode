/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { getRootWorkspacePath } from '../util';
import {
  CompositeParametersGatherer,
  EmptyPreChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor
} from './util';

type forcePackageInstallOptions = {
  packageId: string;
  installationKey: string;
};

export class ForcePackageInstallExecutor extends SfdxCommandletExecutor<
  PackageIdAndInstallationKey
> {
  private readonly options: forcePackageInstallOptions;

  public constructor(options = { packageId: '', installationKey: '' }) {
    super();
    this.options = options;
  }

  public build(data: PackageIdAndInstallationKey): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_package_install_text'))
      .withArg('force:package:install')
      .withFlag('--package', data.packageId)
      .withLogName('force_package_install');

    if (data.installationKey) {
      builder.withFlag('--installationkey', data.installationKey);
    }

    return builder.build();
  }

  public execute(
    response: ContinueResponse<PackageIdAndInstallationKey>
  ): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath(),
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    notificationService.reportExecutionError(
      execution.command.toString(),
      (execution.stderrSubject as any) as Observable<Error | undefined>
    );
    channelService.streamCommandOutput(execution);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export type PackageIdAndInstallationKey = PackageID & InstallationKey;

export interface PackageID {
  packageId: string;
}

export interface InstallationKey {
  installationKey: string;
}

export class SelectPackageID implements ParametersGatherer<PackageID> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<PackageID>> {
    const packageIdInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_package_id')
    } as vscode.InputBoxOptions;
    if (this.prefillValueProvider) {
      packageIdInputOptions.value = this.prefillValueProvider();
    }
    const packageId = await vscode.window.showInputBox(packageIdInputOptions);
    return packageId
      ? { type: 'CONTINUE', data: { packageId } }
      : { type: 'CANCEL' };
  }
}

export class SelectInstallationKey
  implements ParametersGatherer<InstallationKey> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<InstallationKey>
  > {
    const installationKeyInputOptions = {
      prompt: nls.localize(
        'parameter_gatherer_enter_installation_key_if_necessary'
      )
    } as vscode.InputBoxOptions;
    if (this.prefillValueProvider) {
      installationKeyInputOptions.value = this.prefillValueProvider();
    }
    const installationKey = await vscode.window.showInputBox(
      installationKeyInputOptions
    );
    return installationKey || installationKey === ''
      ? { type: 'CONTINUE', data: { installationKey } }
      : { type: 'CANCEL' };
  }
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new SelectPackageID(),
  new SelectInstallationKey()
);

const sfdxPackageInstallCommandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  new ForcePackageInstallExecutor()
);

export async function forcePackageInstall() {
  await sfdxPackageInstallCommandlet.run();
}

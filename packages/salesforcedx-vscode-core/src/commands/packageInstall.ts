/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  isRecordIdFormat,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { PKG_ID_PREFIX } from '../constants';
import { nls } from '../messages';
import { EmptyPreChecker, SfCommandlet, SfCommandletExecutor } from './util';

class PackageInstallExecutor extends SfCommandletExecutor<PackageIdAndInstallationKey> {
  public build(data: PackageIdAndInstallationKey): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('package_install_text'))
      .withArg('package:install')
      .withFlag('--package', data.packageId)
      .withLogName('package_install');

    if (data.installationKey) {
      builder.withFlag('--installation-key', data.installationKey);
    }

    return builder.build();
  }
}

type PackageIdAndInstallationKey = PackageID & InstallationKey;

type PackageID = {
  packageId: string;
};

type InstallationKey = {
  installationKey: string;
};

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
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<InstallationKey>> {
    const installationKeyInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_installation_key_if_necessary')
    };
    if (this.prefillValueProvider) {
      installationKeyInputOptions.value = this.prefillValueProvider();
    }
    const installationKey = await vscode.window.showInputBox(installationKeyInputOptions);
    return installationKey || installationKey === ''
      ? { type: 'CONTINUE', data: { installationKey } }
      : { type: 'CANCEL' };
  }
}

const workspaceChecker = new EmptyPreChecker();
const parameterGatherer = new CompositeParametersGatherer(new SelectPackageID(), new SelectInstallationKey());

const sfPackageInstallCommandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new PackageInstallExecutor());

export const packageInstall = async (): Promise<void> => {
  await sfPackageInstallCommandlet.run();
};

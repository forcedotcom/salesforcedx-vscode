/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { notificationService } from '../commands/notificationService';
import { ConfigSource, ConfigUtil } from '../config/configUtil';
import { nls } from '../messages/messages';
import { telemetryService } from '../services/telemetry';

/** Get the target org or alias, optionally showing warnings */
export const getTargetOrgOrAlias = async (enableWarning: boolean): Promise<string | undefined> => {
  try {
    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
    if (!targetOrgOrAlias) {
      displayMessage(nls.localize('error_no_target_org'), enableWarning, VSCodeWindowTypeEnum.Informational);
      return undefined;
    } else {
      if (await ConfigUtil.isGlobalTargetOrg()) {
        displayMessage(nls.localize('warning_using_global_username'), enableWarning, VSCodeWindowTypeEnum.Warning);
      }
    }

    return targetOrgOrAlias;
  } catch (err) {
    if (err instanceof Error) {
      telemetryService.sendException('get_target_org_alias', err.message);
    }
    return undefined;
  }
};

/** Get the target Dev Hub or alias, optionally showing warnings */
export const getTargetDevHubOrAlias = async (
  enableWarning: boolean,
  configSource?: ConfigSource.Global | ConfigSource.Local
): Promise<string | undefined> => {
  try {
    const targetDevHub =
      configSource === ConfigSource.Global
        ? await ConfigUtil.getGlobalTargetDevHubOrAlias()
        : await ConfigUtil.getTargetDevHubOrAlias();

    if (!targetDevHub) {
      const showButtonText = nls.localize('notification_make_default_dev');
      const selection = await displayMessage(
        nls.localize('error_no_target_dev_hub'),
        enableWarning,
        VSCodeWindowTypeEnum.Informational,
        [showButtonText]
      );
      if (selection && selection === showButtonText) {
        vscode.commands.executeCommand('sf.org.login.web.dev.hub');
      }
      return undefined;
    }
    return JSON.stringify(targetDevHub).replaceAll('"', '');
  } catch (err) {
    if (err instanceof Error) {
      telemetryService.sendException('get_target_dev_hub_alias', err.message);
    }
    return undefined;
  }
};

enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

const displayMessage = (
  output: string,
  enableWarning?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum,
  items?: string[]
): Thenable<string | undefined> | undefined => {
  if (enableWarning !== undefined && !enableWarning) {
    return;
  }
  const buttons = items ?? [];
  if (vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case VSCodeWindowTypeEnum.Error: {
        return notificationService.showErrorMessage(output, ...buttons);
      }
      case VSCodeWindowTypeEnum.Informational: {
        return notificationService.showInformationMessage(output, ...buttons);
      }
      case VSCodeWindowTypeEnum.Warning: {
        return notificationService.showWarningMessage(output, ...buttons);
      }
    }
  }
};

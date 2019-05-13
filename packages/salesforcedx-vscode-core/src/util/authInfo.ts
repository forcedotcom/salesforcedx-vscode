/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import { isUndefined } from 'util';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { ConfigSource, ConfigUtil } from './index';

const defaultUserNameKey = 'defaultusername';
const defaultDevHubUserNameKey = 'defaultdevhubusername';
export class OrgAuthInfo {
  public static async getDefaultUsernameOrAlias(
    enableWarning: boolean
  ): Promise<string | undefined> {
    try {
      const defaultUserName = await ConfigUtil.getConfigValue(
        defaultUserNameKey
      );
      if (isUndefined(defaultUserName)) {
        displayMessage(
          nls.localize('error_no_default_username'),
          enableWarning,
          VSCodeWindowTypeEnum.Informational
        );
        return undefined;
      } else {
        const configSource = await ConfigUtil.getConfigSource(
          defaultUserNameKey
        );
        if (configSource === ConfigSource.Global) {
          displayMessage(
            nls.localize('warning_using_global_username'),
            enableWarning,
            VSCodeWindowTypeEnum.Warning
          );
        }
      }
      return JSON.stringify(defaultUserName).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      telemetryService.sendErrorEvent(
        'Unexpected error in OrgAuthInfo.getDefaultUsernameOrAlias',
        err
      );
      return undefined;
    }
  }

  public static async getDefaultDevHubUsernameOrAlias(
    enableWarning: boolean
  ): Promise<string | undefined> {
    try {
      const defaultDevHubUserName = await ConfigUtil.getConfigValue(
        defaultDevHubUserNameKey
      );
      if (isUndefined(defaultDevHubUserName)) {
        displayMessage(
          nls.localize('error_no_default_devhubusername'),
          enableWarning,
          VSCodeWindowTypeEnum.Error
        );
        return undefined;
      }
      return JSON.stringify(defaultDevHubUserName).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      telemetryService.sendErrorEvent(
        'Unexpected error in OrgAuthInfo.getDefaultDevHubUsernameOrAlias',
        err
      );
      return undefined;
    }
  }

  public static async getUsername(
    usernameOrAlias: string
  ): Promise<string | undefined> {
    const username = await Aliases.fetch(usernameOrAlias);
    return Promise.resolve(username);
  }

  public static async isAScratchOrg(username: string): Promise<boolean> {
    try {
      const authInfo = await AuthInfo.create({ username });
      const authInfoFields = authInfo.getFields();
      return Promise.resolve(
        typeof authInfoFields.devHubUsername !== 'undefined'
      );
    } catch (e) {
      throw e;
    }
  }
}

enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

function displayMessage(
  output: string,
  enableWarning?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum
) {
  if (!isUndefined(enableWarning) && !enableWarning) {
    return;
  }

  channelService.appendLine(output);
  channelService.showChannelOutput();
  if (vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case VSCodeWindowTypeEnum.Error: {
        notificationService.showErrorMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Informational: {
        notificationService.showInformationMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Warning: {
        notificationService.showWarningMessage(output);
        break;
      }
    }
  }
}

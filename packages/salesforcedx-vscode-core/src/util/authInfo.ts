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
import { ConfigSource, ConfigUtil } from './index';

const defaultUserNameKey = 'defaultusername';
const defaultDevHubUserNameKey = 'defaultdevhubusername';
export class OrgAuthInfo {
  public static async getDefaultUsernameOrAlias(): Promise<string | undefined> {
    const defaultUserName = await ConfigUtil.getConfigValue(defaultUserNameKey);
    if (isUndefined(defaultUserName)) {
      displayMessage(
        nls.localize('error_no_default_username'),
        true,
        VSCodeWindowTypeEnum.Informational
      );
      return undefined;
    } else {
      const configSource = await ConfigUtil.getConfigSource(defaultUserNameKey);
      if (configSource === ConfigSource.Global) {
        displayMessage(
          nls.localize('warning_using_global_username'),
          true,
          VSCodeWindowTypeEnum.Warning
        );
      }
    }
    return JSON.stringify(defaultUserName).replace(/\"/g, '');
  }

  public static async getDefaultDevHubUsernameOrAlias(): Promise<
    string | undefined
  > {
    const defaultDevHubUserName = await ConfigUtil.getConfigValue(
      defaultDevHubUserNameKey
    );
    if (isUndefined(defaultDevHubUserName)) {
      displayMessage(
        nls.localize('error_no_default_devhubusername'),
        true,
        VSCodeWindowTypeEnum.Error
      );
      return undefined;
    }
    return JSON.stringify(defaultDevHubUserName).replace(/\"/g, '');
  }

  public static async getUsername(usernameOrAlias: string): Promise<string> {
    const username = await Aliases.fetch(usernameOrAlias);
    if (username) {
      return Promise.resolve(username);
    }
    return Promise.resolve(usernameOrAlias);
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
  showVSCodeWindow?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum
) {
  channelService.appendLine(output);
  channelService.showChannelOutput();
  if (showVSCodeWindow && vsCodeWindowType) {
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

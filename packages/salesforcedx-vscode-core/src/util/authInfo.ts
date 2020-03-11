/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo, Connection } from '@salesforce/core';
import { isUndefined } from 'util';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  DEFAULT_DEV_HUB_USERNAME_KEY,
  DEFAULT_USERNAME_KEY
} from '../constants';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { ConfigSource, ConfigUtil } from './index';
export class OrgAuthInfo {
  public static async getDefaultUsernameOrAlias(
    enableWarning: boolean
  ): Promise<string | undefined> {
    try {
      const defaultUserName = await ConfigUtil.getConfigValue(
        DEFAULT_USERNAME_KEY
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
          DEFAULT_USERNAME_KEY
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
      telemetryService.sendException('get_default_username_alias', err.message);
      return undefined;
    }
  }

  public static async getDefaultDevHubUsernameOrAlias(
    enableWarning: boolean,
    configSource?: ConfigSource.Global | ConfigSource.Local
  ): Promise<string | undefined> {
    try {
      const defaultDevHubUserName = await ConfigUtil.getConfigValue(
        DEFAULT_DEV_HUB_USERNAME_KEY,
        configSource
      );
      if (isUndefined(defaultDevHubUserName)) {
        const showButtonText = nls.localize('notification_make_default_dev');
        const selection = await displayMessage(
          nls.localize('error_no_default_devhubusername'),
          enableWarning,
          VSCodeWindowTypeEnum.Informational,
          [showButtonText]
        );
        if (selection && selection === showButtonText) {
          vscode.commands.executeCommand('sfdx.force.auth.dev.hub');
        }
        return undefined;
      }
      return JSON.stringify(defaultDevHubUserName).replace(/\"/g, '');
    } catch (err) {
      console.error(err);
      telemetryService.sendException(
        'get_default_devhub_username_alias',
        err.message
      );
      return undefined;
    }
  }

  public static async getUsername(usernameOrAlias: string): Promise<string> {
    return (await Aliases.fetch(usernameOrAlias)) || usernameOrAlias;
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

  public static async getConnection(
    usernameOrAlias: string
  ): Promise<Connection> {
    const username = await this.getUsername(usernameOrAlias);
    return await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });
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
  vsCodeWindowType?: VSCodeWindowTypeEnum,
  items?: string[]
) {
  if (!isUndefined(enableWarning) && !enableWarning) {
    return;
  }
  const buttons = items || [];
  channelService.appendLine(output);
  channelService.showChannelOutput();
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
}

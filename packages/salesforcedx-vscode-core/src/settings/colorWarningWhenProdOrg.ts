/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { WorkspaceContext } from '../context';
import { getDefaultUsernameOrAlias } from '../context/workspaceOrgType';
import { OrgAuthInfo } from '../util';
import { SfdxCoreSettings } from './sfdxCoreSettings';

/**
 * Change the color of the status bar when the default org is a production org
 * @returns {Promise<boolean>} - returns true if the color was changed
 */
export const colorWhenProductionOrg = async () => {
  const baseColorStatusBar = new vscode.ThemeColor('statusBar.background');

  const colorWHenProductionOrgHandler = async () => {
    const usernameOrAlias = await getDefaultUsernameOrAlias();
    const settings = SfdxCoreSettings.getInstance();

    const activated = settings.getColorWarningWhenProductionOrg();
    const colorForProdOrg = settings.getColorWarningWhenProductionOrgColor();

    if (!usernameOrAlias || !activated) {
      return false;
    }
    const isProdOrg = await OrgAuthInfo.isAProductionOrg(
      await OrgAuthInfo.getUsername(usernameOrAlias)
    );
    const colorCustomizations = {
      'statusBar.background': isProdOrg ? colorForProdOrg : baseColorStatusBar
    };

    // Save the configuration to the global settings file
    await vscode.workspace
      .getConfiguration()
      .update(
        'workbench.colorCustomizations',
        colorCustomizations,
        vscode.ConfigurationTarget.Global
      );
    return true;
  };

  WorkspaceContext.getInstance().onOrgChange(() =>
    colorWHenProductionOrgHandler()
  );

  /**
   * Change the color of the status bar when the window state changes, avoiding the status bar color on others vscode windows
   */
  vscode.window.onDidChangeWindowState(async e => {
    if (e.focused) {
      await colorWHenProductionOrgHandler();
    } else {
      await vscode.workspace
        .getConfiguration()
        .update(
          'workbench.colorCustomizations',
          {},
          vscode.ConfigurationTarget.Global
        );
    }
  });
  return await colorWHenProductionOrgHandler();
};

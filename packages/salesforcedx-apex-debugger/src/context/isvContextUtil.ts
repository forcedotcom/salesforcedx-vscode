/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ENV_SFDX_DEFAULTUSERNAME,
  ENV_SFDX_INSTANCE_URL,
  SFDX_CONFIG_ISV_DEBUGGER_SID,
  SFDX_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';

export class IsvContextUtil {
  public async setIsvDebuggerContext(projectWorkspacePath: string) {
    let isvDebugProject = false;
    if (projectWorkspacePath) {
      const forceConfig = await new ForceConfigGet().getConfig(
        projectWorkspacePath,
        SFDX_CONFIG_ISV_DEBUGGER_SID,
        SFDX_CONFIG_ISV_DEBUGGER_URL
      );
      const isvDebuggerSid = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_SID);
      const isvDebuggerUrl = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_URL);

      if (
        typeof isvDebuggerSid !== 'undefined' &&
        typeof isvDebuggerUrl !== 'undefined'
      ) {
        // set auth context
        GlobalCliEnvironment.environmentVariables.set(
          ENV_SFDX_DEFAULTUSERNAME,
          isvDebuggerSid
        );
        GlobalCliEnvironment.environmentVariables.set(
          ENV_SFDX_INSTANCE_URL,
          isvDebuggerUrl
        );
        isvDebugProject = true;
      }
    }
    return isvDebugProject;
  }

  public resetCliEnvironmentVars() {
    // reset any auth
    GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_DEFAULTUSERNAME);
    GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_INSTANCE_URL);
    console.log(
      `Deleted environment variables ${ENV_SFDX_DEFAULTUSERNAME} and ${ENV_SFDX_INSTANCE_URL}`
    );
  }
}

/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ENV_SF_ORG_INSTANCE_URL,
  ENV_SF_TARGET_ORG,
  ConfigGet,
  GlobalCliEnvironment,
  SF_CONFIG_ISV_DEBUGGER_SID,
  SF_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-utils';

export class IsvContextUtil {
  public async setIsvDebuggerContext(projectWorkspacePath: string) {
    let isvDebugProject = false;
    if (projectWorkspacePath) {
      const config = await new ConfigGet().getConfig(
        projectWorkspacePath,
        SF_CONFIG_ISV_DEBUGGER_SID,
        SF_CONFIG_ISV_DEBUGGER_URL
      );
      const isvDebuggerSid = config.get(SF_CONFIG_ISV_DEBUGGER_SID);
      const isvDebuggerUrl = config.get(SF_CONFIG_ISV_DEBUGGER_URL);

      if (typeof isvDebuggerSid !== 'undefined' && typeof isvDebuggerUrl !== 'undefined') {
        // set auth context
        GlobalCliEnvironment.environmentVariables.set(ENV_SF_TARGET_ORG, isvDebuggerSid);
        GlobalCliEnvironment.environmentVariables.set(ENV_SF_ORG_INSTANCE_URL, isvDebuggerUrl);
        isvDebugProject = true;
      }
    }
    return isvDebugProject;
  }

  public resetCliEnvironmentVars() {
    // reset any auth
    GlobalCliEnvironment.environmentVariables.delete(ENV_SF_TARGET_ORG);
    GlobalCliEnvironment.environmentVariables.delete(ENV_SF_ORG_INSTANCE_URL);
    console.log(`Deleted environment variables ${ENV_SF_TARGET_ORG} and ${ENV_SF_ORG_INSTANCE_URL}`);
  }
}

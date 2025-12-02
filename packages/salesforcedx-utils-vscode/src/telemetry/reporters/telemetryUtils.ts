/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';
import { env, UIKind, version } from 'vscode';
import { CommonProperties, InternalProperties } from './loggingProperties';

export const getCommonProperties = (extensionId: string, extensionVersion: string): CommonProperties => {
  const commonProperties: CommonProperties = {
    'common.os': os.platform(),
    'common.platformversion': (os.release() ?? '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3'),
    'common.systemmemory': `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
    'common.extname': extensionId,
    'common.extversion': extensionVersion
  };

  const cpus = os.cpus();
  if (cpus && cpus.length > 0) {
    commonProperties['common.cpus'] = `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})`;
  }

  if (env) {
    commonProperties['common.vscodemachineid'] = env.machineId;
    commonProperties['common.vscodesessionid'] = env.sessionId;
    commonProperties['common.vscodeversion'] = version;
    if (env.uiKind) {
      commonProperties['common.vscodeuikind'] = UIKind[env.uiKind];
    }
  }

  return commonProperties;
};

export const getInternalProperties = (): InternalProperties => ({
  'sfInternal.hostname': os.hostname(),
  'sfInternal.username': os.userInfo().username
});

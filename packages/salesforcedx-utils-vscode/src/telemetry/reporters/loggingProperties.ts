/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type CommonProperties = {
  'common.os': string;
  'common.platformversion': string;
  'common.cpus'?: string;
  'common.systemmemory': string;
  'common.extname': string;
  'common.extversion': string;
  'common.vscodemachineid'?: string;
  'common.vscodesessionid'?: string;
  'common.vscodeversion'?: string;
  'common.vscodeuikind'?: string;
};

export type InternalProperties = {
  'sfInternal.hostname': string;
  'sfInternal.username': string;
};

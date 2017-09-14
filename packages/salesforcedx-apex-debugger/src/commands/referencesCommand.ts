/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from './baseCommand';

export class ReferencesCommand extends BaseCommand {
  public constructor(
    instanceUrl: string,
    accessToken: string,
    debuggedRequestId: string
  ) {
    super('references', instanceUrl, accessToken, debuggedRequestId);
  }
}

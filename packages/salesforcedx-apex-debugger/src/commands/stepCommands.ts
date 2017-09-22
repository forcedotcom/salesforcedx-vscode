/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from './baseCommand';

export class StepIntoCommand extends BaseCommand {
  public constructor(debuggedRequestId: string) {
    super('step', debuggedRequestId, 'type=into');
  }
}

export class StepOutCommand extends BaseCommand {
  public constructor(debuggedRequestId: string) {
    super('step', debuggedRequestId, 'type=out');
  }
}

export class StepOverCommand extends BaseCommand {
  public constructor(debuggedRequestId: string) {
    super('step', debuggedRequestId, 'type=over');
  }
}

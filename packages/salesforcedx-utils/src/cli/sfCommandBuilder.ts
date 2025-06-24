/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SF_COMMAND } from '../constants';
import { CommandBuilder } from './commandBuilder';

export class SfCommandBuilder extends CommandBuilder {
  constructor() {
    super(SF_COMMAND);
  }
}

/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationProvider } from '../types';
import { Message } from './message';

export class Localization implements LocalizationProvider {
  private readonly delegate: Message;

  public constructor(delegate: Message) {
    this.delegate = delegate;
  }

  public localize(label: string, ...args: any[]): string {
    return this.delegate.localize(label, ...args);
  }
}

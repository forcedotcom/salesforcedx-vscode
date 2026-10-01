/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client } from 'faye';

export class ApexFayeClient extends Client {
  on(event: string, callback: () => void): void;
  handshake(callback: () => void): void;
  disconnect(): void;
}

/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancellationToken } from '../../src/generator/fauxClassGenerator';

// Added to be able to test cancellation of FauxClassGenerator.generate
// mimic of vscode but shouldn't depend on vscode in this package

class StandardCancellationToken implements CancellationToken {
  public isCancellationRequested = false;
}
export class CancellationTokenSource {
  public token: CancellationToken = new StandardCancellationToken();

  public cancel(): void {
    this.token.isCancellationRequested = true;
  }

  public dispose(): void {
    this.cancel();
  }
}

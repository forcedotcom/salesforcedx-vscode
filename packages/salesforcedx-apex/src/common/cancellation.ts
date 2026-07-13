/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/Microsoft/vscode/blob/master/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The following definitions are adapted from Type Definition for Visual Studio Code 1.46 Extension API
 * See https://code.visualstudio.com/api for more information
 */

/**
 * A cancellation token is passed to an asynchronous or long running
 * operation to request cancellation, like cancelling a request
 * for completion items because the user continued to type.
 *
 * To get an instance of a `CancellationToken` use a
 * [CancellationTokenSource](#CancellationTokenSource).
 */
export interface CancellationToken {
  /**
   * Is `true` when the token has been cancelled, `false` otherwise.
   */
  isCancellationRequested: boolean;

  /**
   * An event which fires upon cancellation.
   */
  onCancellationRequested: (listener: () => void | Promise<void>) => void;
}

class Token implements CancellationToken {
  public isCancellationRequested = false;
  public callbacks: (() => void | Promise<void>)[] = [];
  onCancellationRequested(listener: () => void | Promise<void>): void {
    if (this.isCancellationRequested) {
      void listener();
    } else {
      this.callbacks.push(listener);
    }
  }
}

export class CancellationTokenSource {
  token: Token = new Token();
  async asyncCancel(): Promise<void> {
    this.token.isCancellationRequested = true;
    for (const callback of this.token.callbacks) {
      await callback();
    }
    this.token.callbacks = [];
  }
}

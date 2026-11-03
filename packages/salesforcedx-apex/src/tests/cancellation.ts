/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/Microsoft/vscode/blob/master/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal cancellation contract for the Promise test API, shared by CLI and editor consumers.
 * The Effect API uses fiber interruption instead.
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
  private readonly internalToken = new Token();
  readonly token: CancellationToken = this.internalToken;
  async asyncCancel(): Promise<void> {
    this.internalToken.isCancellationRequested = true;
    for (const callback of this.internalToken.callbacks) {
      await callback();
    }
    this.internalToken.callbacks = [];
  }
}

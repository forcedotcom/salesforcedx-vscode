/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const START_HANDLE = 1000;
export class Handles<T> {
  private _handleMap = new Map<number, T>();

  public reset(): void {
    this._handleMap = new Map<number, T>();
  }

  public create(value: T): number {
    const handle = this._handleMap.size > 0 ? Math.max(...this._handleMap.keys()) + 1 : START_HANDLE;
    this._handleMap.set(handle, value);
    return handle;
  }

  public get(handle: number): T | undefined {
    return this._handleMap.get(handle);
  }

  public copy(): Handles<T> {
    const newHandles = new Handles<T>();
    newHandles._handleMap = new Map<number, T>(structuredClone(this._handleMap));
    return newHandles;
  }
}

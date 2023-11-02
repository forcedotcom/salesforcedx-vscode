/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class Handles<T> {
  private START_HANDLE = 1000;

  private _nextHandle: number;
  private _handleMap = new Map<number, T>();

  public constructor(startHandle?: number) {
    this._nextHandle =
      typeof startHandle === 'number' ? startHandle : this.START_HANDLE;
  }

  public reset(): void {
    this._nextHandle = this.START_HANDLE;
    this._handleMap = new Map<number, T>();
  }

  public create(value: T): number {
    const handle = this._nextHandle++;
    this._handleMap.set(handle, value);
    return handle;
  }

  public get(handle: number, dflt?: T): T {
    return (this._handleMap.get(handle) || dflt) as any;
  }

  public copy(): Handles<T> {
    const newHandles = Object.assign(
      Object.create(Object.getPrototypeOf(this))
    ) as Handles<T>;
    newHandles.START_HANDLE = this.START_HANDLE;
    newHandles._nextHandle = this._nextHandle;
    newHandles._handleMap = new Map<number, T>();
    this._handleMap.forEach((value, key) => {
      if ((value as any).copy !== 'undefined') {
        newHandles._handleMap.set(key, (value as any).copy());
      }
    });
    return newHandles;
  }
}

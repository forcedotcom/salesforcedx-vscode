/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const state = { current: undefined as unknown };
export const vscodeApiMock = {
  postMessage: jest.fn(),
  getState: jest.fn(() => state.current),
  setState: jest.fn((next: unknown) => {
    state.current = next;
    return next;
  })
};

Object.assign(globalThis, {
  acquireVsCodeApi: () => vscodeApiMock,
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  },
  cancelAnimationFrame: () => {},
  ResizeObserver: class {
    private observing = false;
    public observe(): void {
      if (!this.observing) this.observing = true;
    }
    public unobserve(): void {
      if (this.observing) this.observing = false;
    }
    public disconnect(): void {
      if (this.observing) this.observing = false;
    }
  }
});

beforeEach(() => {
  state.current = undefined;
  jest.clearAllMocks();
});

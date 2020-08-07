/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
declare module 'faye' {
  export class Client {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(topic: string, options?: Record<string, any>);
    setHeader(name: string, value: string): void;
    on(event: string, callback: () => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addExtension(extension: Record<string, any>): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(channel: string, callback: (message: any) => void): Subscription;
    disconnect(): void;
  }

  export class Subscription {}
}

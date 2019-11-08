/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface ServerHandler {
  stop(): Promise<void>;
}

export class DevServerService {
  private static _instance: DevServerService;

  public static get instance() {
    if (DevServerService._instance === undefined) {
      DevServerService._instance = new DevServerService();
    }
    return DevServerService._instance;
  }

  private handlers: Set<ServerHandler> = new Set();

  public isServerHandlerRegistered() {
    return this.handlers.size > 0;
  }

  public registerServerHandler(handler: ServerHandler) {
    this.handlers.add(handler);
  }

  public clearServerHandler(handler: ServerHandler) {
    if (handler) {
      this.handlers.delete(handler);
    }
  }

  public getServerHandlers() {
    return [...this.handlers];
  }

  public async stopServer() {
    if (this.handlers.size > 0) {
      const promises = [...this.handlers].map(handler => handler.stop());
      await Promise.all(promises);
      this.handlers.clear();
      console.log('successfully stopped lwc dev server(s)');
    } else {
      console.log('lwc dev server was not running');
    }
  }
}

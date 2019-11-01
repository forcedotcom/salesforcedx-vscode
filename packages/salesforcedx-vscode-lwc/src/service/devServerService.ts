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

  private serverHandler: ServerHandler | undefined;

  public isServerHandlerRegistered() {
    return this.serverHandler !== undefined;
  }

  public registerServerHandler(serverHandler: ServerHandler) {
    if (this.serverHandler !== undefined) {
      throw new Error('An existing server is already running');
    }
    this.serverHandler = serverHandler;
  }

  public clearServerHandler() {
    this.serverHandler = undefined;
  }

  public async stopServer() {
    if (this.serverHandler !== undefined) {
      console.log('stopping lwc dev server');
      await this.serverHandler.stop();
      this.serverHandler = undefined;
      console.log('successfully stopped lwc dev server');
    } else {
      console.info('lwc dev server was not running');
    }
  }
}

declare module 'faye' {
  export class Client {
    constructor(topic: string, options?: Object);
    setHeader(name: string, value: string): void;
    on(event: string, callback: () => void): void;
    addExtension(extension: Object): void;
    subscribe(channel: string, callback: (message: any) => void): Subscription;
    disconnect(): void;
  }

  export class Subscription {}
}

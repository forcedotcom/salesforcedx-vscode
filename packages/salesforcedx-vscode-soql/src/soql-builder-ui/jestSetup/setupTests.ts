// Polyfill for jest 29 compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.global = globalThis;

// Mock localStorage for jest environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  public clear(): void {
    this.store = {};
  }

  public getItem(key: string): string | null {
    return this.store[key] || null;
  }

  public setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  public removeItem(key: string): void {
    delete this.store[key];
  }

  public get length(): number {
    return Object.keys(this.store).length;
  }

  public key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

const localStorageInstance = new LocalStorageMock();

// Use Object.defineProperty to ensure localStorage is always available
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageInstance,
  writable: true,
  configurable: true
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageInstance,
  writable: true,
  configurable: true
});

// Also set it on window if window exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageInstance,
    writable: true,
    configurable: true
  });
}

export class VsCodeApi {
  public state: string;
  public message: string;
  public getState(): string {
    return this.state;
  }
  public setState(state: string): void {
    this.state = state;
  }
  public postMessage(message: string): void {
    this.message = message;
  }
}
export const vscodeInstance = new VsCodeApi();
export function acquireVsCodeApi(): VsCodeApi {
  return vscodeInstance;
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.acquireVsCodeApi = acquireVsCodeApi;

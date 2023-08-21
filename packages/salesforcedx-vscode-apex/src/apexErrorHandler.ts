import { EventEmitter } from 'events';
import {
  CloseAction,
  ErrorAction,
  ErrorHandler,
  Message
} from 'vscode-languageclient';
import { nls } from './messages';

export class ApexErrorHandler extends EventEmitter implements ErrorHandler {
  private restarts: number[];
  private hasStarted: boolean = false;
  constructor() {
    super();
    this.restarts = [];
  }
  // TODO: when does error get called instead of closed?
  public error(error: Error, message: Message, count: number): ErrorAction {
    if (count && count <= 3) {
      this.emit('error', `Error: ${JSON.stringify(error)} ${message}`);
      return ErrorAction.Continue;
    }
    this.emit('error', `Error: ${JSON.stringify(error)} ${message}`);
    return ErrorAction.Shutdown;
  }
  // Closed is called when the server processes closes/quits
  public closed() {
    if (this.hasStarted) {
      this.restarts = [Date.now()];
      this.emit('restarting', 1);
      this.hasStarted = false;
      return CloseAction.Restart;
    }
    this.restarts.push(Date.now());
    if (this.restarts.length < 5) {
      this.emit('restarting', this.restarts.length);
      return CloseAction.Restart;
    } else {
      const diff =
        this.restarts[this.restarts.length - 1] -
        this.restarts[this.restarts.length - 5];
      // 3 minutes
      if (diff <= 3 * 60 * 1000) {
        this.emit('startFailed', this.restarts.length);
        return CloseAction.DoNotRestart;
      } else {
        this.restarts.shift();
        this.emit('restarting', this.restarts.length);
        return CloseAction.Restart;
      }
    }
  }
  public serviceHasStartedSuccessfully() {
    this.hasStarted = true;
  }
}

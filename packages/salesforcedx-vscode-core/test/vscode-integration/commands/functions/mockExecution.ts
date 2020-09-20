import {
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { Subject } from 'rxjs/Subject';

class MockExecution implements CommandExecution {
  public command: Command;
  public processExitSubject: Subject<number>;
  public processErrorSubject: Subject<Error>;
  public stdoutSubject: Subject<string>;
  public stderrSubject: Subject<string>;
  private readonly childProcessPid: any;

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = new Subject<number>();
    this.processErrorSubject = new Subject<Error>();
    this.stdoutSubject = new Subject<string>();
    this.stderrSubject = new Subject<string>();
    this.childProcessPid = '';
  }

  public killExecution(signal?: string): Promise<void> {
    return Promise.resolve();
  }
}

export { MockExecution };

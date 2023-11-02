import * as os from 'os';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { CancellationToken } from '../types/cancellationToken';
import { CommandExecution } from '../types/commandExecution';
import { Command } from './command';

export class CompositeCliCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<string>;
  public readonly stderrSubject: Observable<string>;
  private readonly exitSubject: Subject<number | undefined>;
  private readonly errorSubject: Subject<Error | undefined>;
  private readonly stdout: Subject<string>;
  private readonly stderr: Subject<string>;

  constructor(command: Command, cancellationToken?: CancellationToken) {
    this.exitSubject = new Subject();
    this.errorSubject = new Subject();
    this.stdout = new Subject();
    this.stderr = new Subject();
    this.command = command;
    this.cancellationToken = cancellationToken;
    this.processExitSubject = this.exitSubject.asObservable();
    this.processErrorSubject = this.errorSubject.asObservable();
    this.stdoutSubject = this.stdout.asObservable();
    this.stderrSubject = this.stderr.asObservable();

    let timerSubscriber: Subscription | null;
    if (cancellationToken) {
      const timer = Observable.interval(1000);
      timerSubscriber = timer.subscribe(async () => {
        if (cancellationToken.isCancellationRequested) {
          try {
            this.exitSubject.next();
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
    this.processErrorSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });

    this.processExitSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });
  }

  public successfulExit() {
    this.exitSubject.next(0);
  }

  public failureExit(e?: Error | undefined) {
    if (e) {
      this.stderr.next(`${e}${os.EOL}`);
    }
    this.exitSubject.next(1);
  }
}

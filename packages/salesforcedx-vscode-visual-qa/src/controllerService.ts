/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { VisualQaAction, VisualQaFinding, VisualQaLaunchOptions, VisualQaStatus } from './schemas';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import { VisualQaStateError } from './errors';
import { SessionService, type VisualQaSession } from './sessionService';

type ControllerState = {
  lifecycle: VisualQaStatus['state'];
  objective: Option.Option<string>;
  session: Option.Option<VisualQaSession>;
  findingCount: number;
};

export class ControllerService extends Effect.Service<ControllerService>()('VisualQa/ControllerService', {
  accessors: true,
  dependencies: [SessionService.Default],
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const sessions = yield* SessionService;
    const state = yield* Ref.make<ControllerState>({
      lifecycle: 'new',
      objective: Option.none(),
      session: Option.none(),
      findingCount: 0
    });
    const semaphore = yield* Effect.makeSemaphore(1);
    const requireSession = Ref.get(state).pipe(
      Effect.flatMap(current =>
        Option.match(current.session, {
          onNone: () =>
            new VisualQaStateError({ message: `Visual QA session is ${current.lifecycle}`, state: current.lifecycle }),
          onSome: Effect.succeed
        })
      )
    );
    const startCriticalSection = Effect.fn('ControllerService.startCriticalSection')(function* (
      objective: string,
      options: VisualQaLaunchOptions
    ) {
      const current = yield* Ref.get(state);
      if (current.lifecycle !== 'new' && current.lifecycle !== 'closed')
        return yield* new VisualQaStateError({
          message: `Visual QA session is ${current.lifecycle}`,
          state: current.lifecycle
        });
      yield* Ref.set(state, {
        lifecycle: 'starting' as const,
        objective: Option.some(objective),
        session: Option.none(),
        findingCount: 0
      });
      const session = yield* sessions
        .launch({ ...options, objective })
        .pipe(Effect.onExit(exit => (Exit.isFailure(exit) ? Ref.set(state, current) : Effect.void)));
      yield* Ref.set(state, {
        lifecycle: 'running' as const,
        objective: Option.some(objective),
        session: Option.some(session),
        findingCount: 0
      });
      return session;
    });
    const start = Effect.fn('ControllerService.start')(function* (
      objective: string,
      options: VisualQaLaunchOptions = {}
    ) {
      return yield* semaphore.withPermits(1)(startCriticalSection(objective, options));
    });
    const observe = semaphore.withPermits(1)(requireSession.pipe(Effect.flatMap(session => session.observe)));
    const observeForMcp = observe.pipe(
      Effect.flatMap(observation =>
        fs.readFile(observation.screenshotPath).pipe(Effect.map(screenshot => ({ observation, screenshot })))
      )
    );
    const act = Effect.fn('ControllerService.act')(function* (action: VisualQaAction) {
      yield* semaphore.withPermits(1)(requireSession.pipe(Effect.flatMap(session => session.act(action))));
    });
    const addFindingCriticalSection = Effect.fn('ControllerService.addFindingCriticalSection')(function* (
      finding: VisualQaFinding
    ) {
      const session = yield* requireSession;
      yield* session.addFinding(finding);
      yield* Ref.update(state, current => ({ ...current, findingCount: current.findingCount + 1 }));
    });
    const addFinding = Effect.fn('ControllerService.addFinding')(function* (finding: VisualQaFinding) {
      yield* semaphore.withPermits(1)(addFindingCriticalSection(finding));
    });
    const status = Ref.get(state).pipe(
      Effect.map(
        current =>
          ({
            state: current.lifecycle,
            objective: Option.getOrUndefined(current.objective),
            runId: Option.getOrUndefined(Option.map(current.session, session => session.runId)),
            artifactDir: Option.getOrUndefined(Option.map(current.session, session => session.artifactDir)),
            findingCount: current.findingCount
          }) satisfies VisualQaStatus
      )
    );
    const finishCriticalSection = Effect.fn('ControllerService.finishCriticalSection')(function* () {
      const current = yield* Ref.get(state);
      yield* Match.value(current.lifecycle).pipe(
        Match.when('new', () => Ref.update(state, value => ({ ...value, lifecycle: 'closed' as const }))),
        Match.when('closed', () =>
          Option.match(current.session, { onNone: () => Effect.void, onSome: session => session.close })
        ),
        Match.orElse(() =>
          Option.match(current.session, {
            onNone: () =>
              new VisualQaStateError({
                message: `Visual QA session is ${current.lifecycle}`,
                state: current.lifecycle
              }),
            onSome: session =>
              Ref.update(state, value => ({ ...value, lifecycle: 'stopping' as const })).pipe(
                Effect.zipRight(session.close),
                Effect.zipRight(Ref.update(state, value => ({ ...value, lifecycle: 'closed' as const })))
              )
          })
        )
      );
    });
    const finish = semaphore.withPermits(1)(Effect.suspend(finishCriticalSection));
    return { start, observe, observeForMcp, act, addFinding, status, finish };
  })
}) {}

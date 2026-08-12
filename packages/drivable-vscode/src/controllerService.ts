/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  DrivableVscodeAction,
  DrivableVscodeFinding,
  DrivableVscodeLaunchOptions,
  DrivableVscodeStatus
} from './schemas';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import { DrivableVscodeStateError } from './errors';
import { SessionService, type DrivableVscodeSession } from './sessionService';

type ControllerState = {
  lifecycle: DrivableVscodeStatus['state'];
  objective: Option.Option<string>;
  session: Option.Option<DrivableVscodeSession>;
  findingCount: number;
};

export class ControllerService extends Effect.Service<ControllerService>()('DrivableVscode/ControllerService', {
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
            new DrivableVscodeStateError({
              message: `Drivable VS Code session is ${current.lifecycle}`,
              state: current.lifecycle
            }),
          onSome: Effect.succeed
        })
      )
    );
    const startCriticalSection = Effect.fn('ControllerService.startCriticalSection')(function* (
      objective: string,
      options: DrivableVscodeLaunchOptions
    ) {
      const current = yield* Ref.get(state);
      if (current.lifecycle !== 'new' && current.lifecycle !== 'closed')
        return yield* new DrivableVscodeStateError({
          message: `Drivable VS Code session is ${current.lifecycle}`,
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
      options: DrivableVscodeLaunchOptions = {}
    ) {
      return yield* semaphore.withPermits(1)(startCriticalSection(objective, options));
    });
    const observe = semaphore.withPermits(1)(requireSession.pipe(Effect.flatMap(session => session.observe)));
    const observeForMcp = observe.pipe(
      Effect.flatMap(observation =>
        fs.readFile(observation.screenshotPath).pipe(Effect.map(screenshot => ({ observation, screenshot })))
      )
    );
    const act = Effect.fn('ControllerService.act')(function* (action: DrivableVscodeAction) {
      yield* semaphore.withPermits(1)(requireSession.pipe(Effect.flatMap(session => session.act(action))));
    });
    const addFindingCriticalSection = Effect.fn('ControllerService.addFindingCriticalSection')(function* (
      finding: DrivableVscodeFinding
    ) {
      const session = yield* requireSession;
      yield* session.addFinding(finding);
      yield* Ref.update(state, current => ({ ...current, findingCount: current.findingCount + 1 }));
    });
    const addFinding = Effect.fn('ControllerService.addFinding')(function* (finding: DrivableVscodeFinding) {
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
          }) satisfies DrivableVscodeStatus
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
              new DrivableVscodeStateError({
                message: `Drivable VS Code session is ${current.lifecycle}`,
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

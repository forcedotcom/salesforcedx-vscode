/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { SoqlBuilderApplication } from '../../src/application.js';
import { SoqlBuilderElement } from '../../src/components/soqlBuilderElement.js';
import {
  SoqlBuilderMessageChannelError,
  createInitialSoqlBuilderState,
  type SoqlBuilderAction,
  type SoqlBuilderState
} from '../../src/domain.js';
import { registerSoqlBuilderElements } from '../../src/register.js';
import {
  makeFakeSoqlBuilderService,
  type FakeSoqlBuilderService,
  type FakeSoqlBuilderServiceStats
} from '../../src/testing/fakeSoqlBuilderService.js';

type StateOverrides = Partial<Omit<SoqlBuilderState, 'metadata' | 'query'>> & {
  readonly metadata?: Partial<SoqlBuilderState['metadata']>;
  readonly query?: Partial<SoqlBuilderState['query']>;
};

export type SoqlBuilderBrowserHarness = {
  readonly connectAgain: () => void;
  readonly emit: (overrides: StateOverrides) => Promise<void>;
  readonly fail: (message: string) => Promise<void>;
  readonly failNextDispatch: (message: string) => Promise<void>;
  readonly mount: (overrides?: StateOverrides) => Promise<void>;
  readonly reconnect: () => Promise<void>;
  readonly recordedActions: () => Promise<readonly SoqlBuilderAction[]>;
  readonly setDispatchLatency: (latency: Duration.DurationInput) => Promise<void>;
  readonly stats: () => Promise<FakeSoqlBuilderServiceStats>;
  readonly unmount: () => Promise<void>;
};

const makeField = (name: string, label: string): SoqlBuilderState['metadata']['fields'][number] => ({
  aggregatable: true,
  custom: false,
  defaultValue: null,
  extraTypeInfo: null,
  filterable: true,
  groupable: true,
  inlineHelpText: null,
  label,
  name,
  nillable: true,
  picklistValues: [],
  referenceTo: [],
  relationshipName: null,
  sortable: true,
  type: 'string'
});

const defaultState = (): SoqlBuilderState => ({
  ...createInitialSoqlBuilderState(),
  metadata: {
    childRelationships: [],
    fields: [makeField('Id', 'Record ID'), makeField('Name', 'Account Name')],
    objects: [
      { label: 'Account', name: 'Account', queryable: true },
      { label: 'Contact', name: 'Contact', queryable: true }
    ]
  }
});

const mergeState = (base: SoqlBuilderState, overrides: StateOverrides = {}): SoqlBuilderState => ({
  ...base,
  ...overrides,
  metadata: { ...base.metadata, ...overrides.metadata },
  query: { ...base.query, ...overrides.query }
});

const nextFrame = Effect.async<void>(resume => {
  requestAnimationFrame(() => resume(Effect.void));
});

const waitUntil = (predicate: () => boolean | Promise<boolean>, message: string): Promise<void> =>
  Effect.runPromise(
    Effect.promise(async () => predicate()).pipe(
      Effect.tap(satisfied => (satisfied ? Effect.void : nextFrame)),
      Effect.repeat({ until: (satisfied: boolean) => satisfied, times: 120 })
    )
  ).then(satisfied => {
    if (!satisfied) throw new Error(message);
  });

registerSoqlBuilderElements();

let application: SoqlBuilderApplication | undefined;
let element: SoqlBuilderElement | undefined;
let fake: FakeSoqlBuilderService | undefined;
let latestState = defaultState();

const requireElement = (): SoqlBuilderElement => {
  if (!element) throw new Error('Mount the SOQL Builder before using the browser harness');
  return element;
};

const requireFake = (): FakeSoqlBuilderService => {
  if (!fake) throw new Error('Mount the SOQL Builder before using its fake Effect service');
  return fake;
};

const readStats = (): Promise<FakeSoqlBuilderServiceStats> => Effect.runPromise(requireFake().stats);

const waitForActiveSubscription = () =>
  waitUntil(async () => {
    const current = await readStats();
    return current.activeLayers === 1 && current.activeSubscriptions === 1;
  }, 'The fake SOQL Builder service was not acquired and subscribed');

const waitForFinalizers = () =>
  waitUntil(async () => {
    const current = await readStats();
    return current.activeLayers === 0 && current.activeSubscriptions === 0 && current.dispatchesInFlight === 0;
  }, 'The SOQL Builder application did not release its Effect resources');

const unmount = async (): Promise<void> => {
  if (!element) return;
  element.remove();
  await waitForFinalizers();
};

window.soqlBuilderHarness = {
  connectAgain: () => application?.connect(),
  emit: async overrides => {
    const mountedElement = requireElement();
    latestState = mergeState(latestState, overrides);
    await Effect.runPromise(requireFake().emit(latestState));
    await waitUntil(() => mountedElement.viewState === latestState, 'The emitted builder state was not rendered');
    await mountedElement.updateComplete;
  },
  fail: async message => {
    const mountedElement = requireElement();
    await Effect.runPromise(
      requireFake().fail(
        new SoqlBuilderMessageChannelError({
          details: message
        })
      )
    );
    await waitUntil(() => mountedElement.viewState.errorMessage === message, 'The service failure was not rendered');
    await mountedElement.updateComplete;
  },
  failNextDispatch: message =>
    Effect.runPromise(
      requireFake().failNextDispatch(
        new SoqlBuilderMessageChannelError({
          details: message
        })
      )
    ),
  mount: async overrides => {
    await unmount();
    latestState = mergeState(defaultState(), overrides);
    fake = Effect.runSync(makeFakeSoqlBuilderService(latestState));
    element = document.createElement('soql-builder-app');
    element.labels = {
      fields: 'Fields',
      from: 'From',
      inputs: 'Query inputs',
      noDefaultOrg: 'No default org',
      query: 'Query preview'
    };
    application = new SoqlBuilderApplication(element, fake.layer);
    element.lifecycle = application;
    document.body.replaceChildren(element);
    await waitForActiveSubscription();
    await element.updateComplete;
  },
  reconnect: async () => {
    const mountedElement = requireElement();
    mountedElement.remove();
    await waitForFinalizers();
    document.body.append(mountedElement);
    await waitForActiveSubscription();
    await mountedElement.updateComplete;
  },
  recordedActions: () => Effect.runPromise(requireFake().recordedActions),
  setDispatchLatency: latency => Effect.runPromise(requireFake().setDispatchLatency(latency)),
  stats: readStats,
  unmount
};

declare global {
  interface Window {
    soqlBuilderHarness: SoqlBuilderBrowserHarness;
  }
}

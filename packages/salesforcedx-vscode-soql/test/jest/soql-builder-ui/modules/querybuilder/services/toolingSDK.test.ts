/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Effect, Layer, SubscriptionRef } from 'effect';
import { ToolingSDK } from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/toolingSDK';
import {
  MessageService,
  IMessageService
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/iMessageService';
import {
  MessageType,
  SoqlEditorEvent
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';

const makeTestMessageLayer = () => {
  const listeners: Array<(e: SoqlEditorEvent) => void> = [];
  const sendMessage = jest.fn();
  const service: IMessageService = {
    onMessage: cb => {
      listeners.push(cb);
    },
    sendMessage,
    setState: jest.fn(),
    getState: jest.fn()
  };
  const emit = (event: SoqlEditorEvent) => listeners.forEach(l => l(event));
  const layer = Layer.succeed(MessageService, service);
  return { layer, emit, sendMessage };
};

const runWithSDK = <A>(layer: Layer.Layer<MessageService>, body: (sdk: ToolingSDK) => Effect.Effect<A>): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const sdk = yield* ToolingSDK;
      return yield* body(sdk);
    }).pipe(Effect.provide(Layer.provide(ToolingSDK.Default, layer)))
  );

describe('Tooling SDK Service', () => {
  it('Retrieve SObjects', async () => {
    const { layer, emit, sendMessage } = makeTestMessageLayer();

    await runWithSDK(layer, sdk =>
      Effect.gen(function* () {
        const initial = yield* SubscriptionRef.get(sdk.sobjects);
        expect(initial).toStrictEqual([]);

        sdk.loadSObjectDefinitions();
        const fakeSObjectNames = ['Hey', 'Jude'];
        emit({ type: MessageType.SOBJECTS_RESPONSE, payload: fakeSObjectNames });

        const updated = yield* SubscriptionRef.get(sdk.sobjects);
        expect(updated).toStrictEqual(fakeSObjectNames);
        expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.SOBJECTS_REQUEST });
      })
    );
  });

  it('Retrieve SObject metadata', async () => {
    const { layer, emit, sendMessage } = makeTestMessageLayer();
    const fakeSObjectName = 'MySObject';
    const fakeSObjectMetadata = {
      fields: [
        { name: 'field1', extraStuff: 'xyz' },
        { name: 'field2', extraStuff: 'zyx' }
      ]
    };

    await runWithSDK(layer, sdk =>
      Effect.gen(function* () {
        const initial = yield* SubscriptionRef.get(sdk.sobjectMetadata);
        expect(initial).toStrictEqual({ fields: [] });

        sdk.loadSObjectMetadata(fakeSObjectName);
        expect(sendMessage).toHaveBeenCalledWith({
          type: MessageType.SOBJECT_METADATA_REQUEST,
          payload: fakeSObjectName
        });

        emit({ type: MessageType.SOBJECT_METADATA_RESPONSE, payload: fakeSObjectMetadata });
        const updated = yield* SubscriptionRef.get(sdk.sobjectMetadata);
        expect(updated).toStrictEqual(fakeSObjectMetadata);
      })
    );
  });

  it('queryRunState initial value is false', async () => {
    const { layer } = makeTestMessageLayer();
    await runWithSDK(layer, sdk =>
      Effect.gen(function* () {
        const val = yield* SubscriptionRef.get(sdk.queryRunState);
        expect(val).toBe(false);
      })
    );
  });

  it('queryRunState set to false on RUN_SOQL_QUERY_DONE', async () => {
    const { layer, emit } = makeTestMessageLayer();
    await runWithSDK(layer, sdk =>
      Effect.gen(function* () {
        emit({ type: MessageType.RUN_SOQL_QUERY_DONE });
        const val = yield* SubscriptionRef.get(sdk.queryRunState);
        expect(val).toBe(false);
      })
    );
  });

  it('Load SObject metadata on CONNECTION_CHANGED message', async () => {
    const { layer, emit, sendMessage } = makeTestMessageLayer();

    await runWithSDK(layer, sdk =>
      Effect.gen(function* () {
        sdk.loadSObjectMetadata('Help!');
        sendMessage.mockClear();

        emit({ type: MessageType.CONNECTION_CHANGED });

        expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.SOBJECTS_REQUEST });
        expect(sendMessage).toHaveBeenCalledWith({
          type: MessageType.SOBJECT_METADATA_REQUEST,
          payload: 'Help!'
        });
      })
    );
  });
});

/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { getWindow } from '../../../../../../../src/soql-builder-ui/modules/querybuilder/services/globals';
import { makeVscodeMessageService } from '../../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/vscodeMessageService';
import { MessageType } from '../../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';

describe('VscodeMessageService', () => {
  let vsCodeApi;
  let listener;
  let vscodeMessageService;
  const window = getWindow();
  const messageType = 'message';
  const accountQuery = 'SELECT Id FROM Account';

  const postMessagePayload = (type?: string, payload?: unknown) => ({
    data: {
      type: type || MessageType.TEXT_SOQL_CHANGED,
      payload: payload || accountQuery
    }
  });

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,no-undef
    vsCodeApi = acquireVsCodeApi();
    listener = jest.fn();
    vscodeMessageService = makeVscodeMessageService();
    vscodeMessageService.onMessage(listener);
  });

  afterEach(() => {
    vscodeMessageService.dispose();
  });

  it('calls postMessage with activated type immediately when created', () => {
    jest.spyOn(vsCodeApi, 'postMessage');
    const service = makeVscodeMessageService();
    expect(vsCodeApi.postMessage).toHaveBeenCalledWith({ type: MessageType.UI_ACTIVATED });
    service.dispose();
  });

  it('sets and gets state', () => {
    const state = 'hello world';
    vscodeMessageService.setState(state);
    expect(vscodeMessageService.getState()).toEqual(state);
  });

  it('passes through query messages from the text editor', () => {
    const messageEvent = new MessageEvent(messageType, postMessagePayload());
    window.dispatchEvent(messageEvent);
    expect(listener).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(listener.mock.calls[0][0].payload).toEqual(accountQuery);
  });

  it('filters out malformed SOQL event messages', () => {
    const messageEvent = new MessageEvent(messageType, { data: { no_type_specified: 'xyz' } });
    window.dispatchEvent(messageEvent);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('filters out known message types with invalid payloads', () => {
    const messageEvent = new MessageEvent(messageType, {
      data: { type: MessageType.TEXT_SOQL_CHANGED, payload: { soql: accountQuery } }
    });
    window.dispatchEvent(messageEvent);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('does not publish UI-to-host messages to host-message listeners', () => {
    const messageEvent = new MessageEvent(messageType, {
      data: { type: MessageType.UI_ACTIVATED }
    });
    window.dispatchEvent(messageEvent);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('removes its window listener when disposed', () => {
    vscodeMessageService.dispose();
    window.dispatchEvent(new MessageEvent(messageType, postMessagePayload()));
    expect(listener).toHaveBeenCalledTimes(0);
  });
});

/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { getWindow } from '../globals';
import { VscodeMessageService } from './vscodeMessageService';
import { MessageType } from './soqlEditorEvent';

describe('VscodeMessageService', () => {
  let vsCodeApi;
  let listener;
  let vscodeMessageService;
  let window;
  const messageType = 'message';
  const accountQuery = {
    sObject: 'Account',
    fields: []
  };
  const postMessagePayload = (type?: string, payload?: string) => {
    return {
      data: {
        type: type || MessageType.TEXT_SOQL_CHANGED,
        payload: payload || accountQuery
      }
    };
  };

  beforeEach(() => {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    window = getWindow();
    // @ts-ignore
    // eslint-disable-next-line no-undef
    vsCodeApi = acquireVsCodeApi();
    listener = jest.fn();
    vscodeMessageService = new VscodeMessageService();
    vscodeMessageService.messagesToUI.subscribe(listener);
  });

  it('calls postMessage with activated type immediately when created', () => {
    expect(vsCodeApi).toBeTruthy();
    jest.spyOn(vsCodeApi, 'postMessage');
    // eslint-disable-next-line no-new
    new VscodeMessageService();
    expect(vsCodeApi.postMessage).toHaveBeenCalled();
    expect(vsCodeApi.postMessage).toHaveBeenCalledWith({
      type: MessageType.UI_ACTIVATED
    });
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
    expect(listener.mock.calls[0][0].payload.sObject).toEqual(
      accountQuery.sObject
    );
  });

  it('filters out malformed SOQL event messages', () => {
    const messageEvent = new MessageEvent(messageType, {
      data: {
        no_type_specified: 'xyz'
      }
    });
    window.dispatchEvent(messageEvent);
    expect(listener).toHaveBeenCalledTimes(0);
  });
});

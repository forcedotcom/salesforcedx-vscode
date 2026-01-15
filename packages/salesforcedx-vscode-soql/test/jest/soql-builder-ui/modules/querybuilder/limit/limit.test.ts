/* eslint-disable @lwc/lwc/prefer-custom-event */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { createElement } from 'lwc';
import Limit from 'querybuilder/limit';

describe('Limit', () => {
  let limitCmp;

  beforeEach(() => {
    limitCmp = createElement('querybuilder-limit', {
      is: Limit
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('displays undefined limit correctly', () => {
    document.body.appendChild(limitCmp);

    const limitInput = limitCmp.shadowRoot.querySelector('[data-el-limit]');
    expect(limitInput.value).toEqual('');
  });

  it('displays an actual limit with a valid number', () => {
    limitCmp.limit = 11;
    document.body.appendChild(limitCmp);

    const limitInput = limitCmp.shadowRoot.querySelector('[data-el-limit]');
    // input element values are always a string.
    expect(limitInput.value).toEqual(limitCmp.limit.toString());
  });

  it('emits an event when limit is changed', () => {
    document.body.appendChild(limitCmp);

    const handler = jest.fn();
    limitCmp.addEventListener('limit__changed', handler);
    const limitInput = limitCmp.shadowRoot.querySelector('[data-el-limit]');
    limitInput.value = 11;
    limitInput.dispatchEvent(new Event('change'));

    return Promise.resolve().then(() => {
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail.limit).toEqual(limitInput.value);
    });
  });

  /**
   * behavior of onchange in input[type=number] doesn't trigger until focus is elsewhere
   * so as a user, if i manually change the field by typing into it,
   * the query doesn't change until i click out / focus elsewhere.
   *
   * by adding a keyup handler, the field reacts immediately to both manual typing and
   * manipulating the input field with the up and down arrows
   */
  it('emits an event when keyup is detected', () => {
    document.body.appendChild(limitCmp);

    const handler = jest.fn();
    limitCmp.addEventListener('limit__changed', handler);
    const limitInput = limitCmp.shadowRoot.querySelector('[data-el-limit]');
    limitInput.value = 11;
    limitInput.dispatchEvent(new Event('keyup'));

    return Promise.resolve().then(() => {
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail.limit).toEqual(limitInput.value);
    });
  });

  it('should alert user when error', async () => {
    document.body.appendChild(limitCmp);
    expect(limitCmp.hasError).toEqual(false);
    let hasError = limitCmp.shadowRoot.querySelectorAll('[data-el-has-error]');
    expect(hasError.length).toEqual(0);
    limitCmp.hasError = true;
    return Promise.resolve().then(() => {
      hasError = limitCmp.shadowRoot.querySelectorAll('[data-el-has-error]');
      expect(hasError.length).toEqual(1);
    });
  });
});

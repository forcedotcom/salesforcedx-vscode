/* eslint-disable @lwc/lwc/valid-api */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { createElement, api } from 'lwc';
import From from 'querybuilder/from';
// eslint-disable-next-line @lwc/lwc/no-leading-uppercase-api-name
class TestFrom extends From {
  @api _selectedObject: string[] = [];
}

describe('From', () => {
  let from;

  beforeEach(() => {
    from = createElement('querybuilder-from', {
      is: TestFrom
    });
    from.selected = 'Account';
    from.sobjects = ['foo', 'bar', 'baz'];
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('should store selected object as array for customSelect', () => {
    document.body.appendChild(from);
    expect(Array.isArray(from._selectedObject)).toBeTruthy();
    expect(from._selectedObject[0]).toBe(from.selected);
  });

  it('emits an event when object is selected', () => {
    document.body.appendChild(from);

    const handler = jest.fn();
    from.addEventListener('from__object_selected', handler);
    const customSelect = from.shadowRoot.querySelector(
      'querybuilder-custom-select'
    );
    customSelect.dispatchEvent(
      new CustomEvent('option__selection', { detail: { value: 'foo' } })
    );

    return Promise.resolve().then(() => {
      expect(handler).toHaveBeenCalled();
    });
  });

  it('should alert user when error', async () => {
    document.body.appendChild(from);
    expect(from.hasError).toEqual(false);
    let hasError = from.shadowRoot.querySelectorAll('[data-el-has-error]');
    expect(hasError.length).toEqual(0);
    from.hasError = true;
    return Promise.resolve().then(() => {
      hasError = from.shadowRoot.querySelectorAll('[data-el-has-error]');
      expect(hasError.length).toEqual(1);
    });
  });
});

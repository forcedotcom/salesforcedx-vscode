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
import OrderBy from 'querybuilder/orderBy';

describe('OrderBy should', () => {
  const orderBy = createElement('querybuilder-order-by', {
    is: OrderBy
  });

  beforeEach(() => {
    orderBy.orderByFields = ['foo', 'bar'];
    orderBy.selectedOrderByFields = [];
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('emit event when orderby field is selected', () => {
    document.body.appendChild(orderBy);

    const handler = jest.fn();
    orderBy.addEventListener('orderby__selected', handler);
    const selectField = orderBy.shadowRoot.querySelector(
      'querybuilder-custom-select'
    );
    selectField.selectedOptions = ['foo'];
    const button = orderBy.shadowRoot.querySelector('[data-el-add-button]');

    // make the magic happen
    button.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.field).toEqual(selectField.value[0]);
    expect(handler.mock.calls[0][0].detail.order).toEqual('');
    expect(handler.mock.calls[0][0].detail.nulls).toEqual('');
  });

  it('emit event when orderby field is selected, adds order and nulls', () => {
    document.body.appendChild(orderBy);

    const handler = jest.fn();
    orderBy.addEventListener('orderby__selected', handler);
    const selectField = orderBy.shadowRoot.querySelector(
      'querybuilder-custom-select'
    );
    selectField.selectedOptions = ['foo'];
    const selectOrder = orderBy.shadowRoot.querySelector(
      '[data-el-orderby-order]'
    );
    selectOrder.value = 'ASC';
    const selectNulls = orderBy.shadowRoot.querySelector(
      '[data-el-orderby-nulls]'
    );
    selectNulls.value = 'NULLS LAST';
    const button = orderBy.shadowRoot.querySelector('[data-el-add-button]');

    // lebowski reference
    button.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.field).toEqual(selectField.value[0]);
    expect(handler.mock.calls[0][0].detail.order).toEqual(selectOrder.value);
    expect(handler.mock.calls[0][0].detail.nulls).toEqual(selectNulls.value);
  });

  it('not emit event when orderby field is empty', () => {
    document.body.appendChild(orderBy);

    const handler = jest.fn();
    orderBy.addEventListener('orderby__selected', handler);
    const selectField = orderBy.shadowRoot.querySelector(
      'querybuilder-custom-select'
    );
    selectField.selectedOptions = [''];
    const button = orderBy.shadowRoot.querySelector('[data-el-add-button]');

    // make the magic happen
    button.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit event when a orderby field is removed', () => {
    orderBy.selectedOrderByFields = [{ field: 'foo' }];
    document.body.appendChild(orderBy);

    const handler = jest.fn();
    orderBy.addEventListener('orderby__removed', handler);

    const selectedFieldCloseEl =
      orderBy.shadowRoot.querySelector("[data-field='foo']");
    selectedFieldCloseEl.click();

    expect(handler).toHaveBeenCalled();
  });

  it('render the selected orderby fields in the component', () => {
    document.body.appendChild(orderBy);

    let selectedFieldEl =
      orderBy.shadowRoot.querySelectorAll('.selected-field');
    expect(selectedFieldEl.length).toBe(0);

    orderBy.selectedOrderByFields = [{ field: 'foo' }];

    return Promise.resolve().then(() => {
      selectedFieldEl = orderBy.shadowRoot.querySelectorAll('.selected-field');
      expect(selectedFieldEl.length).toBe(1);
    });
  });

  it('alert user when error', async () => {
    document.body.appendChild(orderBy);
    expect(orderBy.hasError).toEqual(false);
    let hasError = orderBy.shadowRoot.querySelectorAll('[data-el-has-error]');
    expect(hasError.length).toEqual(0);
    orderBy.hasError = true;
    return Promise.resolve().then(() => {
      hasError = orderBy.shadowRoot.querySelectorAll('[data-el-has-error]');
      expect(hasError.length).toEqual(1);
    });
  });
});

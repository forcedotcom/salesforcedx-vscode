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
import QueryPreview from 'querybuilder/queryPreview';

describe('Query Preview', () => {
  const queryPreview = createElement('querybuilder-query-preview', {
    is: QueryPreview
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('displays statement', async () => {
    queryPreview.soqlStatement = 'SELECT name FROM account';
    document.body.appendChild(queryPreview);

    return Promise.resolve().then(() => {
      const soqlStatementEl = queryPreview.shadowRoot.querySelector('.query');
      expect(soqlStatementEl.textContent).toEqual(queryPreview.soqlStatement);
    });
  });
});

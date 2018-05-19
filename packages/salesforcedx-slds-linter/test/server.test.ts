/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { validateTextDocument } from '../src/server/index';

describe('SLDS Linter Language Server', () => {
  let args: any;
  const connection = {
    sendDiagnostics: (obj: any) => {
      args = obj;
    }
  };

  it('Should send correct string', () => {
    validateTextDocument('\n class"slds-button--brand" \n', 'uri', connection);
    if (args) {
      expect(args.diagnostics[0].code.slice(1)).equals('slds-button_brand');
    } else {
      assert(args, 'Server connection arguments are null');
    }
  });

  it('Should diagnose 2 deprecated class names', () => {
    validateTextDocument(
      '\n class"slds-button--brand slds-text-color--default" \n',
      'uri',
      connection
    );
    if (args) {
      expect(args.diagnostics.length).equals(2);
    } else {
      assert(args, 'Server connection arguments are null');
    }
  });

  it('Should send diagnostic to connection', () => {
    const mock = sinon.mock(connection);
    validateTextDocument('\n class"slds-button--brand"" \n', 'uri', connection);
    if (args) {
      mock.expects('sendDiagnostics').once();
    } else {
      assert(args, 'Server connection arguments are null');
    }
  });
});

/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Message, MISSING_LABEL_MSG } from '../../../src';

describe('Message Unit Tests.', () => {
  const messageBundle = {
    a: 'a',
    b: 'b',
    c: 'c',
    e: '%s:%s',
    f: '1 %s 2 %s 3 %s',
    integerFormat: 'Value: %i',
    decimalFormat: 'Price: %d',
    floatFormat: 'Temperature: %f degrees',
    jsonFormat: 'Data: %j',
    mixedFormat: 'User %s has %d points and data %j',
    percentLiteralFormat: 'Progress: 100%% complete',
    multiTypeFormat: 'String: %s, Integer: %i, Float: %f, JSON: %j'
  };
  const backupMessageBundle = { a: '1', b: '2', c: '3', d: '4' };
  let delegate: Message;

  beforeEach(() => {
    delegate = new Message(backupMessageBundle);
    // Avoid printing warnings in tests.
    jest.spyOn(console, 'warn');
    jest.spyOn(console, 'log');
  });

  it('Should be able to create an instance.', () => {
    const message = new Message(messageBundle, delegate);
    expect(message).toBeInstanceOf(Message);
  });

  it('Should find the label in the primary messageBundle.', () => {
    const message = new Message(messageBundle, delegate);
    const label = message.localize('a');
    expect(label).toEqual(messageBundle.a);
  });

  it('Should find the label in the delegate messageBundle.', () => {
    const message = new Message(messageBundle, delegate);
    const label = message.localize('d');
    expect(label).toEqual(backupMessageBundle.d);
  });

  describe('label not found', () => {
    it('Should return error label if not found in either bundle.', () => {
      const message = new Message(messageBundle, delegate);
      const labelKey = 'notAKey';
      const label = message.localize(labelKey);
      const expected = `${MISSING_LABEL_MSG} ${labelKey}`;
      expect(label).toEqual(expected);
    });

    it('Should return error label with args if not found in either bundle.', () => {
      const message = new Message(messageBundle, delegate);
      const labelKey = 'notAKey';
      const arg1 = 'arg1';
      const arg2 = 'arg2';
      const label = message.localize(labelKey, arg1, arg2);
      const expected = `${MISSING_LABEL_MSG} ${labelKey} (${arg1}) (${arg2})`;
      expect(label).toEqual(expected);
    });

    it('Should return error label if no delegate and no lable found.', () => {
      const message = new Message(messageBundle);
      const labelKey = 'notAKey';
      const label = message.localize(labelKey);
      const expected = `${MISSING_LABEL_MSG} ${labelKey}`;
      expect(label).toEqual(expected);
    });
  });

  describe('passing arguments', () => {
    it('Should correctly populate args.', () => {
      const message = new Message(messageBundle, delegate);
      const arg1 = 'arg1';
      const arg2 = 'arg2';

      const label = message.localize('e', arg1, arg2);
      const expected = `${arg1}:${arg2}`;
      expect(label).toEqual(expected);
    });

    it('Should ignore extra args.', () => {
      const message = new Message(messageBundle, delegate);
      const arg1 = 'arg1';
      const arg2 = 'arg2';

      const label = message.localize('e', arg1, arg2, 'arg3', 'arg4', 'arg5');
      const expected = `${arg1}:${arg2}`;
      expect(label).toEqual(expected);
    });

    it('Should only partially populate if too few args are passed.', () => {
      const message = new Message(messageBundle, delegate);
      const arg1 = 'arg1';

      const label = message.localize('e', arg1);
      const expected = `${arg1}:%s`;
      expect(label).toEqual(expected);
    });

    describe('format specifiers', () => {
      it('Should handle %i (integer) format specifier.', () => {
        const message = new Message(messageBundle, delegate);
        const label = message.localize('integerFormat', 42);
        expect(label).toEqual('Value: 42');
      });

      it('Should handle %d (decimal) format specifier.', () => {
        const message = new Message(messageBundle, delegate);
        const label = message.localize('decimalFormat', 99);
        expect(label).toEqual('Price: 99');
      });

      it('Should handle %f (float) format specifier.', () => {
        const message = new Message(messageBundle, delegate);
        const label = message.localize('floatFormat', 23.5);
        expect(label).toEqual('Temperature: 23.5 degrees');
      });

      it('Should handle %j (JSON) format specifier.', () => {
        const message = new Message(messageBundle, delegate);
        const testObj = { name: 'test', value: 123 };
        const label = message.localize('jsonFormat', testObj);
        expect(label).toEqual('Data: {"name":"test","value":123}');
      });

      it('Should handle mixed format specifiers.', () => {
        const message = new Message(messageBundle, delegate);
        const testData = { role: 'admin', permissions: ['read', 'write'] };
        const label = message.localize('mixedFormat', 'John', 150, testData);
        expect(label).toEqual('User John has 150 points and data {"role":"admin","permissions":["read","write"]}');
      });

      it('Should handle %% (literal percent) without consuming arguments.', () => {
        const message = new Message(messageBundle, delegate);
        const label = message.localize('percentLiteralFormat');
        // Node.js util.format() only converts %% to % when there are arguments
        expect(label).toEqual('Progress: 100%% complete');
      });

      it('Should handle all format specifiers together.', () => {
        const message = new Message(messageBundle, delegate);
        const testObj = { status: 'active' };
        const label = message.localize('multiTypeFormat', 'example', 42, 3.14, testObj);
        expect(label).toEqual('String: example, Integer: 42, Float: 3.14, JSON: {"status":"active"}');
      });

      it('Should count format specifiers correctly and ignore %%.', () => {
        const message = new Message(messageBundle, delegate);
        // This should not consume any arguments since %% is a literal
        const label = message.localize('percentLiteralFormat', 'extraArg');
        // The localize method correctly removes extra args, so %% stays as %%
        expect(label).toEqual('Progress: 100%% complete');
      });

      it('Should handle partial population with mixed format specifiers.', () => {
        const message = new Message(messageBundle, delegate);
        const label = message.localize('multiTypeFormat', 'test', 10);
        // Should populate first two and leave the rest as-is
        expect(label).toEqual('String: test, Integer: 10, Float: %f, JSON: %j');
      });
    });
  });
});

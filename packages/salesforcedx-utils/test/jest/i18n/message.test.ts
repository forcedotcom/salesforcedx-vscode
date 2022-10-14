import { Message, MISSING_LABEL_MSG } from '../../../src';

describe('Message Unit Tests.', () => {
  const messageBundle = {
    a: 'a',
    b: 'b',
    c: 'c',
    e: '%s:%s',
    f: '1 %s 2 %s 3 %s'
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
  });
});

import { Localization, Message, MessageBundle } from '../../../src';

describe('Localization Unit Tests.', () => {
  const fakeMessages: MessageBundle = { a: 'a', b: 'b', c: 'c' };
  const localizaedValue = 'hooray';
  let delegateLocalizeSpy: jest.SpyInstance<string, [label: string, ...args: any[]]>;

  beforeEach(() => {
    delegateLocalizeSpy = jest
      .spyOn(Message.prototype, 'localize')
      .mockReturnValue(localizaedValue);
  });
  it('Should be able to create an instance.', () => {
    const fakeMessage = new Message(fakeMessages, undefined);
    const localization = new Localization(fakeMessage);
    expect(localization).toBeInstanceOf(Localization);
    expect((localization as any).delegate).toEqual(fakeMessage);
  });

  it('Should call though localize calls to delegate.', () => {
    const fakeMessage = new Message(fakeMessages, undefined);
    const localization = new Localization(fakeMessage);
    const result = localization.localize('fakeLabel', 1, true, 'fake');
    expect(result).toEqual(localizaedValue);
    expect(delegateLocalizeSpy).toHaveBeenCalledWith(
      'fakeLabel',
      1,
      true,
      'fake'
    );
  });
});

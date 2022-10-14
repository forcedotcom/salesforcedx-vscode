import { extractJsonObject } from '../../../src';

describe('extractJsonObject unit tests', () => {
  const initialValue = {
    how: 'does',
    it: true,
    get: 5,
    handled: false
  };
  const jsonString = JSON.stringify(initialValue);

  it('Should be able to parse a json string.', () => {
    const result = extractJsonObject(jsonString);
    expect(result).toStrictEqual(initialValue);
  });

  it('Should throw if JSON fails to parse.', () => {
    const invalidJson = jsonString.substring(3);
    expect(() => extractJsonObject(invalidJson)).toThrow(/Unexpected token/);
  });
});

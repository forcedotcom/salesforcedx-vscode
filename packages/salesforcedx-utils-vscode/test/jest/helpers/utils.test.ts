/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { realpathSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { TelemetryService } from '../../../src';
import { extractJsonObject, flushFilePath } from '../../../src/helpers/utils';

describe('flushFilePath', () => {
  let teleSpy: jest.SpyInstance;
  let originalPath = '';
  beforeEach(() => {
    jest.mock('fs');
    jest.mock('../../../src/context/workspaceContextUtil');
    originalPath = './test.txt';
    const fileContent = 'Hello, world!';
    writeFileSync(originalPath, fileContent);
  });

  afterEach(() => {
    // Clean up the file after each test
    if (existsSync(originalPath)) {
      unlinkSync(originalPath);
    }
  });

  it('should not send to telemetry if there are no changes in character casing', () => {
    const alteredPath = './test.txt';

    jest.spyOn(realpathSync, 'native').mockReturnValue(alteredPath);
    teleSpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

    const r = flushFilePath(originalPath);
    expect(r).toEqual(alteredPath);
    expect(teleSpy).not.toHaveBeenCalled();
  });
});

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

  it('Should throw error if argument is a simple text', () => {
    const invalidJson = initialValue.how;
    expect(() => extractJsonObject(invalidJson)).toThrow(
      'The string "does" is not a valid JSON string.'
    );
  });

  it('Should throw error if argument is invalid JSON string', () => {
    const invalidJson = jsonString.substring(10);
    expect(() => extractJsonObject(invalidJson)).toThrow(
      `The string "${invalidJson}" is not a valid JSON string.`
    );
  });
});

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ExtensionPackageJsonSchema } from '../../src/extensionPackageJson';

const extensionPackageJson = {
  name: 'salesforcedx-vscode-core',
  publisher: 'salesforce',
  version: '67.17.17',
  displayName: 'Salesforce CLI',
  aiKey: 'example-key',
  enableO11y: 'true',
  o11yUploadEndpoint: 'https://example.com/o11y',
  otelConnectionString: 'InstrumentationKey=example',
  productFeatureId: 'aJC123',
  enableCustomEventsFromSpans: true
};
const stringFields = [
  'name',
  'publisher',
  'version',
  'displayName',
  'aiKey',
  'o11yUploadEndpoint',
  'otelConnectionString',
  'productFeatureId'
] satisfies ReadonlyArray<keyof typeof extensionPackageJson>;

describe('ExtensionPackageJsonSchema', () => {
  it('decodes shared extension package fields', () => {
    expect(Schema.decodeUnknownSync(ExtensionPackageJsonSchema)(extensionPackageJson)).toEqual(extensionPackageJson);
  });

  it.each(stringFields)('rejects a non-string %s', field => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionPackageJsonSchema)({ ...extensionPackageJson, [field]: 1 })
    ).toThrow();
  });

  it.each([true, false, 'true', 'false'])('accepts enableO11y value %s', enableO11y => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionPackageJsonSchema)({ ...extensionPackageJson, enableO11y })
    ).not.toThrow();
  });

  it('rejects non-boolean enableCustomEventsFromSpans', () => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionPackageJsonSchema)({
        ...extensionPackageJson,
        enableCustomEventsFromSpans: 'true'
      })
    ).toThrow();
  });
});

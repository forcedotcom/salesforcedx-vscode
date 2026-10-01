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
  o11yUploadEndpoint: 'https://example.com/o11y',
  otelConnectionString: 'InstrumentationKey=example'
};
const extensionPackageJsonFields = [
  'name',
  'publisher',
  'version',
  'displayName',
  'o11yUploadEndpoint',
  'otelConnectionString'
] satisfies ReadonlyArray<keyof typeof extensionPackageJson>;

describe('ExtensionPackageJsonSchema', () => {
  it('decodes shared extension package fields', () => {
    expect(Schema.decodeUnknownSync(ExtensionPackageJsonSchema)(extensionPackageJson)).toEqual(extensionPackageJson);
  });

  it.each(extensionPackageJsonFields)('rejects a non-string %s', field => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionPackageJsonSchema)({ ...extensionPackageJson, [field]: 1 })
    ).toThrow();
  });
});

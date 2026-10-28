/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { extensionPackageJsonSchema } from '../../../src/telemetry/schema';

const decodeExtensionPackageJson = Schema.decodeUnknownSync(extensionPackageJsonSchema);

describe('extensionPackageJsonSchema', () => {
  it('validates required and optional extension telemetry metadata', () => {
    expect(
      decodeExtensionPackageJson({
        name: 'salesforcedx-vscode-core',
        version: '1.0.0',
        aiKey: 'key',
        otelConnectionString: 'connection',
        o11yUploadEndpoint: 'https://example.test',
        enableO11y: 'YES',
        productFeatureId: 'aJC123',
        enableCustomEventsFromSpans: true
      })
    ).toMatchObject({
      name: 'salesforcedx-vscode-core',
      version: '1.0.0',
      enableO11y: true,
      productFeatureId: 'aJC123',
      enableCustomEventsFromSpans: true
    });
  });

  it('decodes false-like string booleans', () => {
    expect(decodeExtensionPackageJson({ name: 'extension', version: '1.0.0', enableO11y: 'off' }).enableO11y).toBe(
      false
    );
  });

  it('rejects missing required fields and invalid optional values', () => {
    expect(() => decodeExtensionPackageJson({ version: '1.0.0' })).toThrow(
      'Extension name is not defined in package.json'
    );
    expect(() => decodeExtensionPackageJson({ name: 'extension' })).toThrow(
      'Extension version is not defined in package.json'
    );
    expect(() =>
      decodeExtensionPackageJson({ name: 'extension', version: '1.0.0', enableO11y: 'sometimes' })
    ).toThrow();
    expect(() =>
      decodeExtensionPackageJson({ name: 'extension', version: '1.0.0', productFeatureId: 'invalid' })
    ).toThrow();
  });
});

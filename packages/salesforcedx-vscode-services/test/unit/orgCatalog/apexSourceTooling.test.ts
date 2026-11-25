/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexSourceTypeSchema,
  apexSourceSoqlWhere,
  apexSourceToolingIdentity
} from '../../../src/services/orgCatalog/apexSourceTooling';

describe('apexSourceToolingIdentity', () => {
  it('uses a null namespace predicate for unpackaged source', () => {
    const identity = apexSourceToolingIdentity('InvoiceService');

    expect(identity).toEqual({ name: 'InvoiceService', namespacePrefix: null });
    expect(apexSourceSoqlWhere(identity)).toBe("Name = 'InvoiceService' AND NamespacePrefix = null");
  });

  it('extracts and escapes the namespace-qualified Tooling identity', () => {
    const identity = apexSourceToolingIdentity("Partner__Service'Impl");

    expect(identity).toEqual({ name: "Service'Impl", namespacePrefix: 'Partner' });
    expect(apexSourceSoqlWhere(identity)).toBe("Name = 'Service\\'Impl' AND NamespacePrefix = 'Partner'");
  });
});

describe('ApexSourceTypeSchema', () => {
  const isApexSourceType = Schema.is(ApexSourceTypeSchema);

  it.each(['ApexClass', 'ApexTrigger'])('accepts %s', type => {
    expect(isApexSourceType(type)).toBe(true);
  });

  it('rejects metadata types without an Apex Tooling source object', () => {
    expect(isApexSourceType('CustomObject')).toBe(false);
  });
});

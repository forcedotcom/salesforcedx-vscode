/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseMyDomain } from '../../../src/virtualFsProvider/indexedDbStorage';

describe('parseMyDomain', () => {
  it('extracts myDomain from production URL', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com')).toBe('acme');
  });

  it('extracts myDomain from sandbox URL', () => {
    expect(parseMyDomain('https://acme--dev.sandbox.my.salesforce.com')).toBe('acme--dev.sandbox');
  });

  it('extracts myDomain from scratch org URL', () => {
    expect(parseMyDomain('https://mycorp.scratch.my.salesforce.com')).toBe('mycorp.scratch');
  });

  it('extracts myDomain from military URL', () => {
    expect(parseMyDomain('https://acme.my.salesforce.mil')).toBe('acme');
  });

  it('extracts myDomain from alternative domain URL', () => {
    expect(parseMyDomain('https://acme.my-salesforce.com')).toBe('acme');
  });

  it('extracts myDomain from China domain URL', () => {
    expect(parseMyDomain('https://acme.my.sfcrmproducts.cn')).toBe('acme');
  });

  it('extracts myDomain from URL with trailing path', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com/')).toBe('acme');
  });

  it('extracts myDomain from URL with path', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com/lightning/setup/SetupOneHome/home')).toBe('acme');
  });

  it('falls back to full hostname for unknown domain', () => {
    expect(parseMyDomain('https://unknown.example.com')).toBe('unknown.example.com');
  });

  it('falls back to full hostname for internal vpod domain', () => {
    expect(parseMyDomain('https://acme.vpod.force.com')).toBe('acme.vpod.force.com');
  });
});

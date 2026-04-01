/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ensureMinXmlHeap } from '../../../src/metadataSupport/metadataXmlSupport';

describe('ensureMinXmlHeap', () => {
  describe('when vmargs is absent or empty', () => {
    it('returns -Xmx1024M for undefined', () => {
      expect(ensureMinXmlHeap(undefined)).toBe('-Xmx1024M');
    });

    it('returns -Xmx1024M for empty string', () => {
      expect(ensureMinXmlHeap('')).toBe('-Xmx1024M');
    });

    it('appends -Xmx1024M when other args are present but no -Xmx', () => {
      expect(ensureMinXmlHeap('-Dsomething=foo')).toBe('-Dsomething=foo -Xmx1024M');
    });
  });

  describe('when -Xmx is below 1024 MB', () => {
    it('replaces -Xmx512M with -Xmx1024M', () => {
      expect(ensureMinXmlHeap('-Xmx512M')).toBe('-Xmx1024M');
    });

    it('replaces lowercase -Xmx512m', () => {
      expect(ensureMinXmlHeap('-Xmx512m')).toBe('-Xmx1024M');
    });

    it('replaces -Xmx256M preserving surrounding args', () => {
      expect(ensureMinXmlHeap('-Dsomething=foo -Xmx256M -Dother=bar')).toBe(
        '-Dsomething=foo -Xmx1024M -Dother=bar'
      );
    });

    it('replaces -Xmx1G (1024 MB == threshold, no change needed)', () => {
      expect(ensureMinXmlHeap('-Xmx1G')).toBeUndefined();
    });

    it('replaces -Xmx512k (very small, kilobytes)', () => {
      expect(ensureMinXmlHeap('-Xmx512k')).toBe('-Xmx1024M');
    });
  });

  describe('when -Xmx is at or above 1024 MB', () => {
    it('returns undefined for -Xmx1024M (already at minimum)', () => {
      expect(ensureMinXmlHeap('-Xmx1024M')).toBeUndefined();
    });

    it('returns undefined for -Xmx2048M', () => {
      expect(ensureMinXmlHeap('-Xmx2048M')).toBeUndefined();
    });

    it('returns undefined for -Xmx2G', () => {
      expect(ensureMinXmlHeap('-Xmx2G')).toBeUndefined();
    });

    it('returns undefined for -Xmx4g (lowercase G)', () => {
      expect(ensureMinXmlHeap('-Xmx4g')).toBeUndefined();
    });
  });
});

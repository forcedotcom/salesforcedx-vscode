/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { escapeHtml } from '../../src/reporters/markdownTextReporter';

describe('Markdown text reporter utilities', () => {
  describe('escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).to.equal('A &amp; B');
    });

    it('should escape angle brackets', () => {
      expect(escapeHtml('<tag>')).to.equal('&lt;tag&gt;');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('"quoted"')).to.equal('&quot;quoted&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).to.equal('it&#39;s');
    });

    it('should escape a string with mixed html characters', () => {
      const input = `<a href="https://example.com?q=1&v=2">it's "fine"</a>`;
      const expected =
        '&lt;a href=&quot;https://example.com?q=1&amp;v=2&quot;&gt;it&#39;s &quot;fine&quot;&lt;/a&gt;';

      expect(escapeHtml(input)).to.equal(expected);
    });

    it('should leave strings without html characters unchanged', () => {
      expect(escapeHtml('plain text 123')).to.equal('plain text 123');
    });
  });
});

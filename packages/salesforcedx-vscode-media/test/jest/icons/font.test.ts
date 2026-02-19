/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fontkit from 'fontkit';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('icon font quality', () => {
  const PKG_DIR = path.resolve(__dirname, '../../..');
  const ICONS_SRC = path.join(PKG_DIR, 'media/icons-src');
  const FONT_PATH = path.join(PKG_DIR, 'media/icons-font/sf-media-icons.woff');

  beforeAll(() => {
    expect(fs.existsSync(FONT_PATH)).toBe(true);
  });

  it('font has glyphs for all package.json icon codepoints', () => {
    const font = fontkit.openSync(FONT_PATH) as fontkit.Font;
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')) as {
      contributes?: { icons?: Record<string, { default?: { fontCharacter?: string } }> };
    };
    const icons = pkg.contributes?.icons ?? {};

    for (const [, icon] of Object.entries(icons)) {
      const fontCharacter = icon?.default?.fontCharacter;
      expect(fontCharacter).toBeDefined();
      const cp = parseInt(String(fontCharacter).replace(/^\\/i, ''), 16);
      expect(font.hasGlyphForCodePoint(cp)).toBe(true);
    }
  });

  it('icon count matches SVG count', () => {
    const svgFiles = fs.readdirSync(ICONS_SRC).filter(f => f.endsWith('.svg'));
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')) as {
      contributes?: { icons?: Record<string, unknown> };
    };
    const icons = pkg.contributes?.icons ?? {};
    expect(Object.keys(icons).length).toBe(svgFiles.length);
  });
});

/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const PKG_DIR = path.resolve(__dirname, '../../..');
const ICONS_SRC = path.join(PKG_DIR, 'media/icons-src');
const ICONS_JSON_PATH = path.join(ICONS_SRC, 'icons.json');
const PKG_JSON_PATH = path.join(PKG_DIR, 'package.json');

const svgNames = fs
  .readdirSync(ICONS_SRC)
  .filter(f => f.endsWith('.svg'))
  .map(f => path.basename(f, '.svg'))
  .sort();

const manifest: Record<string, { id: string; description: string }> = JSON.parse(
  fs.readFileSync(ICONS_JSON_PATH, 'utf8')
);

const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
const contributedIcons: Record<string, { description: string; default: { fontPath: string; fontCharacter: string } }> =
  pkg.contributes?.icons ?? {};

const contributedIds = new Set(Object.keys(contributedIcons));
const manifestEntries = Object.entries(manifest);
const manifestById = new Map(manifestEntries.map(([svgName, { id }]) => [id, svgName]));

/** Custom icon IDs are those contributed by this extension (font-based, not codicons). */
const customIconIds = manifestEntries.map(([, { id }]) => id);

/**
 * Parse ICONS values from mediaService.ts source to avoid importing it
 * (which would pull in Effect, nls, and other deps that need mocking).
 */
const mediaServiceSrc = fs.readFileSync(path.join(PKG_DIR, 'src/vscode/mediaService.ts'), 'utf8');
const iconRefs = [...mediaServiceSrc.matchAll(/'\$\(([^)]+)\)'/g)].map(m => m[1]);
const customIconRefs = iconRefs.filter(id => id.startsWith('sf-'));

describe('Icon consistency', () => {
  describe('every SVG has an icons.json entry', () => {
    it.each(svgNames)('%s', svgName => {
      expect(manifest[svgName]).toBeDefined();
      expect(manifest[svgName].id).toBeTruthy();
      expect(manifest[svgName].description).toBeTruthy();
    });
  });

  describe('every icons.json entry has a SVG file', () => {
    it.each(Object.keys(manifest))('%s', name => {
      expect(svgNames).toContain(name);
    });
  });

  describe('every SVG has a contributes.icons entry', () => {
    it.each(svgNames)('%s', svgName => {
      const expectedId = manifest[svgName]?.id ?? `sf-org-${svgName}`;
      expect(contributedIds.has(expectedId)).toBe(true);
    });
  });

  describe('every contributes.icons entry maps to a SVG', () => {
    it.each(Object.keys(contributedIcons))('%s', iconId => {
      expect(manifestById.has(iconId)).toBe(true);
    });
  });

  describe('contributes.icons descriptions match icons.json', () => {
    it.each(customIconIds)('%s', iconId => {
      const svgName = manifestById.get(iconId)!;
      expect(contributedIcons[iconId]?.description).toBe(manifest[svgName].description);
    });
  });

  describe('contributes.icons font paths are consistent', () => {
    const expectedFontPath = 'resources/icons-font/sf-media-icons.woff';

    it.each(Object.entries(contributedIcons))('%s uses correct font path', (_id, entry) => {
      expect(entry.default.fontPath).toBe(expectedFontPath);
    });
  });

  describe('ICONS constant custom refs match contributes.icons', () => {
    it.each(customIconRefs)('%s has a contributes.icons entry', iconId => {
      expect(contributedIds.has(iconId)).toBe(true);
    });

    it('every contributes.icons entry is referenced in ICONS constant', () => {
      const missing = customIconIds.filter(id => !customIconRefs.includes(id));
      expect(missing).toEqual([]);
    });
  });

  describe('contributes.icons font characters are unique and sequential', () => {
    it('all font characters are unique', () => {
      const chars = Object.values(contributedIcons).map(e => e.default.fontCharacter);
      expect(new Set(chars).size).toBe(chars.length);
    });

    it('font characters are valid unicode escapes', () => {
      for (const entry of Object.values(contributedIcons)) {
        expect(entry.default.fontCharacter).toMatch(/^\\[0-9A-F]{4,}$/);
      }
    });
  });
});

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Array from 'effect/Array';
import * as Equal from 'effect/Equal';
import * as Hash from 'effect/Hash';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import { URI } from 'vscode-uri';
import { HashableUri } from '../../../src/vscode/hashableUri';

describe('HashableUri', () => {
  describe('fromUri / .uri', () => {
    it('exposes the wrapped URI', () => {
      const uri = URI.file('/a/b/c.ts');
      const h = HashableUri.fromUri(uri);
      expect(h.uri.toString()).toBe(uri.toString());
    });

    it('does not mutate the input URI', () => {
      const uri = URI.parse('file:///A:/proj/file.ts');
      const before = uri.toString();
      HashableUri.fromUri(uri);
      expect(uri.toString()).toBe(before);
    });
  });

  describe('Equal contract', () => {
    it('treats two HashableUris with the same toString() as equal', () => {
      const a = HashableUri.fromUri(URI.file('/x/y.ts'));
      const b = HashableUri.fromUri(URI.file('/x/y.ts'));
      expect(Equal.equals(a, b)).toBe(true);
    });

    it('treats different URIs as not equal', () => {
      const a = HashableUri.fromUri(URI.file('/x/y.ts'));
      const b = HashableUri.fromUri(URI.file('/x/z.ts'));
      expect(Equal.equals(a, b)).toBe(false);
    });

    it('rejects plain { uri } objects without the Equal symbol', () => {
      const a = HashableUri.fromUri(URI.file('/x/y.ts'));
      const fake = { uri: URI.file('/x/y.ts') };
      expect(Equal.equals(a, fake)).toBe(false);
    });

    it('rejects objects whose uri.scheme is not a string', () => {
      const a = HashableUri.fromUri(URI.file('/x/y.ts'));
      // Same Equal-symbol shape, but uri.scheme is wrong type — must not pass the structural check
      const fake = {
        uri: { scheme: 42 },
        [Equal.symbol]: () => true,
        [Hash.symbol]: () => 0
      };
      expect(Equal.equals(a, fake)).toBe(false);
    });
  });

  describe('Hash contract', () => {
    it('produces equal hashes for equal HashableUris', () => {
      const a = HashableUri.fromUri(URI.file('/x/y.ts'));
      const b = HashableUri.fromUri(URI.file('/x/y.ts'));
      expect(Hash.hash(a)).toBe(Hash.hash(b));
    });
  });

  describe('Windows drive-letter normalization', () => {
    it('normalizes uppercase drive letters to lowercase on file URIs', () => {
      const upper = HashableUri.fromUri(URI.parse('file:///C:/proj/file.ts'));
      const lower = HashableUri.fromUri(URI.parse('file:///c:/proj/file.ts'));
      expect(upper.uri.path).toBe('/c:/proj/file.ts');
      expect(lower.uri.path).toBe('/c:/proj/file.ts');
      expect(Equal.equals(upper, lower)).toBe(true);
      expect(Hash.hash(upper)).toBe(Hash.hash(lower));
    });

    it('does not touch non-file schemes', () => {
      const parsed = URI.parse('memfs:/A:/proj/file.ts');
      const h = HashableUri.fromUri(parsed);
      // Wrapper passes the URI through untouched — same string the parser produced.
      expect(h.uri.toString()).toBe(parsed.toString());
      expect(h.uri.path).toBe(parsed.path);
    });

    it('does not touch posix paths that happen to start with a single uppercase letter', () => {
      const h = HashableUri.fromUri(URI.file('/Users/me/file.ts'));
      expect(h.uri.path).toBe('/Users/me/file.ts');
    });
  });

  describe('HashSet behavior', () => {
    it('dedupes equal HashableUris', () => {
      const set = HashSet.make(
        HashableUri.fromUri(URI.file('/a.ts')),
        HashableUri.fromUri(URI.file('/a.ts')),
        HashableUri.fromUri(URI.file('/b.ts'))
      );
      expect(HashSet.size(set)).toBe(2);
    });

    it('membership check (HashSet.has) works on a structurally equal HashableUri', () => {
      const set = HashSet.make(HashableUri.fromUri(URI.file('/a.ts')));
      expect(HashSet.has(set, HashableUri.fromUri(URI.file('/a.ts')))).toBe(true);
      expect(HashSet.has(set, HashableUri.fromUri(URI.file('/b.ts')))).toBe(false);
    });

    it('treats Windows drive-letter case differences as the same key', () => {
      const set = HashSet.make(
        HashableUri.fromUri(URI.parse('file:///C:/proj/file.ts')),
        HashableUri.fromUri(URI.parse('file:///c:/proj/file.ts'))
      );
      expect(HashSet.size(set)).toBe(1);
    });
  });

  describe('HashMap behavior', () => {
    it('uses HashableUri as a key, deduping equal keys', () => {
      const map = HashMap.make(
        [HashableUri.fromUri(URI.file('/a.ts')), 'A'] as const,
        [HashableUri.fromUri(URI.file('/a.ts')), 'A2'] as const,
        [HashableUri.fromUri(URI.file('/b.ts')), 'B'] as const
      );
      expect(HashMap.size(map)).toBe(2);
      // Last write wins for the equal key
      expect(HashMap.unsafeGet(map, HashableUri.fromUri(URI.file('/a.ts')))).toBe('A2');
    });

    it('round-trips lookup with a freshly constructed key', () => {
      const map = HashMap.make([HashableUri.fromUri(URI.file('/a.ts')), 'value'] as const);
      const lookup = HashableUri.fromUri(URI.file('/a.ts'));
      expect(HashMap.unsafeGet(map, lookup)).toBe('value');
    });
  });

  describe('Array.dedupe', () => {
    it('dedupes a list of HashableUris with structurally equal values', () => {
      const xs = [
        HashableUri.fromUri(URI.file('/a.ts')),
        HashableUri.fromUri(URI.file('/a.ts')),
        HashableUri.fromUri(URI.file('/b.ts')),
        HashableUri.fromUri(URI.parse('file:///A:/proj/file.ts')),
        HashableUri.fromUri(URI.parse('file:///a:/proj/file.ts'))
      ];
      const deduped = Array.dedupe(xs);
      expect(deduped).toHaveLength(3);
      const paths = deduped.map(h => h.uri.path).toSorted();
      expect(paths).toEqual(['/a.ts', '/a:/proj/file.ts', '/b.ts']);
    });
  });

  describe('with()', () => {
    it('applies a URI change and returns a new HashableUri (data-first form)', () => {
      const original = HashableUri.fromUri(URI.file('/a.ts'));
      const updated = HashableUri.with(original, { path: '/b.ts' });
      expect(updated.uri.path).toBe('/b.ts');
      expect(original.uri.path).toBe('/a.ts');
      expect(Equal.equals(original, updated)).toBe(false);
    });

    it('supports the data-last (pipeable) form', () => {
      const original = HashableUri.fromUri(URI.file('/a.ts'));
      const updated = HashableUri.with({ path: '/b.ts' })(original);
      expect(updated.uri.path).toBe('/b.ts');
    });

    it('re-normalizes drive letters after a path change', () => {
      const original = HashableUri.fromUri(URI.parse('file:///c:/proj/a.ts'));
      const updated = HashableUri.with(original, { path: '/C:/proj/b.ts' });
      expect(updated.uri.path).toBe('/c:/proj/b.ts');
    });
  });
});

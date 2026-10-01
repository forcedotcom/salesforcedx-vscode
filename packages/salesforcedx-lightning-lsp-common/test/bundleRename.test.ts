/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import { URI } from 'vscode-uri';
import {
  AURA_FOLDER,
  bundleFilePattern,
  getBundleKind,
  getBundleUri,
  hasFileNameCollision,
  LWC_FOLDER,
  normalizeComponentName,
  TEST_FOLDER
} from '../src/bundleRename';

describe('bundleFilePattern', () => {
  describe('lwc', () => {
    const re = bundleFilePattern('myThing', 'lwc');

    it.each([
      'myThing.html',
      'myThing.js',
      'myThing.ts',
      'myThing.js-meta.xml',
      'myThing.css',
      'myThing.svg',
      'myThing.test.js',
      'myThing.test.ts'
    ])('matches %s', file => expect(re.test(file)).toBe(true));

    it.each(['otherThing.js', 'myThing.txt', 'myThing.scss', 'myThing-meta.xml', 'myThingExtra.js', 'README.md'])(
      'does not match %s',
      file => expect(re.test(file)).toBe(false)
    );
  });

  describe('aura', () => {
    const re = bundleFilePattern('MyApp', 'aura');

    it.each(['MyApp.cmp', 'MyApp.app', 'MyApp.evt', 'MyApp.css', 'MyApp.svg', 'MyApp.design', 'MyApp.auradoc'])(
      'matches %s',
      file => expect(re.test(file)).toBe(true)
    );

    it.each(['MyAppController.js', 'MyAppRenderer.js', 'MyAppHelper.js', 'MyApp.js'])(
      'matches %s (helper-style js)',
      file => expect(re.test(file)).toBe(true)
    );

    it.each(['Other.cmp', 'MyApp.txt', 'MyAppOther.js'])('does not match %s', file =>
      expect(re.test(file)).toBe(false)
    );
  });

  it('escapes regex metacharacters in component names', () => {
    const re = bundleFilePattern('a.b', 'lwc');
    // Expect literal dot, not "any character"
    expect(re.test('a.b.html')).toBe(true);
    expect(re.test('aXb.html')).toBe(false);
  });
});

describe('getBundleUri', () => {
  it('returns the bundle dir given a file inside it', () => {
    const u = URI.file('/proj/force-app/main/default/lwc/myComp/myComp.js');
    const result = getBundleUri(u);
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result).path.endsWith('/lwc/myComp')).toBe(true);
  });

  it('returns the bundle dir given a file in __tests__', () => {
    const u = URI.file('/proj/force-app/main/default/lwc/myComp/__tests__/myComp.test.js');
    const result = getBundleUri(u);
    expect(Option.getOrThrow(result).path.endsWith('/lwc/myComp')).toBe(true);
  });

  it('returns the bundle dir given the bundle dir itself', () => {
    const u = URI.file('/proj/force-app/main/default/lwc/myComp');
    const result = getBundleUri(u);
    expect(Option.getOrThrow(result).path.endsWith('/lwc/myComp')).toBe(true);
  });

  it('returns none for a path with no lwc/aura segment', () => {
    const u = URI.file('/proj/force-app/main/default/classes/MyClass.cls');
    expect(Option.isNone(getBundleUri(u))).toBe(true);
  });

  it('returns none when sourceUri is the lwc folder itself (no bundle)', () => {
    const u = URI.file('/proj/force-app/main/default/lwc');
    expect(Option.isNone(getBundleUri(u))).toBe(true);
  });

  it('handles aura siblings', () => {
    const u = URI.file('/proj/force-app/main/default/aura/MyApp/MyApp.cmp');
    expect(Option.getOrThrow(getBundleUri(u)).path.endsWith('/aura/MyApp')).toBe(true);
  });
});

describe('getBundleKind', () => {
  it('lwc when parent is lwc', () => {
    expect(getBundleKind(URI.file('/proj/lwc/myComp'))).toBe('lwc');
  });
  it('aura when parent is aura', () => {
    expect(getBundleKind(URI.file('/proj/aura/MyApp'))).toBe('aura');
  });
  it('undefined when parent is neither', () => {
    expect(getBundleKind(URI.file('/proj/classes/MyClass'))).toBeUndefined();
  });
});

describe('hasFileNameCollision', () => {
  const files = ['oldName.html', 'oldName.js', 'oldName.js-meta.xml', '__tests__'];

  it('detects exact stem match', () => {
    expect(hasFileNameCollision(files, 'oldName')).toBe(true);
  });

  it('detects case-insensitive stem match', () => {
    expect(hasFileNameCollision(files, 'OLDNAME')).toBe(true);
    expect(hasFileNameCollision(files, 'oldname')).toBe(true);
  });

  it('does not flag distinct names', () => {
    expect(hasFileNameCollision(files, 'newName')).toBe(false);
  });
});

describe('normalizeComponentName', () => {
  it('lowercases first char for lwc', () => {
    expect(normalizeComponentName('MyThing', 'lwc')).toBe('myThing');
  });
  it('preserves casing for aura', () => {
    expect(normalizeComponentName('MyApp', 'aura')).toBe('MyApp');
  });
});

describe('folder constants', () => {
  it('exports the expected literals', () => {
    expect(LWC_FOLDER).toBe('lwc');
    expect(AURA_FOLDER).toBe('aura');
    expect(TEST_FOLDER).toBe('__tests__');
  });
});

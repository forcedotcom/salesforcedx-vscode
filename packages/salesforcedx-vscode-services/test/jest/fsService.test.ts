/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI, Utils } from 'vscode-uri';
import { toUri } from '../../src/vscode/fsService';

describe('toUri', () => {
  describe('virtual filesystem URIs (memfs)', () => {
    it('should parse memfs:/ URI string correctly', () => {
      const result = toUri('memfs:/MyProject/force-app/main/default/classes/MyClass.cls');

      expect(result.scheme).toBe('memfs');
      expect(result.path).toBe('/MyProject/force-app/main/default/classes/MyClass.cls');
      expect(result.toString()).toBe('memfs:/MyProject/force-app/main/default/classes/MyClass.cls');
    });

    it('should handle memfs:/ with single segment', () => {
      const result = toUri('memfs:/MyProject');

      expect(result.scheme).toBe('memfs');
      expect(result.path).toBe('/MyProject');
    });

    it('should handle memfs:/ with no leading slash in path', () => {
      const result = toUri('memfs:MyProject/file.txt');

      expect(result.scheme).toBe('memfs');
      expect(result.path).toContain('MyProject/file.txt');
    });
  });

  describe('file:// URIs', () => {
    it('should parse file:// URI string correctly (POSIX)', () => {
      const result = toUri('file:///users/me/project/file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toBe('/users/me/project/file.txt');
    });

    it('should parse file:// URI string correctly (Windows)', () => {
      const result = toUri('file:///c:/Users/Me/project/file.txt');

      expect(result.scheme).toBe('file');
      // Note: path will have forward slashes but starts with drive letter
      expect(result.path).toMatch(/^\/c:\//i);
    });
  });

  describe('other URI schemes', () => {
    it('should parse vscode-vfs:// URI', () => {
      const result = toUri('vscode-vfs://github/user/repo/file.txt');

      expect(result.scheme).toBe('vscode-vfs');
      expect(result.authority).toBe('github');
      expect(result.path).toBe('/user/repo/file.txt');
    });

    it('should parse untitled:// URI', () => {
      const result = toUri('untitled:/Untitled-1');

      expect(result.scheme).toBe('untitled');
    });

    it('should parse custom scheme with dots and dashes', () => {
      const result = toUri('my-custom.scheme://path/to/file');

      expect(result.scheme).toBe('my-custom.scheme');
      expect(result.authority).toBe('path');
      expect(result.path).toBe('/to/file');
    });

    it('should parse custom scheme with plus sign', () => {
      const result = toUri('vscode+ssh://server/path/file.txt');

      expect(result.scheme).toBe('vscode+ssh');
      expect(result.authority).toBe('server');
      expect(result.path).toBe('/path/file.txt');
    });
  });

  describe('POSIX file paths (no scheme)', () => {
    it('should convert absolute POSIX path to file:// URI', () => {
      const result = toUri('/users/me/project/file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toBe('/users/me/project/file.txt');
      expect(result.toString()).toBe('file:///users/me/project/file.txt');
    });

    it('should convert relative POSIX path to file:// URI', () => {
      const result = toUri('relative/path/file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toContain('relative/path/file.txt');
    });

    it('should handle POSIX path with spaces', () => {
      const result = toUri('/users/me/my project/file name.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toBe('/users/me/my project/file name.txt');
    });

    it('should handle POSIX path with special characters', () => {
      const result = toUri('/users/me/project/file@#$.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toBe('/users/me/project/file@#$.txt');
    });
  });

  describe('Windows file paths (no scheme)', () => {
    it('should convert absolute Windows path to file:// URI', () => {
      const result = toUri('C:\\Users\\Me\\project\\file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toMatch(/^\/[cC]:/);
      expect(result.path).toContain('Users');
    });

    it('should convert Windows path with forward slashes', () => {
      const result = toUri('C:/Users/Me/project/file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toMatch(/^\/[cC]:/);
    });

    it('should handle Windows UNC paths', () => {
      const result = toUri('\\\\server\\share\\file.txt');

      expect(result.scheme).toBe('file');
      // UNC paths should be preserved
      expect(result.path).toContain('server');
    });

    it('should handle Windows path with spaces', () => {
      const result = toUri('C:\\Users\\My Name\\project\\file name.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toContain('My Name');
    });

    it('should distinguish Windows drive letter from URI scheme', () => {
      // C:\ should be treated as file path, not as scheme "C"
      const result = toUri('C:\\project\\file.txt');

      expect(result.scheme).toBe('file');
      expect(result.scheme).not.toBe('C');
    });

    it('should distinguish D: drive from URI scheme', () => {
      const result = toUri('D:\\data\\file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toMatch(/^\/[dD]:/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = toUri('');

      expect(result.scheme).toBe('file');
    });

    it('should handle single character (not a drive letter)', () => {
      const result = toUri('a');

      expect(result.scheme).toBe('file');
    });

    it('should handle path with only dots', () => {
      const result = toUri('./file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toContain('file.txt');
    });

    it('should handle path starting with tilde', () => {
      const result = toUri('~/project/file.txt');

      expect(result.scheme).toBe('file');
      expect(result.path).toContain('project/file.txt');
    });

    it('should not confuse single-char scheme with Windows drive', () => {
      // This is ambiguous but should favor Windows drive interpretation
      const result = toUri('x:/path');

      // Should be treated as Windows path, not scheme "x"
      expect(result.scheme).toBe('file');
    });
  });

  describe('scheme detection edge cases', () => {
    it('should recognize scheme with minimum length (2 chars)', () => {
      const result = toUri('ab:/path/file.txt');

      expect(result.scheme).toBe('ab');
      expect(result.path).toBe('/path/file.txt');
    });

    it('should handle scheme with numbers', () => {
      const result = toUri('vscode123:/path');

      expect(result.scheme).toBe('vscode123');
    });

    it('should handle scheme with underscore', () => {
      const result = toUri('my_scheme:/path');

      expect(result.scheme).toBe('my_scheme');
    });

    it('should handle multiple colons in path (only first matters)', () => {
      const result = toUri('memfs:/path:with:colons/file.txt');

      expect(result.scheme).toBe('memfs');
      expect(result.path).toContain(':with:colons');
    });
  });

  describe('round-trip conversions', () => {
    it('should round-trip memfs URI through toString()', () => {
      const original = 'memfs:/MyProject/force-app/main/default/classes/MyClass.cls';
      const uri = toUri(original);
      const result = toUri(uri.toString());

      expect(result.scheme).toBe('memfs');
      expect(result.path).toBe('/MyProject/force-app/main/default/classes/MyClass.cls');
      expect(result.toString()).toBe(original);
    });

    it('should round-trip file URI through toString()', () => {
      const original = 'file:///users/me/project/file.txt';
      const uri = toUri(original);
      const result = toUri(uri.toString());

      expect(result.scheme).toBe('file');
      expect(result.toString()).toBe(original);
    });

    it('should handle URI from Utils.joinPath result', () => {
      const baseUri = URI.parse('memfs:/MyProject');
      const joinedUri = Utils.joinPath(baseUri, 'force-app', 'classes', 'MyClass.cls');
      const result = toUri(joinedUri.toString());

      expect(result.scheme).toBe('memfs');
      expect(result.path).toBe('/MyProject/force-app/classes/MyClass.cls');
    });
  });
});

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { getBaseClientOptions } from '../../../src/languageClient/clientOptions';

jest.mock('vscode');

describe('clientOptions', () => {
  describe('getBaseClientOptions', () => {
    it('should configure file system watcher for directory deletions with correct flags', () => {
      const mockWatcher = {
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        onDidDelete: jest.fn(),
        dispose: jest.fn()
      } as unknown as vscode.FileSystemWatcher;

      const createFileSystemWatcherSpy = jest
        .spyOn(vscode.workspace, 'createFileSystemWatcher')
        .mockReturnValue(mockWatcher);

      const options = getBaseClientOptions({
        workspaceType: 'SFDX',
        sfdxTypingsDir: '/path/to/typings'
      });

      // Verify that fileEvents are configured
      expect(options.synchronize?.fileEvents).toBeDefined();
      expect(Array.isArray(options.synchronize?.fileEvents)).toBe(true);

      // Find the directory watcher call - it should be the last one with pattern '**/'
      const directoryCalls = createFileSystemWatcherSpy.mock.calls.filter(call => call[0] === '**/');
      expect(directoryCalls).toHaveLength(1);

      // Verify the watcher flags for directory deletion monitoring
      // createFileSystemWatcher(pattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents)
      const [pattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents] = directoryCalls[0];
      expect(pattern).toBe('**/');
      expect(ignoreCreateEvents).toBe(false); // Watch for directory creation
      expect(ignoreChangeEvents).toBe(true); // Ignore directory changes
      expect(ignoreDeleteEvents).toBe(false); // Watch for directory deletion

      createFileSystemWatcherSpy.mockRestore();
    });

    it('should configure multiple file system watchers including directory watcher', () => {
      const mockWatcher = {
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        onDidDelete: jest.fn(),
        dispose: jest.fn()
      } as unknown as vscode.FileSystemWatcher;

      const createFileSystemWatcherSpy = jest
        .spyOn(vscode.workspace, 'createFileSystemWatcher')
        .mockReturnValue(mockWatcher);

      const options = getBaseClientOptions({
        workspaceType: 'SFDX',
        sfdxTypingsDir: '/path/to/typings'
      });

      // Verify fileEvents array is populated
      const fileEvents = options.synchronize?.fileEvents;
      expect(fileEvents).toBeDefined();
      expect(Array.isArray(fileEvents)).toBe(true);

      // Should have multiple watchers (resources, labels, lwc files, etc., plus directory watcher)
      expect(createFileSystemWatcherSpy.mock.calls.length).toBeGreaterThan(5);

      // Verify specific patterns are watched
      const patterns = createFileSystemWatcherSpy.mock.calls.map(call => call[0]);
      expect(patterns).toContain('**/*.resource');
      expect(patterns).toContain('**/labels/CustomLabels.labels-meta.xml');
      expect(patterns).toContain('**/lwc/*/*.js');
      expect(patterns).toContain('**/'); // Directory watcher

      createFileSystemWatcherSpy.mockRestore();
    });
  });
});

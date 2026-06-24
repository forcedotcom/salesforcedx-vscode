/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { taskService } from '../../../../src/testSupport/testRunner/taskService';

describe('TaskService', () => {
  describe('createTask with presentation override', () => {
    it('should use default presentation when no override is provided', () => {
      const task = taskService.createTask('test-task-id', 'Test Task', vscode.TaskScope.Workspace, 'npm', ['test']);

      // Access the internal task to check presentation options
      const internalTask = (task as any).task as vscode.Task;
      expect(internalTask.presentationOptions).toEqual({
        reveal: vscode.TaskRevealKind.Never,
        focus: false,
        echo: false,
        panel: vscode.TaskPanelKind.Shared,
        clear: true,
        showReuseMessage: false
      });
    });

    it('should merge presentation override with defaults', () => {
      const task = taskService.createTask('test-task-id', 'Test Task', vscode.TaskScope.Workspace, 'npm', ['test'], {
        panel: vscode.TaskPanelKind.Dedicated
      });

      // Access the internal task to check presentation options
      const internalTask = (task as any).task as vscode.Task;
      expect(internalTask.presentationOptions).toEqual({
        reveal: vscode.TaskRevealKind.Never,
        focus: false,
        echo: false,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
        showReuseMessage: false
      });
    });

    it('should merge multiple presentation override properties', () => {
      const task = taskService.createTask('test-task-id', 'Test Task', vscode.TaskScope.Workspace, 'npm', ['test'], {
        panel: vscode.TaskPanelKind.Dedicated,
        reveal: vscode.TaskRevealKind.Silent
      });

      // Access the internal task to check presentation options
      const internalTask = (task as any).task as vscode.Task;
      expect(internalTask.presentationOptions).toEqual({
        reveal: vscode.TaskRevealKind.Silent,
        focus: false,
        echo: false,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
        showReuseMessage: false
      });
    });
  });
});

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { taskService } from '../../../../src/testSupport/testRunner/taskService';

describe('TaskService', () => {
  describe('createTask', () => {
    it('creates a task with a hidden, shared, reused terminal presentation', () => {
      const task = taskService.createTask('test-task-id', 'Test Task', vscode.TaskScope.Workspace, 'npm', ['test']);

      // Access the internal task to check presentation options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
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
  });
});

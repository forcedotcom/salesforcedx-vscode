/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Task, taskViewService } from '../statuses';

export const taskStop = (task: Task): void => {
  if (task instanceof Task) {
    // See https://github.com/Microsoft/vscode-docs/blob/master/docs/extensionAPI/extension-points.md#contributesmenus
    // For best case inference efforts on what to pass in
    taskViewService.terminateTask(task);
  } else {
    taskViewService.terminateTask();
  }
};

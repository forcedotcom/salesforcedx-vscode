/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  CANCEL_EXECUTION_COMMAND,
  cancelCommandExecution,
  CancellableStatusBar
} from './statusBar';
import { TaskViewService } from './taskView';
export { TaskViewService } from './taskView';
export const taskViewService = TaskViewService.getInstance();
export { Task } from './taskView';

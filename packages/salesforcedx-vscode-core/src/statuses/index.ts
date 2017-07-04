export {
  CANCEL_EXECUTION_COMMAND,
  cancelCommandExecution,
  CancellableStatusBar
} from './statusBar';
import { TaskViewService } from './taskView';
export const taskViewService = TaskViewService.getInstance();
export { Task } from './taskView';

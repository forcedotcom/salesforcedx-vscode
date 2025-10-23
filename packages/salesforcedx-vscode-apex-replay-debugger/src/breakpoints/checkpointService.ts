/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// TODO: clean up the types for all of this
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  breakpointUtil,
  CHECKPOINT,
  CHECKPOINTS_LOCK_STRING,
  MAX_ALLOWED_CHECKPOINTS
} from '@salesforce/salesforcedx-apex-replay-debugger';
import { code2ProtocolConverter, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { URI } from 'vscode-uri';
import { clearCheckpoints, createCheckpointsInOrg } from '../commands/orgCheckpoints';
import { nls } from '../messages';
import { getActiveSalesforceCoreExtension } from '../utils/extensionApis';
import { writeToDebuggerMessageWindow, VSCodeWindowTypeEnum } from './debuggerMessageWindow';
import { retrieveLineBreakpointInfo } from './retrieve';

// below dependencies must be required for bundling to work properly
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncLock = require('async-lock');

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';

// These are the action script types for the ApexExecutionOverlayAction.
export type ApexExecutionOverlayAction = {
  ActionScript: string;
  ActionScriptType: 'None' | 'SOQL' | 'Apex';
  ExecutableEntityName: string | undefined;
  IsDumpingHeap: boolean;
  Iteration: number;
  Line: number;
};

class CheckpointService implements TreeDataProvider<BaseNode> {
  private checkpoints: CheckpointNode[];
  private _onDidChangeTreeData: EventEmitter<BaseNode | undefined> = new EventEmitter<BaseNode | undefined>();

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> = this._onDidChangeTreeData.event;

  constructor() {
    this.checkpoints = [];
  }

  public fireTreeChangedEvent() {
    this._onDidChangeTreeData.fire(undefined);
  }

  public getTreeItem(element: BaseNode): TreeItem {
    return element;
  }

  public getChildren(element?: BaseNode): BaseNode[] | CheckpointNode[] {
    if (!element) {
      return this.checkpoints;
    }

    return element.getChildren();
  }

  public hasFiveOrLessActiveCheckpoints(): boolean {
    const numEnabledCheckpoints = getEnabledCheckpointCount(this);
    if (numEnabledCheckpoints > MAX_ALLOWED_CHECKPOINTS) {
      const errorMessage = nls.localize('up_to_five_checkpoints', numEnabledCheckpoints);
      writeToDebuggerMessageWindow(errorMessage, true, VSCodeWindowTypeEnum.Error);
    }
    return true;
  }

  public hasOneOrMoreActiveCheckpoints(): boolean {
    const numEnabledCheckpoints = getEnabledCheckpointCount(this);
    if (numEnabledCheckpoints === 0) {
      const errorMessage = nls.localize('no_enabled_checkpoints');
      writeToDebuggerMessageWindow(errorMessage, true, VSCodeWindowTypeEnum.Warning);
    }
    return true;
  }

  public createCheckpointNode(
    breakpointIdInput: string,
    enabledInput: boolean,
    uriInput: string,
    sourceFileInput: string,
    checkpointOverlayAction: ApexExecutionOverlayAction
  ): CheckpointNode {
    const cpNode = new CheckpointNode(
      breakpointIdInput,
      enabledInput,
      uriInput,
      sourceFileInput,
      checkpointOverlayAction
    );
    this.checkpoints.push(cpNode);
    this.fireTreeChangedEvent();
    return cpNode;
  }

  public returnCheckpointNodeIfAlreadyExists(breakpointIdInput: string): CheckpointNode | undefined {
    return this.checkpoints.find(cp => cp.breakpointId === breakpointIdInput);
  }

  public deleteCheckpointNodeIfExists(breakpointIdInput: string): void {
    const cpNode = this.returnCheckpointNodeIfAlreadyExists(breakpointIdInput);
    if (cpNode) {
      const index = this.checkpoints.indexOf(cpNode, 0);
      if (index > -1) {
        this.checkpoints.splice(index, 1);
        this.fireTreeChangedEvent();
      }
    }
  }
}

export const checkpointService = new CheckpointService();

// The order of operations here should be to
// 1. Get the source/line information
// 2. Validate the existing checkpoint information
//    a. validate there are only 5 active checkpoints
//    b. validate that the active checkpoint information is correct
//    c. set the typeRef on each checkpoint (requires the source/line information)
// 3. Remove any existing checkpoints
// 4. Create the new checkpoints
export const createCheckpoints = async (): Promise<boolean> => {
  // In-spite of waiting for the lock, we still want subsequent calls to immediately return
  // from this if checkpoints are already being created instead of stacking them up.
  if (!creatingCheckpoints) {
    creatingCheckpoints = true;
  } else {
    return false;
  }

  let updateError = false;
  // The status message isn't changing, call to localize it once and use the localized string in the
  // progress report.
  const localizedProgressMessage = nls.localize('sf_update_checkpoints_in_org');
  // Wrap everything in a try/finally to ensure creatingCheckpoints gets set to false
  try {
    // The lock is necessary here to prevent the user from deleting the underlying breakpoint
    // attached to the checkpoint while they're being uploaded into the org.
    await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
      writeToDebuggerMessageWindow(`${nls.localize('long_command_start')} ${localizedProgressMessage}`);
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: localizedProgressMessage,
          cancellable: false
        },

        async (progress, _token) => {
          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_org_info')}`
          );
          progress.report({
            increment: 0,
            message: localizedProgressMessage
          });

          const coreExtension = await getActiveSalesforceCoreExtension();
          const conn = await coreExtension.services.WorkspaceContext.getInstance().getConnection();

          if (!conn) {
            updateError = true;
            return false;
          }

          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_source_line_info')}`
          );
          progress.report({
            increment: 20,
            message: localizedProgressMessage
          });
          const sourceLineInfoRetrieved: boolean = await retrieveLineBreakpointInfo();
          // If we didn't get the source line information that'll be reported at that time, just return
          if (!sourceLineInfoRetrieved) {
            updateError = true;
            return false;
          }

          // There can be a max of five active checkpoints
          if (!checkpointService.hasFiveOrLessActiveCheckpoints()) {
            updateError = true;
            return false;
          }

          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_setting_typeref')}`
          );
          progress.report({
            increment: 50,
            message: localizedProgressMessage
          });
          // For the active checkpoints set the typeRefs using the source/line info
          if (!setTypeRefsForEnabledCheckpoints()) {
            updateError = true;
            return false;
          }

          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_clearing_existing_checkpoints')}`
          );
          progress.report({
            increment: 50,
            message: localizedProgressMessage
          });
          // remove any existing checkpoints on the server
          try {
            await clearCheckpoints(conn);
          } catch (e) {
            writeToDebuggerMessageWindow(
              `Error deleting checkpoints from the org: ${JSON.stringify(e)}`,
              true,
              VSCodeWindowTypeEnum.Error
            );
            return false;
          }

          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_uploading_checkpoints')}`
          );
          progress.report({
            increment: 70,
            message: localizedProgressMessage
          });
          try {
            await createCheckpointsInOrg(conn)(
              (checkpointService.getChildren() as CheckpointNode[])
                .filter(cpNode => cpNode.isCheckpointEnabled())
                .map(cpNode => cpNode.checkpointOverlayAction)
            );
          } catch (e) {
            writeToDebuggerMessageWindow(JSON.stringify(e), true, VSCodeWindowTypeEnum.Error);
            updateError = true;
            return false;
          }

          progress.report({
            increment: 100,
            message: localizedProgressMessage
          });
          writeToDebuggerMessageWindow(
            `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_processing_complete_success')}`
          );
        }
      );
    });
  } finally {
    writeToDebuggerMessageWindow(`${nls.localize('long_command_end')} ${localizedProgressMessage}`);
    let errorMsg = '';
    if (updateError) {
      errorMsg = nls.localize('checkpoint_upload_error_wrap_up_message', nls.localize('sf_update_checkpoints_in_org'));
      writeToDebuggerMessageWindow(errorMsg, true, VSCodeWindowTypeEnum.Error);
    }
    // Send checkpoint event using shared telemetry service
    TelemetryService.getInstance().sendEventData('apexReplayDebugger.checkpoint', {
      errorMessage: errorMsg
    });
    creatingCheckpoints = false;
  }
  if (updateError) {
    return false;
  }
  return true;
};

class BaseNode extends TreeItem {
  public getChildren(): BaseNode[] {
    return [];
  }
}

const createChildNodes = (action: ApexExecutionOverlayAction): [BaseNode, BaseNode, BaseNode] => [
  new BaseNode(EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE + action.ActionScriptType),
  new BaseNode(EDITABLE_FIELD_LABEL_ACTION_SCRIPT + action.ActionScript),
  new BaseNode(EDITABLE_FIELD_LABEL_ITERATIONS + action.Iteration)
];
export class CheckpointNode extends BaseNode {
  public readonly breakpointId: string;
  private children: BaseNode[] = [];
  public checkpointOverlayAction: ApexExecutionOverlayAction;
  private uri: string;
  private enabled: boolean;
  constructor(
    breakpointIdInput: string,
    enabledInput: boolean,
    uriInput: string,
    sourceFileInput: string,
    checkpointOverlayActionInput: ApexExecutionOverlayAction
  ) {
    super(`${sourceFileInput}:${checkpointOverlayActionInput.Line}`, TreeItemCollapsibleState.Expanded);
    this.uri = uriInput;
    this.breakpointId = breakpointIdInput;
    this.enabled = enabledInput;
    this.checkpointOverlayAction = checkpointOverlayActionInput;
    this.children = createChildNodes(checkpointOverlayActionInput);
  }

  public isCheckpointEnabled(): boolean {
    return this.enabled;
  }

  public getCheckpointLineNumber(): number {
    return this.checkpointOverlayAction.Line;
  }

  public setCheckpointTypeRef(typeRef: string | undefined): void {
    this.checkpointOverlayAction.ExecutableEntityName = typeRef;
  }

  public updateCheckpoint(
    enabledInput: boolean,
    uriInput: string,
    sourceFileInput: string,
    checkpointOverlayActionInput: ApexExecutionOverlayAction
  ): void {
    // At this point we've got no idea what really changed, update
    // everything.
    this.enabled = enabledInput;
    this.uri = uriInput;
    this.checkpointOverlayAction.Line = checkpointOverlayActionInput.Line;
    this.checkpointOverlayAction.IsDumpingHeap = checkpointOverlayActionInput.IsDumpingHeap;
    this.children = createChildNodes(checkpointOverlayActionInput);
    this.label = `${sourceFileInput}:${checkpointOverlayActionInput.Line}`;
    checkpointService.fireTreeChangedEvent();
  }

  public getCheckpointUri(): string {
    return this.uri;
  }

  public getChildren(): BaseNode[] {
    return this.children;
  }
}

// The AsyncLock is necessary to prevent the user from deleting the underlying breakpoints
// associated with the checkpoints while checkpoints are being uploaded to the server.
const lock = new AsyncLock();

// This is the function registered for vscode.debug.onDidChangeBreakpoints. This
// particular event fires breakpoint events without an active debug session which
// allows us to manipulate checkpoints prior to the debug session.

export const processBreakpointChangedForCheckpoints = async (
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): Promise<void> => {
  for (const bp of breakpointsChangedEvent.removed) {
    if (bp.condition?.toLowerCase().includes(CHECKPOINT)) {
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        const breakpointId = bp.id;
        checkpointService.deleteCheckpointNodeIfExists(breakpointId);
      });
    }
  }

  for (const bp of breakpointsChangedEvent.changed) {
    if (bp.condition?.toLowerCase().includes(CHECKPOINT) && bp instanceof vscode.SourceBreakpoint) {
      const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);
      const uri = code2ProtocolConverter(bp.location.uri);
      const theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(bp.id);
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        // If the node exists then update it
        if (theNode) {
          theNode.updateCheckpoint(bp.enabled, uri, filename, checkpointOverlayAction);
        } else {
          // else if the node didn't exist then create it
          checkpointService.createCheckpointNode(bp.id, bp.enabled, uri, filename, checkpointOverlayAction);
        }
      });
    } else {
      // The breakpoint is no longer a SourceBreakpoint or is no longer a checkpoint. Call to delete it if it exists
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        checkpointService.deleteCheckpointNodeIfExists(bp.id);
      });
    }
  }

  for (const bp of breakpointsChangedEvent.added) {
    if (bp.condition?.toLowerCase().includes(CHECKPOINT) && bp instanceof vscode.SourceBreakpoint) {
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);
        const uri = code2ProtocolConverter(bp.location.uri);
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        checkpointService.createCheckpointNode(bp.id, bp.enabled, uri, filename, checkpointOverlayAction);
      });
    }
  }
};

const parseCheckpointInfoFromBreakpoint = (breakpoint: vscode.SourceBreakpoint): ApexExecutionOverlayAction => ({
  ...(breakpoint.logMessage && breakpoint.logMessage.length > 0
    ? // If the log message is defined and isn't empty then set the action script
      // based upon whether or not the string starts with SELECT
      {
        ActionScript: breakpoint.logMessage,
        ActionScriptType: breakpoint.logMessage.startsWith('SELECT') ? 'SOQL' : 'Apex'
      }
    : { ActionScript: '', ActionScriptType: 'None' }),
  ExecutableEntityName: undefined,
  IsDumpingHeap: true,
  // if the hit condition is a number then use it
  Iteration: breakpoint.hitCondition && /\d/.test(breakpoint.hitCondition) ? Number(breakpoint.hitCondition) : 1,
  Line: breakpoint.location.range.start.line + 1 // need to add 1 since the lines are 0 based
});

const setTypeRefsForEnabledCheckpoints = (): boolean =>
  (checkpointService.getChildren() as CheckpointNode[])
    .filter(cpNode => cpNode.isCheckpointEnabled())
    .map(cpNode => {
      const typeRef = breakpointUtil.getTopLevelTyperefForUri(cpNode.getCheckpointUri());
      cpNode.setCheckpointTypeRef(typeRef);
      return cpNode;
    })
    .every(n => canSetLineBreakpointForCheckpoint(n));

const canSetLineBreakpointForCheckpoint = (cpNode: CheckpointNode): boolean => {
  const checkpointUri = cpNode.getCheckpointUri();
  const checkpointLine = cpNode.getCheckpointLineNumber();
  const canSet = breakpointUtil.canSetLineBreakpoint(checkpointUri, checkpointLine);
  if (!canSet) {
    const errorMessage = nls.localize('checkpoints_can_only_be_on_valid_apex_source', checkpointUri, checkpointLine);
    writeToDebuggerMessageWindow(errorMessage, true, VSCodeWindowTypeEnum.Error);
  }
  return canSet;
};

// The order of operations here should be to
// 1. Get the source/line information
// 2. Validate the existing checkpoint information
//    a. validate there are only 5 active checkpoints
//    b. validate that the active checkpoint information is correct
//    c. set the typeRef on each checkpoint (requires the source/line information)
// 3. Remove any existing checkpoints
// 4. Create the new checkpoints
let creatingCheckpoints = false;

// A couple of important notes about this command's processing
// 1. There is no way to invoke a breakpoint change through vscode.debug
//    there is only add/delete.
// 2. A changed breakpoint has to first be deleted and then re-added.
// 3. Add/Delete breakpoints will go through the processBreakpointChangedForCheckpoints
//    event that's registered. That'll take care of all the checkpoint specific processing.
// 4. When a breakpoint already exists and it is being converted to a checkpoint, only
//    the hitCondition (which is really the hit count) is kept. The other pieces of information
//    that may be on the checkpoint are the condition (which needs to get set to Checkpoint)
//    and the logMessage. The logMessage is scrapped since this ends up being taken over by
//    checkpoints for user input SOQL or Apex.
export const sfToggleCheckpoint = async () => {
  if (creatingCheckpoints) {
    writeToDebuggerMessageWindow(nls.localize('checkpoint_upload_in_progress'), true, VSCodeWindowTypeEnum.Warning);
    return;
  }
  const bpAdd: vscode.Breakpoint[] = [];
  const bpRemove: vscode.Breakpoint[] = [];
  const uri = checkpointUtils.fetchActiveEditorUri();
  const lineNumber = checkpointUtils.fetchActiveSelectionLineNumber();

  if (uri && lineNumber !== undefined) {
    // While selection could be passed directly into the location instead of creating
    // a new range, it ends up creating a weird secondary icon on the line with the
    // breakpoint which is due to the start/end characters being non-zero.
    let hitCondition;
    const bp = fetchExistingBreakpointForUriAndLineNumber(uri, lineNumber);
    // There's already a breakpoint at this line
    if (bp) {
      // If the breakpoint is a checkpoint then remove it and return
      if (bp.condition?.toLowerCase().includes(CHECKPOINT)) {
        bpRemove.push(bp);
        return await vscode.debug.removeBreakpoints(bpRemove);
      } else {
        // The only thing from the old breakpoint that is applicable to keep is the hitCondition
        // which maps to iterations. Squirrel away hitCondition, remove the breakpoint and let
        // processing go into the code to create a new breakpoint with the checkpoint condition
        hitCondition = bp.hitCondition;
        bpRemove.push(bp);
        await vscode.debug.removeBreakpoints(bpRemove);
      }
    }

    // Create a new checkpoint/breakpoint from scratch.
    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
    const location = new vscode.Location(uri, range);
    const newBreakpoint = new vscode.SourceBreakpoint(location, true, CHECKPOINT, hitCondition);
    bpAdd.push(newBreakpoint);
    await vscode.debug.addBreakpoints(bpAdd);
  }
};

const fetchActiveEditorUri = (): URI | undefined => vscode.window.activeTextEditor?.document.uri;

const fetchActiveSelectionLineNumber = (): number | undefined => vscode.window.activeTextEditor?.selection?.start.line;

const fetchExistingBreakpointForUriAndLineNumber = (uriInput: URI, lineInput: number): vscode.Breakpoint | undefined =>
  vscode.debug.breakpoints.find(
    bp =>
      bp instanceof vscode.SourceBreakpoint &&
      bp.location.uri.toString() === uriInput.toString() &&
      bp.location.range.start.line === lineInput
  );

const checkpointUtils = {
  fetchActiveEditorUri,
  fetchActiveSelectionLineNumber
};

const getEnabledCheckpointCount = (service: CheckpointService): number =>
  (service.getChildren() as CheckpointNode[]).filter(cpNode => cpNode.isCheckpointEnabled()).length;

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ForceOrgDisplay,
  OrgInfo
} from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/breakpoints';
import {
  ActionScriptEnum,
  OrgInfoError
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/commands';
import {
  CHECKPOINT,
  CHECKPOINTS_LOCK_STRING,
  FIELD_INTEGRITY_EXCEPTION,
  MAX_ALLOWED_CHECKPOINTS,
  OVERLAY_ACTION_DELETE_URL
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import * as AsyncLock from 'async-lock';
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode';
import * as vscode from 'vscode';
import {
  ApexExecutionOverlayActionCommand,
  ApexExecutionOverlayFailureResult,
  ApexExecutionOverlaySuccessResult
} from '../commands/apexExecutionOverlayActionCommand';
import {
  BatchDeleteExistingOverlayActionCommand,
  BatchDeleteResponse,
  BatchRequest,
  BatchRequests
} from '../commands/batchDeleteExistingOverlayActionsCommand';
import {
  ApexExecutionOverlayActionRecord,
  QueryExistingOverlayActionIdsCommand,
  QueryOverlayActionIdsSuccessResult
} from '../commands/queryExistingOverlayActionIdsCommand';
import {
  retrieveLineBreakpointInfo,
  VSCodeWindowTypeEnum,
  writeToDebuggerOutputWindow
} from '../index';
import { nls } from '../messages';

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';

// These are the action script types for the ApexExecutionOverlayAction.
export interface ApexExecutionOverlayAction {
  ActionScript: string;
  ActionScriptType: ActionScriptEnum;
  ExecutableEntityName: string | undefined;
  IsDumpingHeap: boolean;
  Iteration: number;
  Line: number;
}

export class CheckpointService implements TreeDataProvider<BaseNode> {
  private static instance: CheckpointService;
  private checkpoints: CheckpointNode[];
  private _onDidChangeTreeData: EventEmitter<
    BaseNode | undefined
  > = new EventEmitter<BaseNode | undefined>();
  private myRequestService: RequestService;
  private orgInfo: OrgInfo;
  private sfdxProject: string | null = null;

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> = this
    ._onDidChangeTreeData.event;

  public constructor() {
    this.checkpoints = [];
    this.myRequestService = new RequestService();
  }

  public fireTreeChangedEvent() {
    this._onDidChangeTreeData.fire();
  }

  public async retrieveOrgInfo(): Promise<boolean> {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      this.sfdxProject = vscode.workspace.workspaceFolders[0].uri.fsPath;
      try {
        this.orgInfo = await new ForceOrgDisplay().getOrgInfo(this.sfdxProject);
      } catch (error) {
        const result = JSON.parse(error) as OrgInfoError;
        const errorMessage = `${nls.localize(
          'unable_to_retrieve_org_info'
        )} : ${result.message}`;
        writeToDebuggerOutputWindow(
          errorMessage,
          true,
          VSCodeWindowTypeEnum.Error
        );
        return false;
      }
      this.myRequestService.instanceUrl = this.orgInfo.instanceUrl;
      this.myRequestService.accessToken = this.orgInfo.accessToken;
      return true;
    } else {
      const errorMessage = nls.localize('cannot_determine_workspace');
      writeToDebuggerOutputWindow(
        errorMessage,
        true,
        VSCodeWindowTypeEnum.Error
      );
      return false;
    }
  }

  public static getInstance(): CheckpointService {
    if (!CheckpointService.instance) {
      CheckpointService.instance = new CheckpointService();
    }
    return CheckpointService.instance;
  }

  public getTreeItem(element: BaseNode): TreeItem {
    return element;
  }

  public getChildren(element?: BaseNode): BaseNode[] {
    if (!element) {
      return this.checkpoints;
    }

    return element.getChildren();
  }

  public hasFiveOrLessActiveCheckpoints(displayError: boolean): boolean {
    let numEnabledCheckpoints = 0;
    for (const cpNode of this.getChildren() as CheckpointNode[]) {
      if (cpNode.isCheckpointEnabled()) {
        numEnabledCheckpoints++;
      }
    }
    const fiveOrLess = numEnabledCheckpoints <= MAX_ALLOWED_CHECKPOINTS;
    if (!fiveOrLess && displayError) {
      const errorMessage = nls.localize(
        'up_to_five_checkpoints',
        numEnabledCheckpoints
      );
      writeToDebuggerOutputWindow(
        errorMessage,
        true,
        VSCodeWindowTypeEnum.Error
      );
    }
    return fiveOrLess;
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

  public returnCheckpointNodeIfAlreadyExists(
    breakpointIdInput: string
  ): CheckpointNode | undefined {
    for (const cp of this.checkpoints) {
      if (breakpointIdInput === cp.getBreakpointId()) {
        return cp;
      }
    }
    return undefined;
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

  public async executeCreateApexExecutionOverlayActionCommand(
    theNode: CheckpointNode
  ): Promise<boolean> {
    // create the overlay action
    const overlayActionCommand = new ApexExecutionOverlayActionCommand(
      theNode.createJSonStringForOverlayAction()
    );
    let errorString;
    let returnString;
    await this.myRequestService.execute(overlayActionCommand).then(
      value => {
        returnString = value;
      },
      reason => {
        errorString = reason;
      }
    );
    // The resturn string will be the overlay Id and will end up being
    // used if the node is deleted
    if (returnString) {
      const result = JSON.parse(
        returnString
      ) as ApexExecutionOverlaySuccessResult;
      theNode.setActionCommandResultId(result.id);
      return true;
    }
    // Fun fact: the result is an array of 1 item OR the result message can be just a string. In the
    // case where the json string cannot be parsed into an ApexExecutionOverlayFailureResult then it'll
    // be treated as a string and reported to the user.
    if (errorString) {
      try {
        const result = JSON.parse(
          errorString
        ) as ApexExecutionOverlayFailureResult[];
        if (result[0].errorCode === FIELD_INTEGRITY_EXCEPTION) {
          const errorMessage = nls.localize(
            'local_source_is_out_of_sync_with_the_server'
          );
          writeToDebuggerOutputWindow(
            errorMessage,
            true,
            VSCodeWindowTypeEnum.Error
          );
        } else {
          const errorMessage = `${result[0]
            .message}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
          writeToDebuggerOutputWindow(
            errorMessage,
            true,
            VSCodeWindowTypeEnum.Error
          );
        }
      } catch (error) {
        const errorMessage = `${errorString}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
        writeToDebuggerOutputWindow(
          errorMessage,
          true,
          VSCodeWindowTypeEnum.Error
        );
      }
    }
    return false;
  }

  // Make VS Code the source of truth for checkpoints
  public async clearExistingCheckpoints(): Promise<boolean> {
    const sfdxCore = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-core'
    );
    if (sfdxCore && sfdxCore.exports) {
      const userId = await sfdxCore.exports.getUserId(this.sfdxProject);
      if (userId) {
        const queryCommand = new QueryExistingOverlayActionIdsCommand(userId);
        let errorString;
        let returnString;
        await this.myRequestService
          .execute(queryCommand, RestHttpMethodEnum.Get)
          .then(
            value => {
              returnString = value;
            },
            reason => {
              errorString = reason;
            }
          );
        if (returnString) {
          const successResult = JSON.parse(
            returnString
          ) as QueryOverlayActionIdsSuccessResult;
          if (successResult) {
            // If there are things to delete then create the batchRequest
            if (successResult.records.length > 0) {
              const requests: BatchRequest[] = [];
              for (const record of successResult.records) {
                const request: BatchRequest = {
                  method: RestHttpMethodEnum.Delete,
                  url: OVERLAY_ACTION_DELETE_URL + record.Id
                };
                requests.push(request);
              }
              const batchRequests: BatchRequests = {
                batchRequests: requests
              };
              const batchDeleteCommand = new BatchDeleteExistingOverlayActionCommand(
                batchRequests
              );

              let deleteError;
              let deleteResult;
              await this.myRequestService
                .execute(batchDeleteCommand, RestHttpMethodEnum.Post)
                .then(
                  value => {
                    deleteResult = value;
                  },
                  reason => {
                    deleteError = reason;
                  }
                );
              // Parse the result
              if (deleteResult) {
                const result = JSON.parse(deleteResult) as BatchDeleteResponse;
                if (result.hasErrors) {
                  const errorMessage = nls.localize(
                    'cannot_delete_existing_checkpoint'
                  );
                  writeToDebuggerOutputWindow(
                    errorMessage,
                    true,
                    VSCodeWindowTypeEnum.Error
                  );
                } else {
                  // no errors, return true
                  return true;
                }
              }
              // At this point a deleteError really means there was an error talking to the
              // server. Actual failures from an individual command other issues are batched
              // up in the result.
              if (deleteError) {
                const errorMessage = `${nls.localize(
                  'cannot_delete_existing_checkpoint'
                )} : ${deleteError}`;
                writeToDebuggerOutputWindow(
                  errorMessage,
                  true,
                  VSCodeWindowTypeEnum.Error
                );
                return false;
              }
            }
            // no records to delete, just return true
            return true;
          } else {
            const errorMessage = nls.localize(
              'unable_to_parse_checkpoint_query_result'
            );
            writeToDebuggerOutputWindow(
              errorMessage,
              true,
              VSCodeWindowTypeEnum.Error
            );
            return false;
          }
        } else {
          const errorMessage = `${nls.localize(
            'unable_to_query_for_existing_checkpoints'
          )} Error: ${errorString}`;
          writeToDebuggerOutputWindow(
            errorMessage,
            true,
            VSCodeWindowTypeEnum.Error
          );
          return false;
        }
      } else {
        const errorMessage = nls.localize(
          'unable_to_retrieve_active_user_for_sfdx_project'
        );
        writeToDebuggerOutputWindow(
          errorMessage,
          true,
          VSCodeWindowTypeEnum.Error
        );
        return false;
      }
    } else {
      const errorMessage = nls.localize('unable_to_load_vscode_core_extension');
      writeToDebuggerOutputWindow(
        errorMessage,
        true,
        VSCodeWindowTypeEnum.Error
      );
      return false;
    }
  }
}

export const checkpointService = CheckpointService.getInstance();

export abstract class BaseNode extends TreeItem {
  public abstract getChildren(): BaseNode[];
}

export class CheckpointNode extends BaseNode {
  private readonly children: CheckpointInfoNode[] = [];
  private readonly breakpointId: string;
  private readonly checkpointOverlayAction: ApexExecutionOverlayAction;
  private uri: string;
  private enabled: boolean;
  private actionObjectId: string | undefined;

  constructor(
    breapointIdInput: string,
    enabledInput: boolean,
    uriInput: string,
    sourceFileInput: string,
    checkpointOverlayActionInput: ApexExecutionOverlayAction
  ) {
    super(
      sourceFileInput + ':' + checkpointOverlayActionInput.Line,
      TreeItemCollapsibleState.Expanded
    );
    this.uri = uriInput;
    this.breakpointId = breapointIdInput;
    this.enabled = enabledInput;
    this.checkpointOverlayAction = checkpointOverlayActionInput;
    this.actionObjectId = undefined;

    // Create the items that the user is going to be able to control (Type, Script, Iteration)
    const cpASTNode = new CheckpointInfoActionScriptTypeNode(
      this.checkpointOverlayAction
    );
    this.children.push(cpASTNode);
    const cpScriptNode = new CheckpointInfoActionScriptNode(
      this.checkpointOverlayAction
    );
    this.children.push(cpScriptNode);
    const cpIterationNode = new CheckpointInfoIterationNode(
      this.checkpointOverlayAction
    );
    this.children.push(cpIterationNode);
  }

  public createJSonStringForOverlayAction(): string {
    return JSON.stringify(this.checkpointOverlayAction);
  }

  public getBreakpointId(): string {
    return this.breakpointId;
  }

  public isCheckpointEnabled(): boolean {
    return this.enabled;
  }

  public getCheckpointLineNumber(): number {
    return this.checkpointOverlayAction.Line;
  }

  public getCheckpointTypeRef(): string | undefined {
    return this.checkpointOverlayAction.ExecutableEntityName;
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
    this.checkpointOverlayAction.IsDumpingHeap =
      checkpointOverlayActionInput.IsDumpingHeap;
    // Instead of just refreshing the node's overlay action, these functions
    // need to be called because some of the information is in their label
    // which needs to get updated
    this.updateActionScript(checkpointOverlayActionInput.ActionScript);
    this.updateActionScriptType(checkpointOverlayActionInput.ActionScriptType);
    this.updateIterations(checkpointOverlayActionInput.Iteration);
    this.label = sourceFileInput + ':' + checkpointOverlayActionInput.Line;
    CheckpointService.getInstance().fireTreeChangedEvent();
  }

  private updateActionScript(actionScriptInput: string): void {
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoActionScriptNode) {
        return cpInfoNode.updateActionScript(actionScriptInput);
      }
    }
  }

  private updateActionScriptType(
    actionScriptTypeInput: ActionScriptEnum
  ): void {
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoActionScriptTypeNode) {
        return cpInfoNode.updateActionScriptType(actionScriptTypeInput);
      }
    }
  }

  private updateIterations(iterationInput: number): void {
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoIterationNode) {
        return cpInfoNode.updateIterations(iterationInput);
      }
    }
  }

  public getIteration(): number {
    return this.checkpointOverlayAction.Iteration;
  }

  public getActionScript(): string {
    return this.checkpointOverlayAction.ActionScript;
  }

  public getActionScriptType(): ActionScriptEnum {
    return this.checkpointOverlayAction.ActionScriptType;
  }

  public getCheckpointUri(): string {
    return this.uri;
  }

  public getChildren(): CheckpointInfoNode[] {
    return this.children;
  }

  public getActionCommandResultId(): string | undefined {
    return this.actionObjectId;
  }

  public setActionCommandResultId(actionObjectId: string | undefined) {
    this.actionObjectId = actionObjectId;
  }
}

export class CheckpointInfoNode extends BaseNode {
  public getChildren(): BaseNode[] {
    return [];
  }
}

// Remove the tags when the nodes using the checkpointOverlayAction become editable.
export class CheckpointInfoActionScriptNode extends CheckpointInfoNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(
      EDITABLE_FIELD_LABEL_ACTION_SCRIPT + cpOverlayActionInput.ActionScript
    );
    this.checkpointOverlayAction = cpOverlayActionInput;
  }
  public updateActionScript(actionScriptInput: string) {
    this.checkpointOverlayAction.ActionScript = actionScriptInput;
    this.label = EDITABLE_FIELD_LABEL_ACTION_SCRIPT + actionScriptInput;
  }
  public getChildren(): BaseNode[] {
    return [];
  }
}

export class CheckpointInfoActionScriptTypeNode extends CheckpointInfoNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(
      EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE +
        cpOverlayActionInput.ActionScriptType
    );
    this.checkpointOverlayAction = cpOverlayActionInput;
  }
  public updateActionScriptType(actionScriptTypeInput: ActionScriptEnum) {
    this.checkpointOverlayAction.ActionScriptType = actionScriptTypeInput;
    this.label =
      EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE + actionScriptTypeInput;
  }
  public getChildren(): BaseNode[] {
    return [];
  }
}

export class CheckpointInfoIterationNode extends CheckpointInfoNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(EDITABLE_FIELD_LABEL_ITERATIONS + cpOverlayActionInput.Iteration);
    this.checkpointOverlayAction = cpOverlayActionInput;
  }

  public updateIterations(iterationInput: number) {
    this.checkpointOverlayAction.Iteration = iterationInput;
    this.label = EDITABLE_FIELD_LABEL_ITERATIONS + iterationInput;
  }
  public getChildren(): BaseNode[] {
    return [];
  }
}

// The AsyncLock is necessary to prevent the user from deleting the underlying breakpoints
// associated with the checkpoints while checkpoints are being uploaded to the server.
const lock = new AsyncLock();

// This is the function registered for vscode.debug.onDidChangeBreakpoints. This
// particular event fires breakpoint events without an active debug session which
// allows us to manipulate checkpoints prior to the debug session.
export async function processBreakpointChangedForCheckpoints(
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): Promise<void> {
  for (const bp of breakpointsChangedEvent.removed) {
    if (bp.condition && bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0) {
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        const breakpointId = (bp as any)._id;
        checkpointService.deleteCheckpointNodeIfExists(breakpointId);
      });
    }
  }

  for (const bp of breakpointsChangedEvent.changed) {
    const breakpointId = (bp as any)._id;
    if (
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0 &&
      bp instanceof vscode.SourceBreakpoint
    ) {
      const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);
      const uri = code2ProtocolConverter(bp.location.uri);
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(
        breakpointId
      );
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        // If the node exists then update it
        if (theNode) {
          theNode.updateCheckpoint(
            bp.enabled,
            uri,
            filename,
            checkpointOverlayAction
          );
        } else {
          // else if the node didn't exist then create it
          checkpointService.createCheckpointNode(
            breakpointId,
            bp.enabled,
            uri,
            filename,
            checkpointOverlayAction
          );
        }
      });
    } else {
      // The breakpoint is no longer a SourceBreakpoint or is no longer a checkpoint. Call to delete it if it exists
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        checkpointService.deleteCheckpointNodeIfExists(breakpointId);
      });
    }
  }

  for (const bp of breakpointsChangedEvent.added) {
    if (
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0 &&
      bp instanceof vscode.SourceBreakpoint
    ) {
      await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
        const breakpointId = (bp as any)._id;
        const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);
        const uri = code2ProtocolConverter(bp.location.uri);
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        checkpointService.createCheckpointNode(
          breakpointId,
          bp.enabled,
          uri,
          filename,
          checkpointOverlayAction
        );
      });
    }
  }
}

export function parseCheckpointInfoFromBreakpoint(
  breakpoint: vscode.SourceBreakpoint
): ApexExecutionOverlayAction {
  // declare the overlayAction with defaults
  const checkpointOverlayAction: ApexExecutionOverlayAction = {
    ActionScript: '',
    ActionScriptType: ActionScriptEnum.None,
    ExecutableEntityName: undefined,
    IsDumpingHeap: true,
    Iteration: 1,
    Line: -1
  };

  checkpointOverlayAction.Line = breakpoint.location.range.start.line + 1; // need to add 1 since the lines are 0 based

  // if the hit condition is a number then use it
  if (breakpoint.hitCondition) {
    if (/\d/.test(breakpoint.hitCondition)) {
      checkpointOverlayAction.Iteration = Number(breakpoint.hitCondition);
    }
  }

  // If the log message is defined and isn't empty then set the action script
  // based upon whether or not the string starts with SELECT
  const logMessage = (breakpoint as any).logMessage as string;
  if (logMessage && logMessage.length > 0) {
    if (logMessage.toLocaleLowerCase().startsWith('select')) {
      checkpointOverlayAction.ActionScriptType = ActionScriptEnum.SOQL;
    } else {
      checkpointOverlayAction.ActionScriptType = ActionScriptEnum.Apex;
    }
    checkpointOverlayAction.ActionScript = logMessage;
  }
  return checkpointOverlayAction;
}

function setTypeRefsForEnabledCheckpoints(): boolean {
  let everythingSet = true;
  for (const cpNode of checkpointService.getChildren() as CheckpointNode[]) {
    if (cpNode.isCheckpointEnabled()) {
      const checkpointUri = cpNode.getCheckpointUri();
      const checkpointLine = cpNode.getCheckpointLineNumber();
      if (!breakpointUtil.canSetLineBreakpoint(checkpointUri, checkpointLine)) {
        const errorMessage = nls.localize(
          'checkpoints_can_only_be_on_valid_apex_source',
          checkpointUri,
          checkpointLine
        );
        writeToDebuggerOutputWindow(
          errorMessage,
          true,
          VSCodeWindowTypeEnum.Error
        );
        everythingSet = false;
      }
      const typeRef = breakpointUtil.getTopLevelTyperefForUri(
        cpNode.getCheckpointUri()
      );
      cpNode.setCheckpointTypeRef(typeRef);
    }
  }
  return everythingSet;
}

// The order of operations here should be to
// 1. Get the source/line information
// 2. Validate the existing checkpoint information
//    a. validate there are only 5 active checkpoints
//    b. validate that the active checkpoint information is correct
//    c. set the typeRef on each checkpoint (requires the source/line information)
// 3. Remove any existing checkpoints
// 4. Create the new checkpoints
let creatingCheckpoints = false;
export async function sfdxCreateCheckpoints() {
  // In-spite of waiting for the lock, we still want subsequent calls to immediately return
  // from this if checkpoints are already being created instead of stacking them up.
  if (!creatingCheckpoints) {
    creatingCheckpoints = true;
  } else {
    return;
  }
  let updateError = false;
  // The status message isn't changing, call to localize it once and use the localized string in the
  // progress report.
  const localizedProgressMessage = nls.localize(
    'sfdx_update_checkpoints_in_org'
  );
  // Wrap everything in a try/finally to ensure creatingCheckpoints gets set to false
  try {
    // The lock is necessary here to prevent the user from deleting the underlying breakpoint
    // attached to the checkpoint while they're being uploaded into the org.
    await lock.acquire(CHECKPOINTS_LOCK_STRING, async () => {
      writeToDebuggerOutputWindow(
        `${nls.localize('long_command_start')} ${localizedProgressMessage}`
      );
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: localizedProgressMessage,
          cancellable: false
        },
        async (progress, token) => {
          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_org_info'
            )}`
          );
          progress.report({ increment: 0, message: localizedProgressMessage });
          const orgInfoRetrieved: boolean = await checkpointService.retrieveOrgInfo();
          if (!orgInfoRetrieved) {
            updateError = true;
            return;
          }

          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_source_line_info'
            )}`
          );
          progress.report({ increment: 20, message: localizedProgressMessage });
          const sourceLineInfoRetrieved: boolean = await retrieveLineBreakpointInfo();
          // If we didn't get the source line information that'll be reported at that time, just return
          if (!sourceLineInfoRetrieved) {
            updateError = true;
            return;
          }

          // There can be a max of five active checkpoints
          if (!checkpointService.hasFiveOrLessActiveCheckpoints(true)) {
            updateError = true;
            return;
          }

          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_setting_typeref'
            )}`
          );
          progress.report({ increment: 50, message: localizedProgressMessage });
          // For the active checkpoints set the typeRefs using the source/line info
          if (!setTypeRefsForEnabledCheckpoints()) {
            updateError = true;
            return;
          }

          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_clearing_existing_checkpoints'
            )}`
          );
          progress.report({ increment: 50, message: localizedProgressMessage });
          // remove any existing checkpoints on the server
          const allRemoved: boolean = await checkpointService.clearExistingCheckpoints();
          if (!allRemoved) {
            updateError = true;
            return;
          }

          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_uploading_checkpoints'
            )}`
          );
          progress.report({ increment: 70, message: localizedProgressMessage });
          // This should probably be batched but it makes dealing with errors kind of a pain
          for (const cpNode of checkpointService.getChildren() as CheckpointNode[]) {
            if (cpNode.isCheckpointEnabled()) {
              if (
                !await checkpointService.executeCreateApexExecutionOverlayActionCommand(
                  cpNode
                )
              ) {
                updateError = true;
              }
            }
          }

          progress.report({
            increment: 100,
            message: localizedProgressMessage
          });
          writeToDebuggerOutputWindow(
            `${localizedProgressMessage}, ${nls.localize(
              'checkpoint_creation_status_processing_complete_success'
            )}`
          );
        }
      );
    });
  } finally {
    writeToDebuggerOutputWindow(
      `${nls.localize('long_command_end')} ${localizedProgressMessage}`
    );
    if (updateError) {
      writeToDebuggerOutputWindow(
        nls.localize(
          'checkpoint_upload_error_wrap_up_message',
          nls.localize('sfdx_update_checkpoints_in_org')
        ),
        true,
        VSCodeWindowTypeEnum.Error
      );
    }
    creatingCheckpoints = false;
  }
}

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
export async function sfdxToggleCheckpoint() {
  if (creatingCheckpoints) {
    writeToDebuggerOutputWindow(
      nls.localize('checkpoint_upload_in_progress'),
      true,
      VSCodeWindowTypeEnum.Warning
    );
    return;
  }
  const bpAdd: vscode.Breakpoint[] = [];
  const bpRemove: vscode.Breakpoint[] = [];
  const uri = exports.fetchActiveEditorUri();
  const lineNumber = exports.fetchActiveSelectionLineNumber();

  if (uri && lineNumber) {
    // While selection could be passed directly into the location instead of creating
    // a new range, it ends up creating a weird secondary icon on the line with the
    // breakpoint which is due to the start/end characters being non-zero.
    let hitCondition;
    const bp = fetchExistingBreakpointForUriAndLineNumber(uri, lineNumber);
    // There's already a breakpoint at this line
    if (bp) {
      // If the breakpoint is a checkpoint then remove it and return
      if (
        bp.condition &&
        bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0
      ) {
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
    const newBreakpoint = new vscode.SourceBreakpoint(
      location,
      true,
      CHECKPOINT,
      hitCondition
    );
    bpAdd.push(newBreakpoint);
    await vscode.debug.addBreakpoints(bpAdd);
  }
  return;
}

// This methods was broken out of sfdxToggleCheckpoint for testing purposes.
function fetchActiveEditorUri(): vscode.Uri | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.document.uri;
  }
}
exports.fetchActiveEditorUri = fetchActiveEditorUri;

// This methods was broken out of sfdxToggleCheckpoint for testing purposes.
function fetchActiveSelectionLineNumber(): number | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.selection) {
    return editor.selection.start.line;
  }
  return undefined;
}
exports.fetchActiveSelectionLineNumber = fetchActiveSelectionLineNumber;

function fetchExistingBreakpointForUriAndLineNumber(
  uriInput: vscode.Uri,
  lineInput: number
): vscode.Breakpoint | undefined {
  for (const bp of vscode.debug.breakpoints) {
    if (bp instanceof vscode.SourceBreakpoint) {
      // Uri comparison doesn't work even if they're contain the same
      // information. toString both URIs
      if (
        bp.location.uri.toString() === uriInput.toString() &&
        bp.location.range.start.line === lineInput
      ) {
        return bp;
      }
    }
  }
  return undefined;
}

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
function code2ProtocolConverter(value: vscode.Uri) {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

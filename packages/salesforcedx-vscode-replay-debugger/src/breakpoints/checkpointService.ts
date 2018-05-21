/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ForceOrgDisplay,
  OrgInfo
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode';
import * as vscode from 'vscode';
import { breakpointUtil } from '../breakpoints';
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
  CHECKPOINT,
  FIELD_INTEGRITY_EXCEPTION,
  MAX_ALLOWED_CHECKPOINTS,
  OVERLAY_ACTION_DELETE_URL
} from '../constants';
import { retrieveLineBreakpointInfo } from '../index';
import { nls } from '../messages';

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';

// These are the action script types for the ApexExecutionOverlayAction.
export enum ActionScriptEnum {
  None = 'None',
  Apex = 'Apex',
  SOQL = 'SOQL'
}
export interface ApexExecutionOverlayAction {
  ActionScript: string;
  ActionScriptType: ActionScriptEnum;
  ExecutableEntityName: string | undefined;
  IsDumpingHeap: boolean;
  Iteration: number;
  Line: number;
}

interface OrgInfoError {
  message: string;
  status: number;
  name: string;
  warnings: string[];
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
        vscode.window.showErrorMessage(
          nls.localize('unable_to_retrieve_org_info') + ': ' + result.message
        );
        return false;
      }
      this.myRequestService.instanceUrl = this.orgInfo.instanceUrl;
      this.myRequestService.accessToken = this.orgInfo.accessToken;
      return true;
    } else {
      vscode.window.showErrorMessage(
        nls.localize('cannot_determine_workspace')
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
      vscode.window.showErrorMessage(
        nls.localize('up_to_five_checkpoints', numEnabledCheckpoints)
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
  ) {
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
      return;
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
          vscode.window.showErrorMessage(
            nls.localize('local_source_is_out_of_sync_with_the_server')
          );
        } else {
          vscode.window.showErrorMessage(
            `${result[0]
              .message}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `${errorString}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`
        );
      }
    }
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
                  // We really need to do something better here. Problem is, what
                  // to do with this? Tell the user to manually delete their stuff?
                  vscode.window.showErrorMessage(
                    nls.localize('cannot_delete_existing_overlay_action')
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
                vscode.window.showErrorMessage(
                  nls.localize('cannot_delete_existing_overlay_action') +
                    ': ' +
                    deleteError
                );
                return false;
              }
            }
            // no records to delete, just return true
            return true;
          } else {
            vscode.window.showErrorMessage(
              nls.localize('unable_to_parse_checkpoint_query_result')
            );
            return false;
          }
        } else {
          vscode.window.showErrorMessage(
            nls.localize('unable_to_query_for_existing_checkpoints') +
              ' Error: ' +
              errorString
          );
          return false;
        }
      } else {
        vscode.window.showErrorMessage(
          nls.localize('unable_to_retrieve_active_user_for_sfdx_project')
        );
        return false;
      }
    } else {
      vscode.window.showErrorMessage(
        nls.localize('unable_to_load_vscode_core_extension')
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

// This is the function registered for vscode.debug.onDidChangeBreakpoints. This
// particular event fires breakpoint events without an active debug session which
// allows us to manipulate checkpoints prior to the debug session.
export async function processBreakpointChangedForCheckpoints(
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): Promise<void> {
  for (const bp of breakpointsChangedEvent.removed) {
    if (bp.condition && bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0) {
      const breakpointId = (bp as any)._id;
      checkpointService.deleteCheckpointNodeIfExists(breakpointId);
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
    } else {
      // The breakpoint is no longer a SourceBreakpoint or is no longer a checkpoint. Call to delete it if it exists
      checkpointService.deleteCheckpointNodeIfExists(breakpointId);
    }
  }

  for (const bp of breakpointsChangedEvent.added) {
    if (
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0 &&
      bp instanceof vscode.SourceBreakpoint
    ) {
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
        vscode.window.showErrorMessage(
          nls.localize(
            'checkpoints_can_only_be_on_valid_apex_source',
            checkpointUri,
            checkpointLine
          )
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
  if (!creatingCheckpoints) {
    creatingCheckpoints = true;
  } else {
    return;
  }
  // Wrap everything in a try/finally to ensure creatingCheckpoints gets set to false
  try {
    // The status message isn't changing, call to localize it once and use the localized string in the
    // progress report.
    const localizedProgressMessage = nls.localize(
      'creating_checkpoints_progress_window_message'
    );
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: localizedProgressMessage,
        cancellable: false
      },
      async (progress, token) => {
        console.log('sfdxCreateCheckpoints: retrieving org info');
        progress.report({ increment: 0, message: localizedProgressMessage });
        const orgInfoRetrieved: boolean = await checkpointService.retrieveOrgInfo();
        if (!orgInfoRetrieved) {
          return;
        }

        console.log('sfdxCreateCheckpoints: retrieving source/line info');
        progress.report({ increment: 20, message: localizedProgressMessage });
        const sourceLineInfoRetrieved: boolean = await retrieveLineBreakpointInfo();
        // If we didn't get the source line information that'll be reported at that time, just return
        if (!sourceLineInfoRetrieved) {
          return;
        }

        // There can be a max of five active checkpoints
        if (!checkpointService.hasFiveOrLessActiveCheckpoints(true)) {
          return;
        }

        console.log('sfdxCreateCheckpoints: setting typeRefs for checkpoints');
        progress.report({ increment: 50, message: localizedProgressMessage });
        // For the active checkpoints set the typeRefs using the source/line info
        if (!setTypeRefsForEnabledCheckpoints()) {
          return;
        }

        console.log('sfdxCreateCheckpoints: clearing existing checkpoints');
        progress.report({ increment: 50, message: localizedProgressMessage });
        // remove any existing checkpoints on the server
        const allRemoved: boolean = await checkpointService.clearExistingCheckpoints();
        if (!allRemoved) {
          return;
        }

        console.log('sfdxCreateCheckpoints: uploading checkpoints');
        progress.report({ increment: 70, message: localizedProgressMessage });
        // This should probably be batched but it makes dealing with errors kind of a pain
        for (const cpNode of checkpointService.getChildren() as CheckpointNode[]) {
          if (cpNode.isCheckpointEnabled()) {
            await checkpointService.executeCreateApexExecutionOverlayActionCommand(
              cpNode
            );
          }
        }

        console.log('sfdxCreateCheckpoints: finished processing checkpoints');
        progress.report({ increment: 100, message: localizedProgressMessage });
      }
    );
  } finally {
    creatingCheckpoints = false;
  }
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

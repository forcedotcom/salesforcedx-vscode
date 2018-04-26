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
  ApexExecutionOverlayActionRecord,
  QueryExistingOverlayActionIdsCommand,
  QueryOverlayActionIdsSuccessResult
} from '../commands/queryExistingOverlayActionIdsCommand';
import {
  CHECKPOINT,
  DUPLICATE_VALUE,
  MAX_ALLOWED_CHECKPOINTS
} from '../constants';
import { nls } from '../messages';

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';
const NONEDITABLE_RESULT_LABEL = 'Result: ';

// These are the action script types for the ApexExecutionOverlayAction.
export enum ActionScriptEnum {
  None = 'None',
  Apex = 'Apex',
  SOQL = 'SOQL'
}
export interface ApexExecutionOverlayAction {
  ActionScript: string;
  ActionScriptType: ActionScriptEnum;
  ExecutableEntityName: string;
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

  // This should be called when the project info changes
  public async activateRequestService(): Promise<boolean> {
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
      if (!await this.clearExistingCheckpoints()) {
        return false;
      }
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

  // There's a limit to the number of checkpoints for a given user and
  // that number is 5.
  public canAddCheckpointNote(): Boolean {
    return this.getChildren().length < MAX_ALLOWED_CHECKPOINTS;
  }

  public async getOrCreateCheckpointNode(
    uriInput: string,
    sourceFileInput: string,
    typeRefInput: string,
    lineInput: number
  ): Promise<CheckpointNode> {
    const cpTemp = this.returnCheckpointNodeIfAlreadyExists(
      uriInput,
      lineInput
    );
    if (cpTemp) {
      return cpTemp;
    }
    const cpNode = new CheckpointNode(
      uriInput,
      sourceFileInput,
      typeRefInput,
      lineInput
    );
    await this.executeCreateApexExecutionOverlayActionCommand(cpNode);
    this.checkpoints.push(cpNode);
    this._onDidChangeTreeData.fire();
    return cpNode;
  }

  private returnCheckpointNodeIfAlreadyExists(
    uriInput: string,
    lineInput: number
  ): CheckpointNode | undefined {
    for (const cp of this.checkpoints) {
      if (
        cp.getCheckpointLineNumber() === lineInput &&
        cp.getCheckpointUri().toLocaleLowerCase() ===
          uriInput.toLocaleLowerCase()
      ) {
        return cp;
      }
    }
    return undefined;
  }

  public async deleteCheckpointNode(
    uriInput: string,
    lineInput: number
  ): Promise<void> {
    const cpNode = this.returnCheckpointNodeIfAlreadyExists(
      uriInput,
      lineInput
    );
    if (cpNode) {
      const index = this.checkpoints.indexOf(cpNode, 0);
      if (index > -1) {
        this.checkpoints.splice(index, 1);
        this._onDidChangeTreeData.fire();
        await this.executeRemoveApexExecutionOverlayActionCommand(cpNode);
      }
    }
  }

  // recreateIfDupe defaults to true, when the recurisve call is made
  // this is set to false to prevent
  public async executeCreateApexExecutionOverlayActionCommand(
    theNode: CheckpointNode,
    recreateIfDupe = true
  ) {
    // create the overlay action
    const overlayActionCommand = new ApexExecutionOverlayActionCommand(
      theNode.createJSonStringForOverlayAction()
    );
    let errorString = undefined;
    let returnString = undefined;
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
      theNode.setActionCommandResult(result.id, undefined);
      return;
    }
    // Failure could mean that there is already an entry with the same the criteria.
    // If that's the case then pase the Id out, delete it and recreate it.
    // Fun fact: the result is an array of 1 item
    // "[{"message":"duplicate value found: ScopeId duplicates value on record with id: 1doxx00000000Pn","errorCode":"DUPLICATE_VALUE","fields":[]}]"
    // Fun fact #2: The result message can also be an outright failure string. For example if we can't connnect up to the AppServer then the result
    // is a plain string. It'll cause the parsing to fail.
    if (errorString) {
      try {
        const result = JSON.parse(
          errorString
        ) as ApexExecutionOverlayFailureResult[];
        // If the node is a dupe, then delete it and recreate it. If the failure reason
        // was something else that we don't handle then just set the command result.
        if (result[0].errorCode === DUPLICATE_VALUE && recreateIfDupe) {
          // parse the record ID from the result[0].message, call remove and then call add again
          const duplicateId = result[0].message
            .substr(result[0].message.lastIndexOf(':') + 1)
            .trim();
          // set the id to the duplicate id and call the delete to nuke the record,
          // then call the delete again with the recreation flag unset
          theNode.setActionCommandResult(duplicateId, undefined);
          await this.executeRemoveApexExecutionOverlayActionCommand(theNode);
          // clear out the action command result
          theNode.setActionCommandResult(undefined, undefined);
          await this.executeCreateApexExecutionOverlayActionCommand(
            theNode,
            false /* recreateIfDupe */
          );
        } else {
          theNode.setActionCommandResult(undefined, result[0].message);
        }
      } catch {
        // If the JSON parse fails then the message was actually just a string returned.
        // This can happen when the connection is lost and we try to execute a command.
        theNode.setActionCommandResult(undefined, errorString);
      }
    }
  }

  public async executeRemoveApexExecutionOverlayActionCommand(
    theNode: CheckpointNode
  ) {
    const actionCommandResultId = theNode.getActionCommandResultId();
    // If there's no Id then don't bother executing the command
    if (actionCommandResultId) {
      const overlayActionCommand = new ApexExecutionOverlayActionCommand(
        theNode.createJSonStringForOverlayAction(),
        actionCommandResultId
      );

      // Deleting a node doesn't return anything on success, only on failure
      let errorString = undefined;
      await this.myRequestService
        .execute(overlayActionCommand, RestHttpMethodEnum.Delete)
        .then(reason => {
          errorString = reason;
        });
      if (errorString) {
        vscode.window.showErrorMessage(
          nls.localize('cannot_delete_existing_checkpoint') + ': ' + errorString
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
        let errorString = undefined;
        let returnString = undefined;
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
            for (const record of successResult.records) {
              const deleteCommand = new ApexExecutionOverlayActionCommand(
                undefined,
                record.Id
              );
              let deleteError = undefined;
              await this.myRequestService
                .execute(deleteCommand, RestHttpMethodEnum.Delete)
                .then(reason => {
                  deleteError = reason;
                });
              // There's not a lot that can be done here. At this point give the user the error message
              // that was returned from the AppServer.
              if (deleteError) {
                vscode.window.showErrorMessage(
                  nls.localize('cannot_delete_existing_overlay_action') + ': ' + deleteError
                );
                return false;
              }
            }
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
  private readonly uri: string;
  private readonly checkpointOverlayAction: ApexExecutionOverlayAction;

  constructor(
    uriInput: string,
    sourceFileInput: string,
    typeRefInput: string,
    lineInput: number
  ) {
    super(sourceFileInput + ':' + lineInput, TreeItemCollapsibleState.Expanded);
    this.uri = uriInput;
    this.checkpointOverlayAction = {
      ActionScript: '',
      ActionScriptType: ActionScriptEnum.None,
      ExecutableEntityName: typeRefInput,
      IsDumpingHeap: true,
      Iteration: 1,
      Line: lineInput
    };

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

  public getCheckpointLineNumber(): number {
    return this.checkpointOverlayAction.Line;
  }

  public getCheckpointUri(): string {
    return this.uri;
  }

  public getChildren(): CheckpointInfoNode[] {
    return this.children;
  }

  public getActionCommandResultId(): string | undefined {
    // Look for an CheckpointInfoResultNode on the child nodes and
    // return its id (which will be set or undefined) or undefined
    // if there isn't one
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoResultNode) {
        return cpInfoNode.getActionObjectId();
      }
    }
    return undefined;
  }

  public getActionCommandFailureMessage(): string | undefined {
    // Look for an CheckpointInfoResultNode on the child nodes and
    // return its id (which will be set or undefined) or undefined
    // if there isn't one
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoResultNode) {
        return cpInfoNode.getActionObjectFailureMessage();
      }
    }
    return undefined;
  }

  public setActionCommandResult(
    actionObjectId: string | undefined,
    actionObjectFailureMessage: string | undefined
  ): CheckpointInfoResultNode {
    // Delete the existing result node, if one exists
    // Q) But why delete the existing result node?
    // A) Because the node's label is created in the constructor.
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoResultNode) {
        const index = this.children.indexOf(cpInfoNode, 0);
        if (index > -1) {
          this.children.splice(index, 1);
        }
      }
    }
    const resultNode = new CheckpointInfoResultNode(
      actionObjectId,
      actionObjectFailureMessage
    );
    this.children.push(resultNode);
    return resultNode;
  }
}

export class CheckpointInfoNode extends BaseNode {
  public getChildren(): BaseNode[] {
    return [];
  }
}

// Remove the tags when the nodes using the checkpointOverlayAction become editable.
/* tslint:disable */
export class CheckpointInfoActionScriptNode extends CheckpointInfoNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(
      EDITABLE_FIELD_LABEL_ACTION_SCRIPT + cpOverlayActionInput.ActionScript
    );
    this.checkpointOverlayAction = cpOverlayActionInput;
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

  public getChildren(): BaseNode[] {
    return [];
  }
}
/* tslint:enable */

export class CheckpointInfoResultNode extends CheckpointInfoNode {
  private actionObjectId: string | undefined;
  private actionObjectFailureMessage: string | undefined;
  constructor(
    actionObjectId: string | undefined,
    actionObjectFailureMessage: string | undefined
  ) {
    if (actionObjectId) {
      super(NONEDITABLE_RESULT_LABEL + actionObjectId);
    } else {
      super(NONEDITABLE_RESULT_LABEL + actionObjectFailureMessage);
    }
    this.actionObjectId = actionObjectId;
    this.actionObjectFailureMessage = actionObjectFailureMessage;
  }

  public getActionObjectId(): string | undefined {
    return this.actionObjectId;
  }

  public getActionObjectFailureMessage(): string | undefined {
    return this.actionObjectFailureMessage;
  }

  public getChildren(): BaseNode[] {
    return [];
  }
}

export async function processBreakpointChangedForCheckpoints(
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): Promise<void> {
  for (const bp of breakpointsChangedEvent.removed) {
    if (
      bp.enabled &&
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0
    ) {
      if (bp instanceof vscode.SourceBreakpoint) {
        await checkpointService.deleteCheckpointNode(
          bp.location.uri.toString(false /* skipEncoding */),
          bp.location.range.start.line + 1 // need to add 1 since the lines are 0 based
        );
      }
    }
  }

  const breakpointsToRemove: vscode.Breakpoint[] = [];
  let overTheLimit: Boolean = false;
  for (const bp of breakpointsChangedEvent.added) {
    if (
      bp.enabled &&
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0
    ) {
      if (!checkpointService.canAddCheckpointNote()) {
        overTheLimit = true;
        breakpointsToRemove.push(bp);
        continue; // go on to the next iteration
      }
      if (bp instanceof vscode.SourceBreakpoint) {
        const uri = bp.location.uri.toString(false /* skipEncoding */);
        const typeRef = breakpointUtil.getTopLevelTyperefForUri(uri);
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        const theNode = await checkpointService.getOrCreateCheckpointNode(
          uri,
          filename,
          typeRef,
          bp.location.range.start.line + 1 // need to add 1 since the lines are 0 based
        );
        const errorMessage = theNode.getActionCommandFailureMessage();
        if (errorMessage) {
          breakpointsToRemove.push(bp);
          vscode.window.showErrorMessage(
            nls.localize('unable_to_create_checkpoint') +
              ' Error: ' +
              errorMessage
          );
        }
      }
    }
  }

  // breakpointsToRemove will be empty unless we're over the limit (more than 5 checkpoints) or
  // there was a failure creating a checkpoint. If there's a failure creating the checkpoint that
  // error message will already have been showne to the user. If we're over the limit then that
  // message needs to be displayed. overTheLimit is used to the error is only displayed once
  if (breakpointsToRemove.length > 0) {
    if (overTheLimit) {
      vscode.window.showErrorMessage(nls.localize('up_to_five_checkpoints'));
    }
    vscode.debug.removeBreakpoints(breakpointsToRemove);
  }
}

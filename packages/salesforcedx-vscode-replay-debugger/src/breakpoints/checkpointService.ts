/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ForceOrgDisplay,
  OrgInfo,
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-apex-debugger/out/src/commands';
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode';
import * as vscode from 'vscode';
import { BreakpointUtil } from '../breakpoints/breakpointUtil';
import {
  ApexExecutionOverlayActionCommand,
  ApexExecutionOverlayFailureResult,
  ApexExecutionOverlaySuccessResult
} from '../commands/apexExecutionOverlayActionCommand';
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
export class CheckpointService implements TreeDataProvider<BaseNode> {
  private static instance: CheckpointService;
  private checkpoints: CheckpointNode[];
  private _onDidChangeTreeData: EventEmitter<
    BaseNode | undefined
  > = new EventEmitter<BaseNode | undefined>();
  private myRequestService = RequestService.getInstance();
  private orgInfo: OrgInfo;
  private sfdxProject: string | null = null;

  //  private orgInfo: OrgInfo;

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> = this
    ._onDidChangeTreeData.event;

  public constructor() {
    this.checkpoints = [];
  }

  // This should be called when the project info changes
  public async activateRequestService() {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      this.sfdxProject = vscode.workspace.workspaceFolders[0].uri.fsPath;
      this.orgInfo = await new ForceOrgDisplay().getOrgInfo(this.sfdxProject);
      this.myRequestService.instanceUrl = this.orgInfo.instanceUrl;
      this.myRequestService.accessToken = this.orgInfo.accessToken;
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

  public async addCheckpointNode(
    uriInput: string,
    sourceFileInput: string,
    typeRefInput: string,
    lineInput: number,
    makeCommandCall = true
  ): Promise<CheckpointNode> {
    // Before creating a new checkpoint node, check and see if one with the
    // URI and line number already exists. If one already exists then return
    // that one, otherwise create one, add it to the list and then return it
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
    // This is here for testing purposes. The command is being tested separately
    if (makeCommandCall === true) {
      await this.executeCreateApexExecutionOverlayActionCommand(cpNode);
    }
    this.checkpoints.push(cpNode);
    this._onDidChangeTreeData.fire();
    return cpNode;
  }

  // For checkpoints, there should only ever be one checkpoint for a given uri/line
  // combination. ApexExecutionOverlayAction will not allow multiple actions for the
  // same type/line.
  private returnCheckpointNodeIfAlreadyExists(
    uriInput: string,
    lineInput: number
  ): CheckpointNode | undefined {
    for (const cp of this.checkpoints) {
      if (cp.getCheckpointLineNumber() === lineInput) {
        if (
          cp.getCheckpointUri().toLocaleLowerCase() ===
          uriInput.toLocaleLowerCase()
        ) {
          return cp;
        }
      }
    }
    // If we didn't find anything then just return undefined
    return undefined;
  }

  public async deleteCheckpointNode(
    uriInput: string,
    lineInput: number,
    makeCommandCall = true
  ): Promise<boolean> {
    const cpNode = this.returnCheckpointNodeIfAlreadyExists(
      uriInput,
      lineInput
    );
    if (cpNode) {
      const index = this.checkpoints.indexOf(cpNode, 0);
      if (index > -1) {
        this.checkpoints.splice(index, 1);
        this._onDidChangeTreeData.fire();
        if (makeCommandCall === true) {
          await this.executeRemoveApexExecutionOverlayActionCommand(cpNode);
        }
        return true;
      }
    }
    return false;
  }

  // recreateIfDupe defaults to true, when the recurisve call is made
  // this is set to false to prevent
  private async executeCreateApexExecutionOverlayActionCommand(
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
    }
    // Failure could mean that there is already an entry with the same the criteria.
    // If that's the case then passe the Id out, delete it and recreate it.
    // Fun fact: the result is an array of 1 item
    // "[{"message":"duplicate value found: ScopeId duplicates value on record with id: 1doxx00000000Pn","errorCode":"DUPLICATE_VALUE","fields":[]}]"
    if (errorString) {
      const result = <ApexExecutionOverlayFailureResult[]>JSON.parse(
        errorString
      );
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
    }
  }

  private async executeRemoveApexExecutionOverlayActionCommand(
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
      // There's not a lot that can be done here. At this point give the user the error message
      // that was returned from the AppServer.
      if (errorString) {
        vscode.window.showErrorMessage(errorString);
      }
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

// Specialty node defintions. These are for nodes that the user will be capable of changing the values
// for. There are 3 different specialy CheckpointInfoNode value types:
// CheckpointInfoActionScriptNode: holds the action script (string)
// CheckpointInfoActionScriptTypeNode: holds the type of action script (ActionScriptType enum)
// CheckpointInfoIterationsNode: holds the number of iterations (integer)
// The reason for creating these would be to add specific validations when the fields are made editable
// (as opposed to storing things on generic CheckpointInfoNodes with an Any type attribute).
// The checkpointOverlayAction attibutes that are stored on these 3 CheckpointInfoNodes are
// the same one stored on the parent. Any changes to these will be reflected when the
// ApexExecutionOverlayAction is accessed to create the JSON string for the ApexExecutionOverlayAction
// command calls.
// The last CheckpointInfoNode type, CheckpointInfoResultNode, was created to store/show the results
// of the ApexExecutionOverlayActionCommand output, the Id when successful or the error message otherwise.
// Note: Dupes are currently being recreated and the processing here shouldn't allow more than 5 checkpoints
// be created (the max allowed). Realistically, this should only hold the Id of the checkpoint unless
// something goes completely sideways.
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

// The BreakpointsChangeEvent has 3 different arrays, added, changed and removed.
// These, in theory, should be SouceBreakpoint events for checkpoints which is the
// only type of breakpoint that is going to be processed in here. There are a couple
// of things that should be noted about the Breakpoint and SourceBreakpoint classes.
// The file location that matches our URI from the SourceBreakpoint is the encoded URI
// string from Location.Uri.toString(false /*skipEncoding*/). It'll have same format as the
// URI is the setBreakPointsRequest in apexReplayDebug.ts. The line number is also in the
// location and started as a range. Pull the line number from Location.Range.Start.Line but
// add 1 because those lines are 0 based.
// breakpointsChangedEvent.added:
// This event fires with items in the added array when the extensions are first launched
// if there were breakpoints in the loaded project. The checkpoints will be entirely empty
// at that point and time so they need to be populated.
// breakpointsChangedEvent.changed:
// The event fires with a list of changed breakpoint events at project shutdown even though
// nothing in those events has actually changed. Currently the changed event is ignored.
// breakpointsChangedEvent.removed:
// The removed events are only going to fire when something is actually removed so unlike
// the added event there's no ambiguity there
export async function processBreakpointChangedForCheckpoints(
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): Promise<void> {
  const breakpointsToRemove: vscode.Breakpoint[] = [];
  for (const bp of breakpointsChangedEvent.added) {
    if (
      bp.enabled &&
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0
    ) {
      if (!checkpointService.canAddCheckpointNote()) {
        breakpointsToRemove.push(bp);
        continue; // go on to the next iteration
      }
      if (bp instanceof vscode.SourceBreakpoint) {
        const uri = bp.location.uri.toString(false /* skipEncoding */);
        const typeRef = BreakpointUtil.getInstance().getTopLevelTyperefForUri(
          uri
        );
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        await checkpointService.addCheckpointNode(
          uri,
          filename,
          typeRef,
          bp.location.range.start.line + 1 // need to add 1 since the lines are 0 based
        );
      }
    }
  }
  // breakpointsToRemove will be empty unless the user tried to add more than 5 checkpoints.
  // Call showErrorMessage to dispaly the error message once and remove the breakpoints.
  // Unfortunately, calling delete below is going to mean that this event handler is going to
  // get called for the delete.
  if (breakpointsToRemove.length > 0) {
    vscode.window.showErrorMessage(nls.localize('up_to_five_checkpoints'));
    vscode.debug.removeBreakpoints(breakpointsToRemove);
  }

  // The remove always needs to call delete to get rid of the checkpoint.
  for (const bp of breakpointsChangedEvent.removed) {
    if (
      bp.enabled &&
      bp.condition &&
      bp.condition!.toLowerCase().indexOf(CHECKPOINT) >= 0
    ) {
      if (bp instanceof vscode.SourceBreakpoint) {
        // deleteCheckpointNode checks whether or not the checkpoint with the matching
        // URI/Line combo exists before trying to delete it. This matters because of the
        // breakpointsToRemove above. If there user tries to add more than 5, they need to
        // be removed and the fact that the condition is readonly and can't be changed means
        // the removeBreakpoints call on that list will end up going through this codepath
        await checkpointService.deleteCheckpointNode(
          bp.location.uri.toString(false /* skipEncoding */),
          bp.location.range.start.line + 1 // need to add 1 since the lines are 0 based
        );
      }
    }
  }
}

/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from 'vscode';

import {
  APEX_EXECUTION_OVERLAY_ACTION_ACTION_SCRIPT,
  APEX_EXECUTION_OVERLAY_ACTION_ACTION_SCRIPT_TYPE,
  APEX_EXECUTION_OVERLAY_ACTION_EXECUTABLE_ENTITY_NAME,
  APEX_EXECUTION_OVERLAY_ACTION_IS_DUMPING_HEAP,
  APEX_EXECUTION_OVERLAY_ACTION_ITERATION,
  APEX_EXECUTION_OVERLAY_ACTION_LINE,
  SFDC_TRIGGER
} from '../constants';

import { CheckpointUtil } from './checkpointUtil';

import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';

// This is the CHECKPOINT_INFO_EVENT message type. It is currently only
// called from the apexReplayDebug's setBreakPointsRequest and is used
// to send an event that'll create a checkpoint object in the IDE.
export interface CheckpointMessage {
  source: DebugProtocol.Source;
  line: number;
  uri: string;
}

// These are the action script types for the ApexExecutionOverlayAction.
export enum ActionScriptType {
  None,
  Apex,
  SOQL
}

export class CheckpointService implements TreeDataProvider<BaseNode> {
  private static instance: CheckpointService;
  private checkpoints: CheckpointNode[];
  private _onDidChangeTreeData: EventEmitter<
    BaseNode | undefined
  > = new EventEmitter<BaseNode | undefined>();

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> = this
    ._onDidChangeTreeData.event;

  public constructor() {
    this.checkpoints = [];
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

  public update(): void {
    this._onDidChangeTreeData.fire();
  }

  public addCheckpointNode(
    source: DebugProtocol.Source,
    line: number,
    uri: string
  ): CheckpointNode {
    const cpNode = new CheckpointNode(source, line, uri);
    this.checkpoints.push(cpNode);
    this._onDidChangeTreeData.fire();
    return cpNode;
  }
}

export const checkpointService = CheckpointService.getInstance();

export abstract class BaseNode extends TreeItem {
  public abstract getChildren(): BaseNode[];
}

export class CheckpointNode extends BaseNode {
  private readonly children: CheckpointInfoNode[] = [];
  // These variables are necessary for the ApexExecutionOverlayAction
  // and are not user editable. All user editable checkpoint pieces
  // are stored on the children.
  public executableEntityName: string;
  public isDumpingHeap: boolean;
  public line: number;
  // Stored for convenience
  public isTrigger: boolean;
  // Source and URI are two things that the user cannot edit and
  // it's debatable whether or not they need to be stored at all
  public source: DebugProtocol.Source;
  public uri: string;

  constructor(
    sourceInput: DebugProtocol.Source,
    lineInput: number,
    uriInput: string
  ) {
    super(
      sourceInput.name + ':' + lineInput,
      TreeItemCollapsibleState.Expanded
    );

    this.line = lineInput;
    this.source = sourceInput;
    this.uri = uriInput;
    const sourceNameSplit = this.source.name!.split('.');
    // Get the executableEntityName from the sourceInput, if this is a trigger
    // then ensure that the SFDC_TRIGGER prefix is prepended to the trigger name
    if (sourceNameSplit[1].toLocaleLowerCase() === 'trigger') {
      this.executableEntityName = SFDC_TRIGGER + sourceNameSplit[0];
      this.isTrigger = true;
    } else {
      this.executableEntityName = sourceNameSplit[0];
      this.isTrigger = false;
    }
    this.isDumpingHeap = true;

    // Create the items that the user is going to be able to control (Type, Script, Iteration)
    const cpASTNode = new CheckpointInfoActionScriptTypeNode(
      ActionScriptType.None
    );
    this.children.push(cpASTNode);
    const cpScriptNode = new CheckpointInfoActionScriptNode('');
    this.children.push(cpScriptNode);
    const cpIterationNode = new CheckpointInfoIterationNode(1);
    this.children.push(cpIterationNode);
  }

  public createJsonStringForApexExecutionOverlayAction(): string {
    const jsonNameValueSeperator = ', ';
    // Start the JSON name/value pairs with the executable entity name
    let returnString = CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_EXECUTABLE_ENTITY_NAME,
      this.executableEntityName
    );
    returnString += jsonNameValueSeperator;
    // Add all of the children
    for (const cpInfoNode of this.children) {
      returnString += cpInfoNode.createJsonStringForApexExecutionOverlayAction();
      returnString += jsonNameValueSeperator;
    }
    // Add isDumpingHeap
    returnString += CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_IS_DUMPING_HEAP,
      this.isDumpingHeap
    );
    returnString += jsonNameValueSeperator;
    // Add line
    returnString += CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_LINE,
      this.line
    );
    return returnString;
  }

  public getChildren(): CheckpointInfoNode[] {
    return this.children;
  }
}

export class CheckpointInfoNode extends BaseNode {
  public createJsonStringForApexExecutionOverlayAction(): string {
    return '';
  }
  public getChildren(): BaseNode[] {
    return [];
  }
}

// Specialty node defintions. These are for nodes that the user is capable of
// changing the values for and are of different value types:
// CheckpointInfoActionScriptNode: holds the action script (string)
// CheckpointInfoActionScriptTypeNode: holds the type of action script (ActionScriptType enum)
// CheckpointInfoIterationsNode: holds the number of iterations (integer)
// The reason for creating these would be to add specific validations when
// the fields are made editable.
export class CheckpointInfoActionScriptNode extends CheckpointInfoNode {
  public actionScript: string;
  constructor(actionScriptInput: string) {
    super('Script: ' + actionScriptInput);
    this.actionScript = actionScriptInput;
  }
  public createJsonStringForApexExecutionOverlayAction(): string {
    return CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_ACTION_SCRIPT,
      this.actionScript
    );
  }

  public getChildren(): BaseNode[] {
    return [];
  }
}

export class CheckpointInfoActionScriptTypeNode extends CheckpointInfoNode {
  public actionScriptType: ActionScriptType;
  constructor(actionScriptTypeInput: ActionScriptType) {
    super('Type: ' + ActionScriptType[actionScriptTypeInput]);
    this.actionScriptType = actionScriptTypeInput;
  }
  public createJsonStringForApexExecutionOverlayAction(): string {
    return CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_ACTION_SCRIPT_TYPE,
      ActionScriptType[this.actionScriptType]
    );
  }

  public getChildren(): BaseNode[] {
    return [];
  }
}

export class CheckpointInfoIterationNode extends CheckpointInfoNode {
  public iteration: number;
  constructor(iterationInput: number) {
    super('Iterations: ' + iterationInput);
    this.iteration = iterationInput;
  }
  public createJsonStringForApexExecutionOverlayAction(): string {
    return CheckpointUtil.formatNameValuePairForJSon(
      APEX_EXECUTION_OVERLAY_ACTION_ITERATION,
      this.iteration
    );
  }

  public getChildren(): BaseNode[] {
    return [];
  }
}

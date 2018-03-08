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
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';

// This is the CHECKPOINT_INFO_EVENT message type. It is currently only
// called from the apexReplayDebug's setBreakPointsRequest and is used
// to send an event that'll create a checkpoint object in the IDE.
export interface CheckpointMessage {
  sourceFile: string;
  typeRef: string;
  line: number;
  uri: string;
}

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

  public addCheckpointNode(
    sourceFile: string,
    typeRef: string,
    line: number,
    uri: string
  ): CheckpointNode {
    const cpNode = new CheckpointNode(sourceFile, typeRef, line, uri);
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

  private readonly checkpointOverlayAction: ApexExecutionOverlayAction;

  // Source and URI are two things that the user cannot edit and
  // it's debatable whether or not they need to be stored at all
  private readonly sourceFile: string;
  private readonly uri: string;

  constructor(
    sourceFileInput: string,
    typeRefInput: string,
    lineInput: number,
    uriInput: string
  ) {
    super(sourceFileInput + ':' + lineInput, TreeItemCollapsibleState.Expanded);

    this.checkpointOverlayAction = {
      ActionScript: '',
      ActionScriptType: ActionScriptEnum.None,
      ExecutableEntityName: typeRefInput,
      IsDumpingHeap: true,
      Iteration: 1,
      Line: lineInput
    };
    this.sourceFile = sourceFileInput;
    this.uri = uriInput;

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

  public getChildren(): CheckpointInfoNode[] {
    return this.children;
  }
}

export class CheckpointInfoNode extends BaseNode {
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
// OK, for the moment the checkpointOverlayAction's are not used. They will be once
// these checkpoints become editable but until then TSLint is going to fail in AppVeyer
// because they're not. Remove the tags when they're editable.
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
// Not sure this is entierly necessary but better safe than sorry.
/* tslint:enable */

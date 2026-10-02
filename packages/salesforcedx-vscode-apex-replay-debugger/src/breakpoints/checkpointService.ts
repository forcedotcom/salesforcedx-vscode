/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// TODO: clean up the types for all of this
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { Connection } from '@salesforce/core';
import { annotateRootSpan, code2ProtocolConverter, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isError, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { URI } from 'vscode-uri';
import { retrieveLineBreakpointInfo } from '../apexExtension';
import { writeToDebuggerOutputWindow } from '../channels';
import { ActionScriptType, CHECKPOINT, FIELD_INTEGRITY_EXCEPTION, MAX_ALLOWED_CHECKPOINTS } from '../debuggerConstants';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';
import { type ProgressOnlyCommandKey } from '../utils/notificationMode';

const COMMAND: ProgressOnlyCommandKey = 'Update Checkpoints in Org';

const EDITABLE_FIELD_LABEL_ITERATIONS = 'Iterations: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT = 'Script: ';
const EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE = 'Type: ';

// These are the action script types for the ApexExecutionOverlayAction.
type ApexExecutionOverlayAction = {
  ActionScript: string;
  ActionScriptType: ActionScriptType;
  ExecutableEntityName: string | undefined;
  IsDumpingHeap: boolean;
  Iteration: number;
  Line: number;
};

/** Gets the Connection from the services ConnectionService */
const getConnection = async (): Promise<Connection | undefined> => {
  try {
    return await getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.ConnectionService.getConnection();
      })
    );
  } catch (error) {
    const errorMessage = `${nls.localize('unable_to_retrieve_org_info')} : ${
      isError(error) ? error.message : String(error)
    }`;
    writeToDebuggerOutputWindow(errorMessage, 'error');
    return undefined;
  }
};

/** Clears existing checkpoints from the org, making VS Code the source of truth */
const clearExistingCheckpoints = async (): Promise<boolean> => {
  try {
    const userId = await getRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const ref = yield* api.services.TargetOrgRef();
        return (yield* SubscriptionRef.get(ref)).userId;
      })
    );

    if (!userId) {
      const errorMessage = nls.localize('unable_to_retrieve_active_user_for_sf_project');
      writeToDebuggerOutputWindow(errorMessage, 'error');
      return false;
    }

    const connection = await getConnection();
    if (!connection) {
      return false;
    }

    const queryResult = await ExtensionProviderService.pipe(
      Effect.flatMap(provider => provider.getServicesApi),
      Effect.flatMap(api => api.services.QueryService),
      Effect.flatMap(queryService =>
        queryService.query(
          {
            soql: `SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId = '${userId}'`,
            tooling: true
          },
          Schema.Struct({ Id: Schema.String })
        )
      ),
      Effect.flatMap(({ records }) => Stream.runCollect(records)),
      Effect.map(chunk => ({ records: Chunk.toReadonlyArray(chunk) })),
      getRuntime().runPromise
    );

    if (queryResult.records.length === 0) {
      return true;
    }

    // Delete all records individually using Promise.all
    const deleteResults = await Promise.allSettled(
      queryResult.records.map(record => connection.tooling.sobject('ApexExecutionOverlayAction').delete(record.Id))
    );

    // Check if any deletes failed
    const failures = deleteResults.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const errorMessage = nls.localize('cannot_delete_existing_checkpoint');
      writeToDebuggerOutputWindow(errorMessage, 'error');
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = `${nls.localize('unable_to_query_for_existing_checkpoints')} : ${String(error)}`;
    writeToDebuggerOutputWindow(errorMessage, 'error');
    return false;
  }
};

/** Creates an Apex Execution Overlay Action for a checkpoint node */
const executeCreateApexExecutionOverlayActionCommand = async (theNode: CheckpointNode): Promise<boolean> => {
  const connection = await getConnection();
  if (!connection) {
    return false;
  }

  try {
    const overlayAction = JSON.parse(theNode.createJSonStringForOverlayAction());
    const result = await connection.tooling.sobject('ApexExecutionOverlayAction').create(overlayAction);

    // result is a SaveResult when creating a single record
    const singleResult = Array.isArray(result) ? result[0] : result;

    if (singleResult.success && singleResult.id) {
      theNode.setActionCommandResultId(singleResult.id);
      return true;
    }

    const errorMessage = `Failed to create checkpoint. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
    writeToDebuggerOutputWindow(errorMessage, 'error');
    return false;
  } catch (error) {
    let errorMessage: string;
    try {
      const errorData = error as { body?: { message: string; errorCode: string }[] };
      const errorArray = errorData.body ?? [];
      if (errorArray.length > 0 && errorArray[0].errorCode === FIELD_INTEGRITY_EXCEPTION) {
        errorMessage = nls.localize('local_source_is_out_of_sync_with_the_server');
      } else if (errorArray.length > 0) {
        errorMessage = `${errorArray[0].message}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
      } else {
        errorMessage = `${String(error)}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
      }
    } catch {
      errorMessage = `${String(error)}. URI=${theNode.getCheckpointUri()}, Line=${theNode.getCheckpointLineNumber()}`;
    }
    writeToDebuggerOutputWindow(errorMessage, 'error');
    return false;
  }
};

class CheckpointService implements TreeDataProvider<BaseNode> {
  private checkpoints: CheckpointNode[] = [];
  private _onDidChangeTreeData: EventEmitter<BaseNode | undefined> = new EventEmitter<BaseNode | undefined>();

  public readonly onDidChangeTreeData: Event<BaseNode | undefined> = this._onDidChangeTreeData.event;

  public fireTreeChangedEvent() {
    this._onDidChangeTreeData.fire(undefined);
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

  public hasFiveOrLessActiveCheckpoints(): boolean {
    const numEnabledCheckpoints = getEnabledCheckpointCount(this);
    if (numEnabledCheckpoints > MAX_ALLOWED_CHECKPOINTS) {
      const errorMessage = nls.localize('up_to_five_checkpoints', numEnabledCheckpoints);
      writeToDebuggerOutputWindow(errorMessage, 'error');
      return false;
    }
    return true;
  }

  public hasOneOrMoreActiveCheckpoints(): boolean {
    const numEnabledCheckpoints = getEnabledCheckpointCount(this);
    if (numEnabledCheckpoints === 0) {
      const errorMessage = nls.localize('no_enabled_checkpoints');
      writeToDebuggerOutputWindow(errorMessage, 'warning');
      return false;
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

abstract class BaseNode extends TreeItem {
  public abstract getChildren(): BaseNode[];
}

class CheckpointNode extends BaseNode {
  private readonly children: (
    | CheckpointInfoActionScriptNode
    | CheckpointInfoActionScriptTypeNode
    | CheckpointInfoIterationNode
  )[] = [];
  public readonly breakpointId: string;
  private readonly checkpointOverlayAction: ApexExecutionOverlayAction;
  private uri: string;
  private enabled: boolean;
  private actionObjectId: string | undefined;

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
    this.actionObjectId = undefined;

    // Create the items that the user is going to be able to control (Type, Script, Iteration)
    this.children.push(
      new CheckpointInfoActionScriptTypeNode(this.checkpointOverlayAction),
      new CheckpointInfoActionScriptNode(this.checkpointOverlayAction),
      new CheckpointInfoIterationNode(this.checkpointOverlayAction)
    );
  }

  public createJSonStringForOverlayAction(): string {
    return JSON.stringify(this.checkpointOverlayAction);
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
    this.checkpointOverlayAction.IsDumpingHeap = checkpointOverlayActionInput.IsDumpingHeap;
    // Instead of just refreshing the node's overlay action, these functions
    // need to be called because some of the information is in their label
    // which needs to get updated
    this.updateActionScript(checkpointOverlayActionInput.ActionScript);
    this.updateActionScriptType(checkpointOverlayActionInput.ActionScriptType);
    this.updateIterations(checkpointOverlayActionInput.Iteration);
    this.label = `${sourceFileInput}:${checkpointOverlayActionInput.Line}`;
    checkpointService.fireTreeChangedEvent();
  }

  private updateActionScript(actionScriptInput: string): void {
    for (const cpInfoNode of this.getChildren()) {
      if (cpInfoNode instanceof CheckpointInfoActionScriptNode) {
        return cpInfoNode.updateActionScript(actionScriptInput);
      }
    }
  }

  private updateActionScriptType(actionScriptTypeInput: ActionScriptType): void {
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

  public getActionScriptType(): ActionScriptType {
    return this.checkpointOverlayAction.ActionScriptType;
  }

  public getCheckpointUri(): string {
    return this.uri;
  }

  public getChildren(): (
    | CheckpointInfoActionScriptNode
    | CheckpointInfoActionScriptTypeNode
    | CheckpointInfoIterationNode
  )[] {
    return this.children;
  }

  public getActionCommandResultId(): string | undefined {
    return this.actionObjectId;
  }

  public setActionCommandResultId(actionObjectId: string | undefined) {
    this.actionObjectId = actionObjectId;
  }
}

// Remove the tags when the nodes using the checkpointOverlayAction become editable.
class CheckpointInfoActionScriptNode extends BaseNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(EDITABLE_FIELD_LABEL_ACTION_SCRIPT + cpOverlayActionInput.ActionScript);
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

class CheckpointInfoActionScriptTypeNode extends BaseNode {
  private checkpointOverlayAction: ApexExecutionOverlayAction;
  constructor(cpOverlayActionInput: ApexExecutionOverlayAction) {
    super(EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE + cpOverlayActionInput.ActionScriptType);
    this.checkpointOverlayAction = cpOverlayActionInput;
  }
  public updateActionScriptType(actionScriptTypeInput: ActionScriptType) {
    this.checkpointOverlayAction.ActionScriptType = actionScriptTypeInput;
    this.label = EDITABLE_FIELD_LABEL_ACTION_SCRIPT_TYPE + actionScriptTypeInput;
  }
  public getChildren(): BaseNode[] {
    return [];
  }
}

class CheckpointInfoIterationNode extends BaseNode {
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

// The lock is necessary to prevent the user from deleting the underlying breakpoints
// associated with the checkpoints while checkpoints are being uploaded to the server.
const lock = Effect.runSync(Effect.makeSemaphore(1));

// Non-blocking guard shared by checkpoint upload and toggle commands. The existing
// lock above separately serializes upload against breakpoint-change event handling.
const checkpointOperationSemaphore = Effect.runSync(Effect.makeSemaphore(1));

// This is the function registered for vscode.debug.onDidChangeBreakpoints. This
// particular event fires breakpoint events without an active debug session which
// allows us to manipulate checkpoints prior to the debug session.
export const processBreakpointChangedForCheckpoints = (
  breakpointsChangedEvent: vscode.BreakpointsChangeEvent
): void => {
  Effect.sync(() => {
    breakpointsChangedEvent.removed
      .filter(isSourceBreakpoint)
      .filter(isCheckpoint)
      .map(bp => checkpointService.deleteCheckpointNodeIfExists(bp.id));
  }).pipe(lock.withPermits(1), Effect.runSync);

  Effect.sync(() => {
    const sourceBreakpoints = breakpointsChangedEvent.changed.filter(isSourceBreakpoint);
    sourceBreakpoints.filter(isCheckpoint).map(bp => {
      const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);
      const uri = code2ProtocolConverter(bp.location.uri);
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const theNode = checkpointService.returnCheckpointNodeIfAlreadyExists(bp.id);
      if (theNode) {
        theNode.updateCheckpoint(bp.enabled, uri, filename, checkpointOverlayAction);
      } else {
        // else if the node didn't exist then create it
        checkpointService.createCheckpointNode(bp.id, bp.enabled, uri, filename, checkpointOverlayAction);
      }
    });
    // The breakpoint is no longer a SourceBreakpoint or is no longer a checkpoint. Call to delete it if it exists
    sourceBreakpoints.filter(isNotCheckpoint).map(bp => checkpointService.deleteCheckpointNodeIfExists(bp.id));
  }).pipe(lock.withPermits(1), Effect.runSync);

  Effect.sync(() => {
    breakpointsChangedEvent.added
      .filter(isSourceBreakpoint)
      .filter(isCheckpoint)
      .map(bp => {
        const checkpointOverlayAction = parseCheckpointInfoFromBreakpoint(bp);

        const uri = code2ProtocolConverter(bp.location.uri);
        const filename = uri.substring(uri.lastIndexOf('/') + 1);
        checkpointService.createCheckpointNode(bp.id, bp.enabled, uri, filename, checkpointOverlayAction);
      });
  }).pipe(lock.withPermits(1), Effect.runSync);
};

const parseCheckpointInfoFromBreakpoint = (breakpoint: vscode.SourceBreakpoint): ApexExecutionOverlayAction => {
  // declare the overlayAction with defaults
  const checkpointOverlayAction: ApexExecutionOverlayAction = {
    ActionScript: '',
    ActionScriptType: 'None',
    ExecutableEntityName: undefined,
    IsDumpingHeap: true,
    Iteration: 1,
    Line: breakpoint.location.range.start.line + 1
  };

  // need to add 1 since the lines are 0 based

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
    checkpointOverlayAction.ActionScriptType = logMessage.toLocaleLowerCase().startsWith('select') ? 'SOQL' : 'Apex';
    checkpointOverlayAction.ActionScript = logMessage;
  }
  return checkpointOverlayAction;
};

const setTypeRefsForEnabledCheckpoints = (): boolean => {
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
        writeToDebuggerOutputWindow(errorMessage, 'error');
        everythingSet = false;
      }
      const typeRef = breakpointUtil.getTopLevelTyperefForUri(cpNode.getCheckpointUri());
      cpNode.setCheckpointTypeRef(typeRef);
    }
  }
  return everythingSet;
};

type CheckpointProgress = vscode.Progress<{ message?: string; increment?: number }>;

/** Reports an upload step to the output channel and the progress notification. */
const reportCheckpointStep = (
  progress: CheckpointProgress,
  localizedProgressMessage: string,
  increment: number,
  detail: string
): Effect.Effect<void> =>
  Effect.sync(() => {
    writeToDebuggerOutputWindow(`${localizedProgressMessage}, ${detail}`);
    progress.report({ increment, message: localizedProgressMessage });
  });

// The order of operations here should be to
// 0. Validate that at least one checkpoint is enabled
// 1. Get the source/line information
// 2. Validate the existing checkpoint information
//    a. validate there are only 5 active checkpoints
//    b. validate that the active checkpoint information is correct
//    c. set the typeRef on each checkpoint (requires the source/line information)
// 3. Remove any existing checkpoints
// 4. Create the new checkpoints
/** Uploads enabled checkpoints, reporting each step. Returns true when the org is up to date. */
const uploadCheckpoints = Effect.fn('uploadCheckpoints')(function* (
  progress: CheckpointProgress,
  localizedProgressMessage: string
) {
  yield* reportCheckpointStep(
    progress,
    localizedProgressMessage,
    0,
    nls.localize('checkpoint_creation_status_org_info')
  );

  const connection = yield* Effect.promise(getConnection);
  if (!connection) return false;

  yield* reportCheckpointStep(
    progress,
    localizedProgressMessage,
    20,
    nls.localize('checkpoint_creation_status_source_line_info')
  );
  const sourceLineInfoRetrieved = yield* retrieveLineBreakpointInfo();
  // If we didn't get the source line information that'll be reported at that time, just return
  if (!sourceLineInfoRetrieved) return false;

  // There can be a max of five active checkpoints
  if (!checkpointService.hasFiveOrLessActiveCheckpoints()) return false;

  yield* reportCheckpointStep(
    progress,
    localizedProgressMessage,
    50,
    nls.localize('checkpoint_creation_status_setting_typeref')
  );
  // For the active checkpoints set the typeRefs using the source/line info
  if (!setTypeRefsForEnabledCheckpoints()) return false;

  yield* reportCheckpointStep(
    progress,
    localizedProgressMessage,
    50,
    nls.localize('checkpoint_creation_status_clearing_existing_checkpoints')
  );
  // remove any existing checkpoints on the server
  const allRemoved = yield* Effect.promise(clearExistingCheckpoints);
  if (!allRemoved) return false;

  yield* reportCheckpointStep(
    progress,
    localizedProgressMessage,
    70,
    nls.localize('checkpoint_creation_status_uploading_checkpoints')
  );
  const [failedCheckpointUploads] = yield* Effect.partition(
    (checkpointService.getChildren() as CheckpointNode[]).filter(cpNode => cpNode.isCheckpointEnabled()),
    cpNode => Effect.tryPromise(() => executeCreateApexExecutionOverlayActionCommand(cpNode)),
    { concurrency: 'unbounded' }
  );
  if (failedCheckpointUploads.length > 0) return false;

  yield* Effect.sync(() => progress.report({ increment: 100, message: localizedProgressMessage }));
  yield* Effect.sync(() =>
    writeToDebuggerOutputWindow(
      `${localizedProgressMessage}, ${nls.localize('checkpoint_creation_status_processing_complete_success')}`
    )
  );
  return true;
});

/** Creates checkpoints in the org by uploading enabled checkpoint nodes */
const createCheckpoints = Effect.fn('createCheckpoints')(function* () {
  if (!checkpointService.hasOneOrMoreActiveCheckpoints()) return false;

  // The status message isn't changing, localize it once and reuse it in the progress report.
  const localizedProgressMessage = nls.localize('sf_update_checkpoints_in_org');
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;
  const progressLocation = yield* notificationMode.getProgressLocation(COMMAND);

  const succeeded = yield* Effect.zipRight(
    Effect.sync(() => writeToDebuggerOutputWindow(`${nls.localize('long_command_start')} ${localizedProgressMessage}`)),
    Effect.promise(() =>
      vscode.window.withProgress(
        {
          location: progressLocation,
          title: localizedProgressMessage,
          cancellable: false
        },
        (progress, _token) => getRuntime().runPromise(uploadCheckpoints(progress, localizedProgressMessage))
      )
    )
  ).pipe(
    // The lock prevents deleting the underlying breakpoints attached to the
    // checkpoints while they're being uploaded into the org.
    Effect.ensuring(
      Effect.sync(() => {
        writeToDebuggerOutputWindow(`${nls.localize('long_command_end')} ${localizedProgressMessage}`);
      })
    ),
    lock.withPermits(1)
  );

  if (!succeeded) {
    yield* Effect.sync(() =>
      writeToDebuggerOutputWindow(
        nls.localize('checkpoint_upload_error_wrap_up_message', nls.localize('sf_update_checkpoints_in_org')),
        'error'
      )
    );
  }
  return succeeded;
});

class CreateCheckpointsError extends Schema.TaggedError<CreateCheckpointsError>()('CreateCheckpointsError', {
  message: Schema.String
}) {}

/**
 * Annotates the enclosing command's root span (`sf.create.checkpoints`, added by
 * `registerCommandWithRuntime`) with the upload outcome. Not a new span: the command
 * span is already exported, so production telemetry only needs the attribute.
 */
export const annotateCheckpointUpload = (succeeded: boolean) =>
  annotateRootSpan({
    errorMessage: succeeded
      ? ''
      : nls.localize('checkpoint_upload_error_wrap_up_message', nls.localize('sf_update_checkpoints_in_org'))
  });

export const sfCreateCheckpointsCommand = Effect.fn('sfCreateCheckpointsCommand')(function* () {
  const result = yield* checkpointOperationSemaphore.withPermitsIfAvailable(1)(
    createCheckpoints().pipe(
      Effect.mapError(error => new CreateCheckpointsError({ message: isError(error) ? error.message : String(error) })),
      Effect.catchAllDefect(defect =>
        Effect.fail(new CreateCheckpointsError({ message: isError(defect) ? defect.message : String(defect) }))
      ),
      Effect.tapBoth({
        onFailure: error => annotateRootSpan({ errorMessage: error.message }),
        onSuccess: annotateCheckpointUpload
      })
    )
  );
  return yield* Option.match(result, {
    onNone: () => annotateCheckpointUpload(false).pipe(Effect.as(false)),
    onSome: Effect.succeed
  });
});

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
const toggleCheckpoint = Effect.fn('toggleCheckpoint')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const editorContextOption = yield* api.services.EditorService.getActiveEditorContext(true).pipe(
    Effect.map(Option.some),
    Effect.catchTag('NoActiveEditorError', () => Effect.succeed(Option.none()))
  );
  if (Option.isNone(editorContextOption)) return;
  const editorContext = editorContextOption.value;

  const lineNumber = editorContext.selectionRange?.startLine;
  if (isUndefined(lineNumber)) return;

  // While selection could be passed directly into the location instead of creating
  // a new range, it ends up creating a weird secondary icon on the line with the
  // breakpoint which is due to the start/end characters being non-zero.
  const bp = fetchExistingBreakpointForUriAndLineNumber(editorContext.documentUri, lineNumber);
  if (bp?.condition?.toLowerCase().includes(CHECKPOINT)) {
    yield* Effect.sync(() => vscode.debug.removeBreakpoints([bp]));
    return;
  }

  // The only thing from an existing breakpoint to keep is its hitCondition, which
  // maps to iterations. Remove it before adding the checkpoint breakpoint.
  if (bp) yield* Effect.sync(() => vscode.debug.removeBreakpoints([bp]));

  // Create a new checkpoint/breakpoint from scratch.
  const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
  const location = new vscode.Location(editorContext.documentUri, range);
  const newBreakpoint = new vscode.SourceBreakpoint(location, true, CHECKPOINT, bp?.hitCondition);
  yield* Effect.sync(() => vscode.debug.addBreakpoints([newBreakpoint]));
});

export const sfToggleCheckpointCommand = Effect.fn('sfToggleCheckpointCommand')(function* () {
  const result = yield* checkpointOperationSemaphore.withPermitsIfAvailable(1)(toggleCheckpoint());
  yield* Option.match(result, {
    onNone: () =>
      Effect.sync(() => writeToDebuggerOutputWindow(nls.localize('checkpoint_upload_in_progress'), 'warning')),
    onSome: () => Effect.void
  });
});

const fetchExistingBreakpointForUriAndLineNumber = (uriInput: URI, lineInput: number): vscode.Breakpoint | undefined =>
  vscode.debug.breakpoints.find(
    bp =>
      bp instanceof vscode.SourceBreakpoint &&
      bp.location.uri.toString() === uriInput.toString() &&
      bp.location.range.start.line === lineInput
  );

const getEnabledCheckpointCount = (service: CheckpointService): number =>
  (service.getChildren() as CheckpointNode[]).filter(cpNode => cpNode.isCheckpointEnabled()).length;

const isSourceBreakpoint = (breakpoint: vscode.Breakpoint): breakpoint is vscode.SourceBreakpoint =>
  Boolean(breakpoint instanceof vscode.SourceBreakpoint);

const isCheckpoint = (breakpoint: vscode.SourceBreakpoint): boolean =>
  Boolean(breakpoint.condition?.toLowerCase().includes(CHECKPOINT));

const isNotCheckpoint = (breakpoint: vscode.SourceBreakpoint): boolean => !isCheckpoint(breakpoint);

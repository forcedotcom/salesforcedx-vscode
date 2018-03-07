/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

declare module 'vscode' {
  // export enum FileErrorCodes {
  // 	/**
  // 	 * Not owner.
  // 	 */
  // 	EPERM = 1,
  // 	/**
  // 	 * No such file or directory.
  // 	 */
  // 	ENOENT = 2,
  // 	/**
  // 	 * I/O error.
  // 	 */
  // 	EIO = 5,
  // 	/**
  // 	 * Permission denied.
  // 	 */
  // 	EACCES = 13,
  // 	/**
  // 	 * File exists.
  // 	 */
  // 	EEXIST = 17,
  // 	/**
  // 	 * Not a directory.
  // 	 */
  // 	ENOTDIR = 20,
  // 	/**
  // 	 * Is a directory.
  // 	 */
  // 	EISDIR = 21,
  // 	/**
  // 	 *  File too large.
  // 	 */
  // 	EFBIG = 27,
  // 	/**
  // 	 * No space left on device.
  // 	 */
  // 	ENOSPC = 28,
  // 	/**
  // 	 * Directory is not empty.
  // 	 */
  // 	ENOTEMPTY = 66,
  // 	/**
  // 	 * Invalid file handle.
  // 	 */
  // 	ESTALE = 70,
  // 	/**
  // 	 * Illegal NFS file handle.
  // 	 */
  // 	EBADHANDLE = 10001,
  // }

  export enum FileChangeType {
    Updated = 0,
    Added = 1,
    Deleted = 2
  }

  export interface FileChange {
    type: FileChangeType;
    resource: Uri;
  }

  export enum FileType {
    File = 0,
    Dir = 1,
    Symlink = 2
  }

  export interface FileStat {
    id: number | string;
    mtime: number;
    // atime: number;
    size: number;
    type: FileType;
  }

  export interface TextSearchQuery {
    pattern: string;
    isRegex?: boolean;
    isCaseSensitive?: boolean;
    isWordMatch?: boolean;
  }

  export interface TextSearchOptions {
    includes: GlobPattern[];
    excludes: GlobPattern[];
  }

  export interface TextSearchResult {
    uri: Uri;
    range: Range;
    preview: { leading: string; matching: string; trailing: string };
  }

  // todo@joh discover files etc
  // todo@joh CancellationToken everywhere
  // todo@joh add open/close calls?
  export interface FileSystemProvider {
    readonly onDidChange?: Event<FileChange[]>;

    // todo@joh - remove this
    readonly root?: Uri;

    // more...
    //
    utimes(resource: Uri, mtime: number, atime: number): Thenable<FileStat>;

    stat(resource: Uri): Thenable<FileStat>;

    read(
      resource: Uri,
      offset: number,
      length: number,
      progress: Progress<Uint8Array>
    ): Thenable<number>;

    // todo@joh - have an option to create iff not exist
    // todo@remote
    // offset - byte offset to start
    // count - number of bytes to write
    // Thenable<number> - number of bytes actually written
    write(resource: Uri, content: Uint8Array): Thenable<void>;

    // todo@remote
    // Thenable<FileStat>
    move(resource: Uri, target: Uri): Thenable<FileStat>;

    // todo@remote
    // helps with performance bigly
    // copy?(from: Uri, to: Uri): Thenable<void>;

    // todo@remote
    // Thenable<FileStat>
    mkdir(resource: Uri): Thenable<FileStat>;

    readdir(resource: Uri): Thenable<[Uri, FileStat][]>;

    // todo@remote
    // ? merge both
    // ? recursive del
    rmdir(resource: Uri): Thenable<void>;
    unlink(resource: Uri): Thenable<void>;

    // todo@remote
    // create(resource: Uri): Thenable<FileStat>;

    // find files by names
    // todo@joh, move into its own provider
    findFiles?(
      query: string,
      progress: Progress<Uri>,
      token: CancellationToken
    ): Thenable<void>;
    provideTextSearchResults?(
      query: TextSearchQuery,
      options: TextSearchOptions,
      progress: Progress<TextSearchResult>,
      token: CancellationToken
    ): Thenable<void>;
  }

  export namespace workspace {
    export function registerFileSystemProvider(
      scheme: string,
      provider: FileSystemProvider
    ): Disposable;

    /**
		 * This method replaces `deleteCount` [workspace folders](#workspace.workspaceFolders) starting at index `start`
		 * by an optional set of `workspaceFoldersToAdd` on the `vscode.workspace.workspaceFolders` array. This "splice"
		 * behavior can be used to add, remove and change workspace folders in a single operation.
		 *
		 * If the first workspace folder is added, removed or changed, the currently executing extensions (including the
		 * one that called this method) will be terminated and restarted so that the (deprecated) `rootPath` property is
		 * updated to point to the first workspace folder.
		 *
		 * Use the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) event to get notified when the
		 * workspace folders have been updated.
		 *
		 * **Example:** adding a new workspace folder at the end of workspace folders
		 * ```typescript
		 * workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: ...});
		 * ```
		 *
		 * **Example:** removing the first workspace folder
		 * ```typescript
		 * workspace.updateWorkspaceFolders(0, 1);
		 * ```
		 *
		 * **Example:** replacing an existing workspace folder with a new one
		 * ```typescript
		 * workspace.updateWorkspaceFolders(0, 1, { uri: ...});
		 * ```
		 *
		 * It is valid to remove an existing workspace folder and add it again with a different name
		 * to rename that folder.
		 *
		 * **Note:** it is not valid to call [updateWorkspaceFolders()](#updateWorkspaceFolders) multiple times
		 * without waiting for the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) to fire.
		 *
		 * @param start the zero-based location in the list of currently opened [workspace folders](#WorkspaceFolder)
		 * from which to start deleting workspace folders.
		 * @param deleteCount the optional number of workspace folders to remove.
		 * @param workspaceFoldersToAdd the optional variable set of workspace folders to add in place of the deleted ones.
		 * Each workspace is identified with a mandatory URI and an optional name.
		 * @return true if the operation was successfully started and false otherwise if arguments were used that would result
		 * in invalid workspace folder state (e.g. 2 folders with the same URI).
		 */
    export function updateWorkspaceFolders(
      start: number,
      deleteCount: number,
      ...workspaceFoldersToAdd: { uri: Uri; name?: string }[]
    ): boolean;
  }

  export namespace window {
    export function sampleFunction(): Thenable<any>;
  }

  /**
	 * The contiguous set of modified lines in a diff.
	 */
  export interface LineChange {
    readonly originalStartLineNumber: number;
    readonly originalEndLineNumber: number;
    readonly modifiedStartLineNumber: number;
    readonly modifiedEndLineNumber: number;
  }

  export namespace commands {
    /**
		 * Registers a diff information command that can be invoked via a keyboard shortcut,
		 * a menu item, an action, or directly.
		 *
		 * Diff information commands are different from ordinary [commands](#commands.registerCommand) as
		 * they only execute when there is an active diff editor when the command is called, and the diff
		 * information has been computed. Also, the command handler of an editor command has access to
		 * the diff information.
		 *
		 * @param command A unique identifier for the command.
		 * @param callback A command handler function with access to the [diff information](#LineChange).
		 * @param thisArg The `this` context used when invoking the handler function.
		 * @return Disposable which unregisters this command on disposal.
		 */
    export function registerDiffInformationCommand(
      command: string,
      callback: (diff: LineChange[], ...args: any[]) => any,
      thisArg?: any
    ): Disposable;
  }

  //#region decorations

  //todo@joh -> make class
  export interface DecorationData {
    priority?: number;
    title?: string;
    bubble?: boolean;
    abbreviation?: string;
    color?: ThemeColor;
    source?: string;
  }

  export interface SourceControlResourceDecorations {
    source?: string;
    letter?: string;
    color?: ThemeColor;
  }

  export interface DecorationProvider {
    onDidChangeDecorations: Event<undefined | Uri | Uri[]>;
    provideDecoration(
      uri: Uri,
      token: CancellationToken
    ): ProviderResult<DecorationData>;
  }

  export namespace window {
    export function registerDecorationProvider(
      provider: DecorationProvider
    ): Disposable;
  }

  //#endregion

  export namespace debug {
    /**
		 * List of breakpoints.
		 *
		 * @readonly
		 */
    export let breakpoints: Breakpoint[];

    /**
		 * An event that is emitted when a breakpoint is added, removed, or changed.
		 */
    export const onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;

    /**
		 * Add breakpoints.
		 * @param breakpoints The breakpoints to add.
		*/
    export function addBreakpoints(breakpoints: Breakpoint[]): void;

    /**
		 * Remove breakpoints.
		 * @param breakpoints The breakpoints to remove.
		 */
    export function removeBreakpoints(breakpoints: Breakpoint[]): void;
  }

  /**
	 * An event describing a change to the set of [breakpoints](#debug.Breakpoint).
	 */
  export interface BreakpointsChangeEvent {
    /**
		 * Added breakpoints.
		 */
    readonly added: Breakpoint[];

    /**
		 * Removed breakpoints.
		 */
    readonly removed: Breakpoint[];

    /**
		 * Changed breakpoints.
		 */
    readonly changed: Breakpoint[];
  }

  /**
	 * The base class of all breakpoint types.
	 */
  export class Breakpoint {
    /**
		 * Is breakpoint enabled.
		 */
    readonly enabled: boolean;
    /**
		 * An optional expression for conditional breakpoints.
		 */
    readonly condition?: string;
    /**
		 * An optional expression that controls how many hits of the breakpoint are ignored.
		 */
    readonly hitCondition?: string;

    protected constructor(
      enabled?: boolean,
      condition?: string,
      hitCondition?: string
    );
  }

  /**
	 * A breakpoint specified by a source location.
	 */
  export class SourceBreakpoint extends Breakpoint {
    /**
		 * The source and line position of this breakpoint.
		 */
    readonly location: Location;

    /**
		 * Create a new breakpoint for a source location.
		 */
    constructor(
      location: Location,
      enabled?: boolean,
      condition?: string,
      hitCondition?: string
    );
  }

  /**
	 * A breakpoint specified by a function name.
	 */
  export class FunctionBreakpoint extends Breakpoint {
    /**
		 * The name of the function to which this breakpoint is attached.
		 */
    readonly functionName: string;

    /**
		 * Create a new function breakpoint.
		 */
    constructor(
      functionName: string,
      enabled?: boolean,
      condition?: string,
      hitCondition?: string
    );
  }

  /**
	 * Represents a debug adapter executable and optional arguments passed to it.
	 */
  export class DebugAdapterExecutable {
    /**
		 * The command path of the debug adapter executable.
		 * A command must be either an absolute path or the name of an executable looked up via the PATH environment variable.
		 * The special value 'node' will be mapped to VS Code's built-in node runtime.
		 */
    readonly command: string;

    /**
		 * Optional arguments passed to the debug adapter executable.
		 */
    readonly args: string[];

    /**
		 * Create a new debug adapter specification.
		 */
    constructor(command: string, args?: string[]);
  }

  export interface DebugConfigurationProvider {
    /**
		 * This optional method is called just before a debug adapter is started to determine its excutable path and arguments.
		 * Registering more than one debugAdapterExecutable for a type results in an error.
		 * @param folder The workspace folder from which the configuration originates from or undefined for a folderless setup.
		 * @param token A cancellation token.
		 * @return a [debug adapter's executable and optional arguments](#DebugAdapterExecutable) or undefined.
		 */
    debugAdapterExecutable?(
      folder: WorkspaceFolder | undefined,
      token?: CancellationToken
    ): ProviderResult<DebugAdapterExecutable>;
  }

  /**
	 * The severity level of a log message
	 */
  export enum LogLevel {
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warning = 4,
    Error = 5,
    Critical = 6,
    Off = 7
  }

  /**
	 * A logger for writing to an extension's log file, and accessing its dedicated log directory.
	 */
  export interface Logger {
    readonly onDidChangeLogLevel: Event<LogLevel>;
    readonly currentLevel: LogLevel;
    readonly logDirectory: Thenable<string>;

    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string | Error, ...args: any[]): void;
    critical(message: string | Error, ...args: any[]): void;
  }

  export interface ExtensionContext {
    /**
		 * This extension's logger
		 */
    logger: Logger;
  }

  export interface RenameInitialValue {
    range: Range;
    text?: string;
  }

  export namespace languages {
    export interface RenameProvider2 extends RenameProvider {
      resolveInitialRenameValue?(
        document: TextDocument,
        position: Position,
        token: CancellationToken
      ): ProviderResult<RenameInitialValue>;
    }
  }

  /**
	 * Represents the validation type of the Source Control input.
	 */
  export enum SourceControlInputBoxValidationType {
    /**
		 * Something not allowed by the rules of a language or other means.
		 */
    Error = 0,

    /**
		 * Something suspicious but allowed.
		 */
    Warning = 1,

    /**
		 * Something to inform about but not a problem.
		 */
    Information = 2
  }

  export interface SourceControlInputBoxValidation {
    /**
		 * The validation message to display.
		 */
    readonly message: string;

    /**
		 * The validation type.
		 */
    readonly type: SourceControlInputBoxValidationType;
  }

  /**
	 * Represents the input box in the Source Control viewlet.
	 */
  export interface SourceControlInputBox {
    /**
		 * A validation function for the input box. It's possible to change
		 * the validation provider simply by setting this property to a different function.
		 */
    validateInput?(
      value: string,
      cursorPosition: number
    ): ProviderResult<SourceControlInputBoxValidation | undefined | null>;
  }

  /**
	 * Content settings for a webview.
	 */
  export interface WebviewOptions {
    /**
		 * Should scripts be enabled in the webview contetn?
		 *
		 * Defaults to false (scripts-disabled).
		 */
    readonly enableScripts?: boolean;

    /**
		 * Should command uris be enabled in webview content?
		 *
		 * Defaults to false.
		 */
    readonly enableCommandUris?: boolean;

    /**
		 * Should the webview content be kept arount even when the webview is no longer visible?
		 *
		 * Normally a webview content is created when the webview becomes visible
		 * and destroyed when the webview is hidden. Apps that have complex state
		 * or UI can set the `keepAlive` property to make VS Code keep the webview
		 * content around, even when the webview itself is no longer visible. When
		 * the webview becomes visible again, the content is automatically restored
		 * in the exact same state it was in originally
		 *
		 * `keepAlive` has a high memory overhead and should only be used if your
		 * webview content cannot be quickly saved and restored.
		 */
    readonly keepAlive?: boolean;
  }

  /**
	 * A webview is an editor with html content, like an iframe.
	 */
  export interface Webview {
    /**
		 * Title of the webview.
		 */
    title: string;

    /**
		 * Contents of the webview.
		 */
    html: string;

    /**
		 * Content settings for the webview.
		 */
    options: WebviewOptions;

    /**
		 * The column in which the webview is showing.
		 */
    readonly viewColumn?: ViewColumn;

    /**
		 * Fired when the webview content posts a message.
		 */
    readonly onMessage: Event<any>;

    /**
		 * Fired when the webview becomes the active editor.
		 */
    readonly onBecameActive: Event<void>;

    /**
		 * Fired when the webview stops being the active editor
		 */
    readonly onBecameInactive: Event<void>;

    /**
		 * Post a message to the webview content.
		 *
		 * Messages are only develivered if the webview is visible.
		 *
		 * @param message Body of the message.
		 */
    postMessage(message: any): Thenable<any>;

    /**
		 * Dispose the webview.
		 */
    dispose(): any;
  }

  namespace window {
    /**
		 * Create and show a new webview.
		 *
		 * @param title Title of the webview.
		 * @param column Editor column to show the new webview in.
		 * @param options Webview content options.
		 */
    export function createWebview(
      title: string,
      column: ViewColumn,
      options: WebviewOptions
    ): Webview;
  }
}

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TraceFlagsRemover,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import { WorkspaceContext } from '../../context';
import { nls } from '../../messages';

/**
 * An enum for the different types of functions.
 */
export enum functionType {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  JAVA = 'java'
}

/**
 * A running task that can be terminated
 */
interface Terminable {
  terminate: () => Promise<void>;
}

/**
 * Tracking locally running functions
 */
export interface FunctionExecution extends Terminable {
  /**
   * root dir where project.toml is located
   */
  rootDir: string;
  /**
   * Local function port
   */
  port: number;
  /**
   * Debug port
   */
  debugPort: number;
  /**
   * Type of debug (node, java)
   */
  debugType: string;
  /**
   * Active debug session attached
   */
  debugSession?: vscode.DebugSession;
}

export class FunctionService {
  private static _instance: FunctionService;
  public static get instance() {
    if (FunctionService._instance === undefined) {
      FunctionService._instance = new FunctionService();
    }
    return FunctionService._instance;
  }

  private constructor() {}

  /**
   * Locate the directory that has project.toml.
   * If sourceFsPath is the function folder that has project.toml, or a subdirectory
   * or file within that folder, this method returns the function folder by recursively looking up.
   * Otherwise, it returns undefined.
   * @param sourceFsPath path to start function from
   */
  public static getFunctionDir(sourceFsPath: string) {
    let current = fs.lstatSync(sourceFsPath).isDirectory()
      ? sourceFsPath
      : path.dirname(sourceFsPath);
    const { root } = path.parse(sourceFsPath);
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    while (current !== rootWorkspacePath && current !== root) {
      const tomlPath = path.join(current, 'project.toml');
      if (fs.existsSync(tomlPath)) {
        return current;
      }
      current = path.dirname(current);
    }
    return undefined;
  }

  private startedExecutions: Map<string, FunctionExecution> = new Map();

  /**
   * Register started functions
   * Returns a disposable to unregister in case an error happens when starting function
   *
   * @returns {Disposable} disposable to unregister
   */
  public registerStartedFunction(
    functionExecution: FunctionExecution
  ): Disposable {
    this.startedExecutions.set(functionExecution.rootDir, functionExecution);
    return {
      dispose: () => {
        this.startedExecutions.delete(functionExecution.rootDir);
      }
    };
  }

  public updateFunction(rootDir: string, debugType: string): void {
    const functionExecution = this.getStartedFunction(rootDir);
    if (functionExecution) {
      const type = debugType.toLowerCase();
      if (type.startsWith('node')) {
        functionExecution.debugType = 'node';
      } else if (type.startsWith('java') || type.startsWith('jvm')) {
        functionExecution.debugType = 'java';
      }
    }
  }

  public isFunctionStarted() {
    return this.startedExecutions.size > 0;
  }

  /**
   * Returns the debugType of the first of the startedExecutions as a way to determine the language
   * of all running executions.
   * Current options: 'node', 'java'
   */
  public getFunctionLanguage() {
    const functionIterator = this.startedExecutions.values();
    if (functionIterator) {
      return functionIterator.next().value?.debugType;
    }
    return undefined;
  }

  /**
   * Get the type of function that is current running.
   * @returns FunctionType
   */
  public getFunctionType(): functionType {
    if (this.startedExecutions.size > 0) {
      const [rootDir] = this.startedExecutions.keys();

      if (fs.existsSync(`${rootDir}/tsconfig.json`)) {
        return functionType.TYPESCRIPT;
      } else if (fs.existsSync(`${rootDir}/package.json`)) {
        return functionType.JAVASCRIPT;
      }

      return functionType.JAVA;
    }

    throw new Error(nls.localize('error_function_type'));
  }

  /**
   * Stop all started function containers
   */
  public async stopFunction() {
    await Promise.all(
      [...this.startedExecutions.values()].map(functionExecution => {
        return functionExecution.terminate();
      })
    );
    this.startedExecutions.clear();
  }

  public getStartedFunction(rootDir: string) {
    return this.startedExecutions.get(rootDir);
  }

  /**
   * Start a debug session that attaches to the debug port of a locally running function.
   * Return if VS Code already has a debug session attached.
   * @param rootDir functions root directory
   */
  public async debugFunction(rootDir: string) {
    const functionExecution = this.getStartedFunction(rootDir);
    if (!functionExecution) {
      throw new Error(
        nls
          .localize('error_unable_to_get_started_function')
          .replace('{0}', rootDir)
      );
    }

    if (!functionExecution.debugSession) {
      const debugConfiguration = this.getDebugConfiguration(
        functionExecution,
        rootDir
      );

      await vscode.debug.startDebugging(
        workspaceUtils.getRootWorkspace(),
        debugConfiguration
      );
    }
  }

  /***
   * Create a DebugConfiguration object
   */
  public getDebugConfiguration(
    functionExecution: FunctionExecution,
    rootDir: string
  ): vscode.DebugConfiguration {
    const { debugPort, debugType } = functionExecution;
    const debugConfiguration: vscode.DebugConfiguration = {
      type: debugType,
      request: 'attach',
      name: 'Debug Invoke', // This name doesn't surface in UI
      resolveSourceMapLocations: ['**', '!**/node_modules/**'],
      console: 'integratedTerminal',
      internalConsoleOptions: 'openOnSessionStart',
      localRoot: rootDir,
      hostName: '127.0.0.1',
      port: debugPort
    };

    return debugConfiguration;
  }

  /**
   * Detach the debugger
   * @param rootDir functions root directory
   */
  public async stopDebuggingFunction(rootDir: string) {
    const functionExecution = this.getStartedFunction(rootDir);
    if (functionExecution) {
      const { debugSession } = functionExecution;
      await vscode.debug.stopDebugging(debugSession);
    }
  }

  /**
   * Register listeners for debug session start/stop events and keep track of active debug sessions
   * @param extensionContext extension context
   */
  public handleDidStartTerminateDebugSessions(
    extensionContext: vscode.ExtensionContext
  ) {
    const handleDidStartDebugSession = vscode.debug.onDidStartDebugSession(
      session => {
        const { configuration } = session;
        const { localRoot } = configuration;
        const functionExecution = this.getStartedFunction(localRoot);
        if (functionExecution) {
          functionExecution.debugSession = session;
        }
      }
    );
    const handleDidTerminateDebugSession = vscode.debug.onDidTerminateDebugSession(
      session => {
        const { configuration } = session;
        const { localRoot } = configuration;
        const functionExecution = this.getStartedFunction(localRoot);
        if (functionExecution) {
          functionExecution.debugSession = undefined;
        }

        (async () => {
          const connection = await WorkspaceContext.getInstance().getConnection();
          await TraceFlagsRemover.getInstance(connection).removeNewTraceFlags();
        })().catch(err => {
          throw err;
        });
      }
    );
    extensionContext.subscriptions.push(
      handleDidStartDebugSession,
      handleDidTerminateDebugSession
    );
  }
}

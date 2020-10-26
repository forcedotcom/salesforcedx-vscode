/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import { getRootWorkspace, getRootWorkspacePath } from '../../util';

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
   * root dir where function.toml is located
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

  /**
   * Locate the directory that has function.toml.
   * If sourceFsPath is the function folder that has function.toml, or a subdirectory
   * or file within that folder, this method returns the function folder by recursively looking up.
   * Otherwise, it returns undefined.
   * @param sourceFsPath path to start function from
   */
  public static getFunctionDir(sourceFsPath: string) {
    let current = fs.lstatSync(sourceFsPath).isDirectory()
      ? sourceFsPath
      : path.dirname(sourceFsPath);
    const { root } = path.parse(sourceFsPath);
    const rootWorkspacePath = getRootWorkspacePath();
    while (current !== rootWorkspacePath && current !== root) {
      const tomlPath = path.join(current, 'function.toml');
      if (fs.existsSync(tomlPath)) {
        return current;
      }
      current = path.dirname(current);
    }
    return undefined;
  }

  private startedExecutions: Map<string, FunctionExecution> = new Map();

  /**
   * Register started functions, in order to terminate the container.
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

  public isFunctionStarted() {
    return this.startedExecutions.size > 0;
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
    if (functionExecution) {
      const { debugPort } = functionExecution;
      const debugConfiguration: vscode.DebugConfiguration = {
        type: 'node',
        request: 'attach',
        name: 'Debug Invoke', // This name doesn't surface in UI
        resolveSourceMapLocations: ['**', '!**/node_modules/**'],
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        localRoot: rootDir,
        remoteRoot: '/workspace',
        port: debugPort
      };
      if (!functionExecution.debugSession) {
        await vscode.debug.startDebugging(
          getRootWorkspace(),
          debugConfiguration
        );
      }
    }
  }

  /**
   * Detach the debugger
   * @param rootDir functions root directory
   */
  public async stopDebuggingFunction(rootDir: string) {
    const functionExecution = this.getStartedFunction(rootDir);
    if (functionExecution) {
      const { debugSession } = functionExecution;
      await debugSession?.customRequest('disconnect');
      // When we update VS Code engine to 1.49 we should use stopDebugging
      // https://code.visualstudio.com/updates/v1_49
      // await vscode.debug.stopDebugging(debugSession);
    }
  }

  /**
   * Register listeners for debug session start/stop events and keep track of active debug sessions
   * @param context extension context
   */
  public handleDidStartTerminateDebugSessions(
    context: vscode.ExtensionContext
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
      }
    );
    context.subscriptions.push(
      handleDidStartDebugSession,
      handleDidTerminateDebugSession
    );
  }
}

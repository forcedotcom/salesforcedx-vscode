/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { spawn, ChildProcess } from 'node:child_process';
import * as vscode from 'vscode';

/**
 * Pseudoterminal that spawns Jest, displays output, and captures it for error extraction.
 */
export class JestPseudoterminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number | void>();
  private process?: ChildProcess;
  private capturedOutput: string = '';

  public readonly onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  public readonly onDidClose: vscode.Event<number | void> = this.closeEmitter.event;

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly options: {
      cwd: string;
      env?: NodeJS.ProcessEnv;
      shellOptions?: { executable: string; shellArgs: string[] };
    }
  ) {}

  public open(): void {
    let spawnCmd = this.command;
    let spawnArgs = this.args;
    const isWin32 = process.platform.startsWith('win32');

    if (isWin32 && this.options.shellOptions) {
      spawnCmd = this.options.shellOptions.executable;
      spawnArgs = [...this.options.shellOptions.shellArgs, this.command, ...this.args];
    }

    this.process = spawn(spawnCmd, spawnArgs, {
      cwd: this.options.cwd,
      env: this.options.env ?? process.env,
      shell: !isWin32 // Use shell on non-Windows platforms
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.capturedOutput += text;
      this.writeEmitter.fire(text);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.capturedOutput += text;
      this.writeEmitter.fire(text);
    });

    this.process.on('exit', code => {
      this.closeEmitter.fire(code ?? undefined);
    });

    this.process.on('error', err => {
      this.writeEmitter.fire(`\r\nError spawning process: ${err.message}\r\n`);
      this.closeEmitter.fire(1);
    });
  }

  public close(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  /**
   * Get all captured output (stdout + stderr combined).
   */
  public getCapturedOutput(): string {
    return this.capturedOutput;
  }

  /**
   * Extract file location from the first stack trace line.
   * Returns {file, line, column} if found, undefined otherwise.
   */
  public extractErrorLocation(): { file: string; line: number; column: number } | undefined {
    const lines = this.capturedOutput.split('\n');

    // Look for stack trace lines like:
    //   at SomeFunction (/path/to/file.js:123:45)
    //   at /path/to/file.js:123:45
    const stackTracePattern = /at (?:.*?\()?(.*?):(\d+):(\d+)\)?/;

    for (const line of lines) {
      const match = line.match(stackTracePattern);
      if (match) {
        const [, file, lineStr, columnStr] = match;
        return {
          file: file.trim(),
          line: parseInt(lineStr, 10),
          column: parseInt(columnStr, 10)
        };
      }
    }

    return undefined;
  }

  /**
   * Extract error message from Jest output for Test Explorer display.
   * Prioritizes error type patterns (TypeError, etc.) with stack traces, then FAIL lines, then last non-empty lines.
   */
  public extractErrorSummary(): string {
    const lines = this.capturedOutput.split('\n');
    const errorLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match specific error types with stack traces
      if (/^(TypeError|ReferenceError|SyntaxError|Error):/i.test(line.trim())) {
        errorLines.push(line.trim());
        // Include stack trace lines (up to 30 lines or until we hit summary section)
        let blankLineCount = 0;
        for (let j = 1; j <= 30 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].trim();
          // Stop at Jest summary section
          if (
            nextLine.startsWith('Test Suites:') ||
            nextLine.startsWith('Tests:') ||
            nextLine.startsWith('Snapshots:')
          ) {
            break;
          }
          // Allow blank lines but stop if we get too many consecutive blank lines
          if (!nextLine) {
            blankLineCount++;
            if (blankLineCount >= 2) {
              break; // Stop at 2 consecutive blank lines
            }
          } else {
            blankLineCount = 0;
          }
          errorLines.push(nextLine);
        }
        break;
      }

      // Match Jest FAIL or "Test suite failed to run" and capture subsequent error details
      if (line.includes('FAIL ') || line.includes('Test suite failed to run')) {
        errorLines.push(line.trim());
        // Continue capturing error details after FAIL line
        let blankLineCount = 0;
        for (let j = 1; j <= 50 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].trim();
          // Stop at Jest summary section
          if (
            nextLine.startsWith('Test Suites:') ||
            nextLine.startsWith('Tests:') ||
            nextLine.startsWith('Snapshots:')
          ) {
            break;
          }
          // Allow blank lines but stop if we get too many consecutive blank lines
          if (!nextLine) {
            blankLineCount++;
            if (blankLineCount >= 2) {
              break; // Stop at 2 consecutive blank lines
            }
          } else {
            blankLineCount = 0;
          }
          errorLines.push(nextLine);
        }
        break;
      }
    }

    if (errorLines.length > 0) {
      return errorLines.join('\n');
    }

    const nonEmptyLines = lines.filter(l => l.trim().length > 0).slice(-10);
    return nonEmptyLines.join('\n');
  }
}

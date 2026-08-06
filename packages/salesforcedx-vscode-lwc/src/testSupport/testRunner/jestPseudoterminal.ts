/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { spawn, ChildProcess } from 'node:child_process';
import * as vscode from 'vscode';

// Error extraction limits - keep context focused on the immediate error
const MAX_ERROR_STACK_LINES = 30; // Typical stack traces are 10-20 lines
const MAX_FAIL_CONTEXT_LINES = 50; // FAIL blocks can include test output
const MAX_CAPTURED_OUTPUT_KB = 100; // Prevent unbounded memory growth on verbose tests

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

    // Windows: Prepend cmd.exe (/d /c) to bypass Git Bash issues (GH#2097).
    // Non-Windows: Use shell: true for PATH resolution.
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
      this.capturedOutput = this.appendWithLimit(this.capturedOutput, text);
      this.writeEmitter.fire(text);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.capturedOutput = this.appendWithLimit(this.capturedOutput, text);
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
   * Append text to captured output with memory limit.
   * Keeps most recent output if limit exceeded.
   * Uses Buffer.byteLength to measure actual UTF-8 bytes, not UTF-16 code units.
   */
  private appendWithLimit(current: string, text: string): string {
    const combined = current + text;
    const maxBytes = MAX_CAPTURED_OUTPUT_KB * 1024;
    const byteLength = Buffer.byteLength(combined, 'utf8');
    if (byteLength > maxBytes) {
      // Slice by character count to stay under byte limit (approximation)
      // UTF-8 average is ~1.5 bytes/char for mixed content, so divide by 2 for safety margin
      const targetChars = Math.floor(maxBytes / 2);
      return combined.slice(-targetChars);
    }
    return combined;
  }

  /**
   * Collect lines following an error/fail marker until Jest summary or blank lines.
   * Shared logic for both error patterns and FAIL blocks.
   */
  private collectErrorContext(lines: string[], startIndex: number, maxLines: number): string[] {
    const errorLines: string[] = [lines[startIndex].trim()];
    let blankLineCount = 0;

    for (let j = 1; j <= maxLines && startIndex + j < lines.length; j++) {
      const nextLine = lines[startIndex + j].trim();
      if (nextLine.startsWith('Test Suites:') || nextLine.startsWith('Tests:') || nextLine.startsWith('Snapshots:')) {
        break;
      }
      if (!nextLine) {
        blankLineCount++;
        if (blankLineCount >= 2) {
          break;
        }
      } else {
        blankLineCount = 0;
      }
      errorLines.push(nextLine);
    }
    return errorLines;
  }

  /**
   * Extract error message from Jest output for Test Explorer display.
   * Prioritizes error type patterns (TypeError, etc.) with stack traces, then FAIL lines, then last non-empty lines.
   */
  public extractErrorSummary(): string {
    const lines = this.capturedOutput.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for specific JavaScript error types with stack traces
      if (/^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|Error):/i.test(line.trim())) {
        return this.collectErrorContext(lines, i, MAX_ERROR_STACK_LINES).join('\n');
      }

      // Look for Jest FAIL markers with test failure context
      if (line.includes('FAIL ') || line.includes('Test suite failed to run')) {
        return this.collectErrorContext(lines, i, MAX_FAIL_CONTEXT_LINES).join('\n');
      }
    }

    const nonEmptyLines = lines.filter(l => l.trim().length > 0).slice(-10);
    return nonEmptyLines.join('\n');
  }
}

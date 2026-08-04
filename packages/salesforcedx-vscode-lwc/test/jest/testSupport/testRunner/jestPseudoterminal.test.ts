/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JestPseudoterminal } from '../../../../src/testSupport/testRunner/jestPseudoterminal';
import * as child_process from 'node:child_process';
import { EventEmitter } from 'node:events';

jest.mock('node:child_process');

describe('JestPseudoterminal', () => {
  let mockProcess: any;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;

  beforeEach(() => {
    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();
    mockProcess = new EventEmitter();
    mockProcess.stdout = mockStdout;
    mockProcess.stderr = mockStderr;
    mockProcess.killed = false;
    mockProcess.kill = jest.fn();

    (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('open', () => {
    it('spawns process with shell: true on non-Windows platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      expect(child_process.spawn).toHaveBeenCalledWith('npm', ['test'], {
        cwd: '/test',
        env: process.env,
        shell: true
      });

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns process with cmd.exe on Windows when shellOptions provided', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const pty = new JestPseudoterminal('npm', ['test'], {
        cwd: 'C:\\test',
        shellOptions: { executable: 'cmd.exe', shellArgs: ['/d', '/c'] }
      });
      pty.open();

      expect(child_process.spawn).toHaveBeenCalledWith('cmd.exe', ['/d', '/c', 'npm', 'test'], {
        cwd: 'C:\\test',
        env: process.env,
        shell: false
      });

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('spawns process with shell: false on Windows (bypasses Git Bash)', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const pty = new JestPseudoterminal('npm', ['test'], {
        cwd: 'C:\\test',
        shellOptions: { executable: 'cmd.exe', shellArgs: ['/d', '/c'] }
      });
      pty.open();

      const spawnCall = (child_process.spawn as jest.Mock).mock.calls[0];
      expect(spawnCall[2].shell).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('captures stdout output', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      const outputs: string[] = [];
      pty.onDidWrite(data => outputs.push(data));

      pty.open();
      mockStdout.emit('data', Buffer.from('Test output\n'));

      setImmediate(() => {
        expect(outputs).toEqual(['Test output\n']);
        expect(pty.getCapturedOutput()).toBe('Test output\n');
        done();
      });
    });

    it('captures stderr output', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      const outputs: string[] = [];
      pty.onDidWrite(data => outputs.push(data));

      pty.open();
      mockStderr.emit('data', Buffer.from('Error output\n'));

      setImmediate(() => {
        expect(outputs).toEqual(['Error output\n']);
        expect(pty.getCapturedOutput()).toBe('Error output\n');
        done();
      });
    });

    it('captures combined stdout and stderr in order', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });

      pty.open();
      mockStdout.emit('data', Buffer.from('stdout line 1\n'));
      mockStderr.emit('data', Buffer.from('stderr line 1\n'));
      mockStdout.emit('data', Buffer.from('stdout line 2\n'));

      setImmediate(() => {
        expect(pty.getCapturedOutput()).toBe('stdout line 1\nstderr line 1\nstdout line 2\n');
        done();
      });
    });

    it('fires onDidClose with exit code when process exits', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.onDidClose(code => {
        expect(code).toBe(0);
        done();
      });

      pty.open();
      mockProcess.emit('exit', 0);
    });

    it('fires onDidClose with error exit code', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.onDidClose(code => {
        expect(code).toBe(1);
        done();
      });

      pty.open();
      mockProcess.emit('exit', 1);
    });

    it('fires onDidClose with exit code 1 on spawn error', done => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      const outputs: string[] = [];
      pty.onDidWrite(data => outputs.push(data));
      pty.onDidClose(code => {
        expect(code).toBe(1);
        expect(outputs.some(o => o.includes('Error spawning process'))).toBe(true);
        done();
      });

      pty.open();
      mockProcess.emit('error', new Error('ENOENT: command not found'));
    });
  });

  describe('close', () => {
    it('kills the process if not already killed', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      pty.close();

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('does not kill if process already killed', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();
      mockProcess.killed = true;

      pty.close();

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('extractErrorSummary', () => {
    it('extracts TypeError with stack trace', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
FAIL src/test.js
  TypeError: Cannot read property 'foo' of undefined
      at Object.<anonymous> (/path/to/test.js:10:5)
      at Module._compile (node:internal/modules/cjs/loader:1256:14)
      at Object.Module._extensions..js (node:internal/modules/cjs/loader:1310:10)

Test Suites: 1 failed, 1 total
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('TypeError: Cannot read property');
      expect(summary).toContain('at Object.<anonymous>');
      expect(summary).not.toContain('Test Suites:');
    });

    it('extracts ReferenceError with stack trace', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
ReferenceError: foo is not defined
    at /path/to/file.js:5:10
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('ReferenceError: foo is not defined');
      expect(summary).toContain('at /path/to/file.js:5:10');
    });

    it('extracts SyntaxError with stack trace', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
SyntaxError: Unexpected token '}'
    at wrapSafe (internal/modules/cjs/loader.js:1001:16)
    at Module._compile (internal/modules/cjs/loader.js:1049:27)
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('SyntaxError: Unexpected token');
      expect(summary).toContain('at wrapSafe');
    });

    it('extracts FAIL line with error details', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
FAIL src/components/myComponent/__tests__/myComponent.test.js
  ● Test suite failed to run

    Jest encountered an unexpected token
    Details about the error...

Test Suites: 1 failed, 1 total
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('FAIL src/components');
      expect(summary).toContain('Test suite failed to run');
      expect(summary).toContain('Jest encountered an unexpected token');
      expect(summary).not.toContain('Test Suites:');
    });

    it('stops at Jest summary section', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
TypeError: Cannot read property 'foo' of undefined
    at /path/to/test.js:10:5
    at Module._compile (node:internal/modules/cjs/loader:1256:14)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        1.234 s
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('TypeError');
      expect(summary).not.toContain('Test Suites:');
      expect(summary).not.toContain('Tests:');
      expect(summary).not.toContain('Time:');
    });

    it('stops at 2 consecutive blank lines', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
TypeError: Cannot read property 'foo' of undefined
    at /path/to/test.js:10:5


Some other unrelated output that should not be included
`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('TypeError');
      expect(summary).not.toContain('unrelated output');
    });

    it('returns last 10 non-empty lines when no error pattern found', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join('\n');
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('Line 11');
      expect(summary).toContain('Line 20');
      expect(summary).not.toContain('Line 10');
    });

    it('returns empty string when no output captured', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const summary = pty.extractErrorSummary();
      expect(summary).toBe('');
    });

    it('extracts error from stderr', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const output = `
Error: Module not found
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:880:15)
`;
      mockStderr.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      expect(summary).toContain('Error: Module not found');
      expect(summary).toContain('at Function.Module._resolveFilename');
    });

    it('limits stack trace to 30 lines', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      const stackLines = Array.from({ length: 50 }, (_, i) => `    at frame${i} (/path/file.js:${i}:1)`);
      const output = `TypeError: Test error\n${stackLines.join('\n')}`;
      mockStdout.emit('data', Buffer.from(output));

      const summary = pty.extractErrorSummary();
      const lines = summary.split('\n');
      expect(lines.length).toBeLessThanOrEqual(31); // 1 error line + 30 stack frames
    });
  });

  describe('getCapturedOutput', () => {
    it('returns all captured output', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      pty.open();

      mockStdout.emit('data', Buffer.from('stdout1\n'));
      mockStderr.emit('data', Buffer.from('stderr1\n'));
      mockStdout.emit('data', Buffer.from('stdout2\n'));

      expect(pty.getCapturedOutput()).toBe('stdout1\nstderr1\nstdout2\n');
    });

    it('returns empty string when no output captured', () => {
      const pty = new JestPseudoterminal('npm', ['test'], { cwd: '/test' });
      expect(pty.getCapturedOutput()).toBe('');
    });
  });
});

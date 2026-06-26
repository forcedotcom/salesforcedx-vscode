/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { resolveExecOptions } from '../../../src/terminal/childProcess';

describe('resolveExecOptions', () => {
  it('merges the env override over process.env so PATH survives', () => {
    process.env.CHILD_PROCESS_TEST_PARENT = 'parent-value';
    const { env } = resolveExecOptions({ timeout: 5, env: { SF_JSON_TO_STDOUT: 'true' } });
    // parent env key still present (PATH-survival proxy) AND override applied
    expect(env?.CHILD_PROCESS_TEST_PARENT).toBe('parent-value');
    expect(env?.SF_JSON_TO_STDOUT).toBe('true');
    // PATH survives — spread of process.env keeps the OS-native key casing (Path on Windows, PATH on posix),
    // so look it up case-insensitively rather than assuming the uppercase key.
    const pathEntry = Object.entries(env ?? {}).find(([key]) => key.toUpperCase() === 'PATH');
    expect(pathEntry?.[1]).toBe(process.env.PATH);
    delete process.env.CHILD_PROCESS_TEST_PARENT;
  });

  it('omits env entirely when no override is passed so node inherits the full parent env', () => {
    const resolved = resolveExecOptions({ timeout: 5 });
    expect('env' in resolved).toBe(false);
    expect(resolved.timeout).toBe(5);
  });
});

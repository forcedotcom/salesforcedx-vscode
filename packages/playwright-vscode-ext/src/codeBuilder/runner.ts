/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * The command-runner seam. Every container-facing utility shells out through this instead of calling
 * execFileSync directly, so unit tests inject a fake that records argv (asserting the exact
 * `docker cp …` a utility builds) with no real docker. The default is the real execFileSync, using
 * arg arrays — never a shell string — so no argument is shell-interpreted (#7718 idiom).
 *
 * Plain function, not an Effect service: a team not on Effect can still use every utility. This repo
 * may wrap it as a layer, but the seam itself imposes no Effect dependency.
 */

import { execFileSync } from 'node:child_process';

/** Runs a command with an argv array and returns stdout as a string. Throws on non-zero exit. */
export type CommandRunner = (file: string, args: readonly string[]) => string;

/** Default runner: real process execution, arg-array form (no shell interpolation). */
export const defaultRunner: CommandRunner = (file, args) => execFileSync(file, args as string[], { encoding: 'utf-8' });

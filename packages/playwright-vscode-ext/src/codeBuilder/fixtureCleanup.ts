/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Remove paths from inside the container as the owning user. A spec that scaffolds files through an
 * in-container command (e.g. "Create Sample Analytics Template") writes them as the image's runtime
 * user (`codebuilder`), NOT the host/CI uid. A host-side node:fs remove of those paths through the
 * bind mount then fails with EACCES because the host uid does not own them — so the scaffolded
 * metadata is left behind and poisons later specs that deploy the shared fixture. Deleting IN the
 * container as that same user is the reliable cleanup, so afterEach leaves the fixture as found.
 */

import { defaultRunner, type CommandRunner } from './runner';

/** The Code Builder image's runtime user — owns anything an in-container command scaffolds. */
export const CONTAINER_USER = 'codebuilder';

export type RemovePathsInContainerOptions = {
  /** Container user that owns the paths. Defaults to CONTAINER_USER (the image's runtime user). */
  user?: string;
  /** Command runner (injectable for tests). Defaults to real docker via execFileSync. */
  runner?: CommandRunner;
};

/*
 * `docker exec -u <user> <container> rm -rf -- <paths…>`. Each path is a single argv token (no shell,
 * so any characters are safe), `--` guards a path that begins with '-', and `-rf` makes an
 * already-absent path a no-op so the call is idempotent. A no-op when `paths` is empty. Throws on a
 * real docker failure (container gone, wrong name) so a failed cleanup is loud rather than silently
 * leaving fixture contamination behind.
 */
export const removePathsInContainer = (
  containerName: string,
  paths: readonly string[],
  options: RemovePathsInContainerOptions = {}
): void => {
  if (paths.length === 0) {
    return;
  }
  const runner = options.runner ?? defaultRunner;
  const user = options.user ?? CONTAINER_USER;
  runner('docker', ['exec', '-u', user, containerName, 'rm', '-rf', '--', ...paths]);
};

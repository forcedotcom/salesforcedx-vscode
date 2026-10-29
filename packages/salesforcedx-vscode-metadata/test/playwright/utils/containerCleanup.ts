/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container-only cleanup for throwaway metadata a spec creates on the shared, persistent Code Builder
 * workbench. Without it every run piles classes into force-app/main/default/classes, which (a) grows
 * the Explorer until VS Code's sticky-scroll header covers the "classes" folder row that context-menu
 * specs right-click, and (b) leaves local changes that later specs' folder deploys/diffs pick up.
 * Desktop needs none of this: each test gets a fresh project.
 *
 * Files created through the workbench are owned by the container's `codebuilder` user, so everything
 * runs inside the container (see removePathsInContainer).
 */

import { deleteSourceInContainer, removePathsInContainer } from '@salesforce/playwright-vscode-ext';
import { posix } from 'node:path';

const CLASSES_DIR = ['force-app', 'main', 'default', 'classes'];

/** Container name and the CONTAINER side of the fixture bind mount, published by the orchestrator. */
const containerEnv = (): { containerName: string; fixtureDir: string } => {
  const containerName = process.env.CB_CONTAINER_NAME;
  const fixtureDir = process.env.CB_FIXTURE_CONTAINER_DIR;
  if (!containerName || !fixtureDir) {
    throw new Error(
      'CB_CONTAINER_NAME / CB_FIXTURE_CONTAINER_DIR is not set — the orchestrator ' +
        '(scripts/codeBuilderLocalE2E.ts) must publish them so the spec can clean up inside the container.'
    );
  }
  return { containerName, fixtureDir };
};

/**
 * Delete Apex classes from the project AND the container's default org (updating source tracking), so
 * a later spec sees neither the files nor a pending local change. A class that never reached the org
 * (the test failed before deploying it) makes the org delete fail; its files are then removed directly,
 * which also clears its local-add from tracking.
 */
export const cleanupContainerApexClasses = (classNames: readonly string[]): void => {
  if (classNames.length === 0) {
    return;
  }
  const { containerName, fixtureDir } = containerEnv();
  try {
    deleteSourceInContainer(
      containerName,
      fixtureDir,
      classNames.map(name => `ApexClass:${name}`)
    );
  } catch (error) {
    console.warn(`Org delete of ${classNames.join(', ')} failed; removing the local files only: ${String(error)}`);
  }
  const classPaths = classNames.map(name => posix.join(fixtureDir, ...CLASSES_DIR, `${name}.cls`));
  removePathsInContainer(
    containerName,
    classPaths.flatMap(classPath => [classPath, `${classPath}-meta.xml`])
  );
};

/** Remove generated files (e.g. manifests) under the fixture project; `relativePaths` are posix, project-relative. */
export const cleanupContainerFiles = (relativePaths: readonly string[]): void => {
  if (relativePaths.length === 0) {
    return;
  }
  const { containerName, fixtureDir } = containerEnv();
  removePathsInContainer(
    containerName,
    relativePaths.map(relativePath => posix.join(fixtureDir, relativePath))
  );
};

/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Folder that "SFDX: Create Project" scaffolds into, as seen by the folder dialog and by the host. */
export type ProjectTarget = {
  /** Path typed into the simple folder dialog (in-container path on Code Builder). */
  dialogDir: string;
  /** Path separator the dialog expects after `dialogDir`. */
  dialogSep: string;
  /** The same folder on the host, for on-disk asserts. */
  hostDir: string;
  /** Delete a scaffolded project (no-op where the folder is a throwaway temp dir). */
  removeProject: (projectName: string) => void;
};

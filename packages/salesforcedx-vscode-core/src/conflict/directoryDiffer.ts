/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DirectoryDiffResults {
  different: Set<string>;
  localRoot: string;
  remoteRoot: string;
  scannedLocal: number;
  scannedRemote: number;
}

export interface DirectoryDiffer {
  diff(localSourcePath: string, remoteSourcePath: string): DirectoryDiffResults;
}

interface FileStats {
  filename: string;
  subdir: string;
  relPath: string;
}

export class CommonDirDirectoryDiffer implements DirectoryDiffer {
  constructor() {}

  public diff(
    localSourcePath: string,
    remoteSourcePath: string
  ): DirectoryDiffResults {
    const localSet = this.listFiles(localSourcePath);
    const different = new Set<string>();

    // process remote files to generate differences
    let scannedRemote = 0;
    this.walkFiles(remoteSourcePath, '', stats => {
      scannedRemote++;
      if (localSet.has(stats.relPath)) {
        const file1 = path.join(localSourcePath, stats.relPath);
        const file2 = path.join(remoteSourcePath, stats.relPath);
        if (this.filesDiffer(file1, file2)) {
          different.add(stats.relPath);
        }
      }
    });

    return {
      localRoot: localSourcePath,
      remoteRoot: remoteSourcePath,
      different,
      scannedLocal: localSet.size,
      scannedRemote
    } as DirectoryDiffResults;
  }

  private filesDiffer(one: string, two: string): boolean {
    const buffer1 = fs.readFileSync(one);
    const buffer2 = fs.readFileSync(two);
    return !buffer1.equals(buffer2);
  }

  private listFiles(root: string): Set<string> {
    const results = new Set<string>();
    this.walkFiles(root, '', stats => {
      results.add(stats.relPath);
    });
    return results;
  }

  private walkFiles(
    root: string,
    subdir: string,
    callback: (stats: FileStats) => void
  ) {
    const fullDir = path.join(root, subdir);
    const subdirList = fs.readdirSync(fullDir);

    subdirList.forEach(filename => {
      const fullPath = path.join(fullDir, filename);
      const stat = fs.statSync(fullPath);
      const relPath = path.join(subdir, filename);

      if (stat && stat.isDirectory()) {
        this.walkFiles(root, relPath, callback);
      } else {
        callback({ filename, subdir, relPath });
      }
    });
  }
}

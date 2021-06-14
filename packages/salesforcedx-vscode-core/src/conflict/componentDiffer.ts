/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve/lib/src/resolve';
import * as fs from 'fs';
import * as path from 'path';

export interface CompDiff {
  one: string;
  two: string;
}

export class ComponentDiffer {
  constructor() {}

  public diff(
    project: SourceComponent[],
    cache: SourceComponent[]
  ): CompDiff[] {
    const projectIndex = new Map<string, SourceComponent>();
    for (const comp of project) {
      projectIndex.set(this.makeKey(comp), comp);
    }

    const cacheIndex = new Map<string, SourceComponent>();
    for (const comp of cache) {
      cacheIndex.set(this.makeKey(comp), comp);
    }

    const different: CompDiff[] = [];
    projectIndex.forEach((one, key) => {
      const two = cacheIndex.get(key);
      if (two) {
        const diffs = this.diffComponents(one, two);
        different.push(...diffs);
      }
    });
    return different;
  }

  private diffComponents(
    oneComp: SourceComponent,
    twoComp: SourceComponent
  ): CompDiff[] {
    const diffs: CompDiff[] = [];

    const oneIndex = new Map<string, string>();
    const onePaths = oneComp.walkContent();
    if (oneComp.xml) {
      onePaths.push(oneComp.xml);
    }
    for (const f of onePaths) {
      // NOTE: not sure this holds for static resources
      const key = path.basename(f);
      oneIndex.set(key, f);
    }

    const twoIndex = new Map<string, string>();
    const twoPaths = twoComp.walkContent();
    if (twoComp.xml) {
      twoPaths.push(twoComp.xml);
    }
    for (const f of twoPaths) {
      // NOTE: not sure this holds for static resources
      const key = path.basename(f);
      twoIndex.set(key, f);
    }

    oneIndex.forEach((onePath, key) => {
      const twoPath = twoIndex.get(key);
      if (twoPath && this.filesDiffer(onePath, twoPath)) {
        diffs.push({ one: onePath, two: twoPath });
      }
    });

    return diffs;
  }

  private makeKey(comp: SourceComponent): string {
    return `${comp.type.id}#${comp.fullName}`;
  }

  private filesDiffer(onePath: string, twoPath: string): boolean {
    const oneBuffer = fs.readFileSync(onePath);
    const twoBuffer = fs.readFileSync(twoPath);
    return !oneBuffer.equals(twoBuffer);
  }
}

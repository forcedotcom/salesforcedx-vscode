/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getFullClassName } from '../utils/toolingTestClassHelpers';
import { apexTestingClassUri, OWNER } from './apexTestingClassUri';

const CLASSES_ROOT = 'classes';

/**
 * Persists discovered Apex test classes through FsService. Services owns the provider, scheme, and
 * org lifecycle; this owner only supplies its relative subtree.
 */
export class ApexTestDiscoveryService extends Effect.Service<ApexTestDiscoveryService>()('ApexTestDiscoveryService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const saveDiscoveredClasses = Effect.fn('ApexTestDiscoveryService.saveDiscoveredClasses')(function* (
      orgKey: string,
      classes: readonly ToolingTestClass[],
      classBodiesByFullName: ReadonlyMap<string, string>
    ) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const fsService = yield* api.services.FsService;
      yield* fsService.clearOrgData({ orgKey, owner: OWNER });
      const ownerRoot = api.services.orgDataOwnerRoot({ orgKey, owner: OWNER });
      const classesRoot = api.services.orgDataUri({ orgKey, owner: OWNER, segments: [CLASSES_ROOT] });
      yield* fsService.createOrgDataDir(ownerRoot);
      yield* fsService.createOrgDataDir(classesRoot);
      yield* Effect.forEach(
        classes.map(getFullClassName),
        fullClassName => {
          const classUri = apexTestingClassUri(api, orgKey, fullClassName);
          const content =
            classBodiesByFullName.get(fullClassName) ??
            nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName);
          return fsService
            .createOrgDataDir(Utils.dirname(classUri))
            .pipe(Effect.andThen(fsService.writeOrgData(classUri, content)));
        },
        { discard: true }
      );
      yield* Effect.log('persisted discovered classes', { orgKey, count: classes.length });
    });

    return { saveDiscoveredClasses };
  })
}) {}

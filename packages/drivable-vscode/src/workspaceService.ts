/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as Effect from 'effect/Effect';
import { causeMessage, DrivableVscodeWorkspaceError } from './errors';

export class WorkspaceService extends Effect.Service<WorkspaceService>()('DrivableVscode/WorkspaceService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const writeSeed = Effect.fn('WorkspaceService.writeSeed')(function* (
      workspaceDir: string,
      relativePath: string,
      contents: string
    ) {
      const filePath = path.join(workspaceDir, relativePath);
      yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
      yield* fs.writeFileString(filePath, contents);
    });
    const create = Effect.fn('WorkspaceService.create')(function* (orgAlias?: string) {
      const workspaceDir = yield* fs.makeTempDirectory({ prefix: 'salesforce-drivable-vscode-' }).pipe(
        Effect.mapError(
          cause =>
            new DrivableVscodeWorkspaceError({
              message: 'Failed to create disposable workspace',
              cause: causeMessage(cause)
            })
        )
      );
      const project = {
        packageDirectories: [{ path: 'force-app', default: true }],
        namespace: '',
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: '64.0'
      };
      const writes = [
        writeSeed(workspaceDir, 'sfdx-project.json', `${JSON.stringify(project, undefined, 2)}\n`),
        writeSeed(workspaceDir, '.forceignore', '**/jsconfig.json\n**/.eslintrc.json\n**/__tests__/**\n'),
        ...(orgAlias
          ? [
              writeSeed(
                workspaceDir,
                '.sf/config.json',
                `${JSON.stringify({ 'target-org': orgAlias }, undefined, 2)}\n`
              )
            ]
          : []),
        writeSeed(
          workspaceDir,
          'config/project-scratch-def.json',
          `${JSON.stringify({ orgName: 'Drivable VS Code', edition: 'Developer' }, undefined, 2)}\n`
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/classes/DrivableVscodeController.cls',
          "public with sharing class DrivableVscodeController {\n    @AuraEnabled(cacheable=true)\n    public static String greeting() {\n        return 'Hello from drivable VS Code';\n    }\n}\n"
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/classes/DrivableVscodeController.cls-meta.xml',
          '<?xml version="1.0" encoding="UTF-8"?>\n<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>64.0</apiVersion><status>Active</status></ApexClass>\n'
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/aura/drivableVscodeCard/drivableVscodeCard.cmp',
          '<aura:component><lightning:card title="Drivable VS Code"><p class="slds-p-around_small">Ready for exploration</p></lightning:card></aura:component>\n'
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/lwc/drivableVscodeCard/drivableVscodeCard.html',
          '<template><lightning-card title="Drivable VS Code"><p class="slds-p-around_small">{message}</p></lightning-card></template>\n'
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/lwc/drivableVscodeCard/drivableVscodeCard.js',
          "import { LightningElement } from 'lwc';\n\nexport default class DrivableVscodeCard extends LightningElement {\n    message = 'Ready for exploration';\n}\n"
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/lwc/drivableVscodeCard/drivableVscodeCard.js-meta.xml',
          '<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>64.0</apiVersion><isExposed>true</isExposed></LightningComponentBundle>\n'
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/pages/DrivableVscode.page',
          '<apex:page controller="DrivableVscodeController"><apex:pageMessages/><h1>Drivable VS Code</h1></apex:page>\n'
        ),
        writeSeed(
          workspaceDir,
          'force-app/main/default/pages/DrivableVscode.page-meta.xml',
          '<?xml version="1.0" encoding="UTF-8"?>\n<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>64.0</apiVersion><availableInTouch>true</availableInTouch><confirmationTokenRequired>false</confirmationTokenRequired><label>Drivable VS Code</label></ApexPage>\n'
        ),
        writeSeed(workspaceDir, 'queries/accounts.soql', 'SELECT Id, Name FROM Account ORDER BY Name LIMIT 10\n')
      ];
      yield* Effect.all(writes, { concurrency: 'unbounded' }).pipe(
        Effect.mapError(cause =>
          cause instanceof DrivableVscodeWorkspaceError
            ? cause
            : new DrivableVscodeWorkspaceError({
                message: 'Failed to populate disposable workspace',
                cause: causeMessage(cause)
              })
        ),
        Effect.tapError(() => fs.remove(workspaceDir, { recursive: true }))
      );
      return workspaceDir;
    });
    return { create };
  })
}) {}

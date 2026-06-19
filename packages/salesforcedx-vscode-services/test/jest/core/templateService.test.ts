/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgConfigProperties } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as SfTemplates from '@salesforce/templates';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { ConfigService } from '../../../src/core/configService';
import { ConnectionService } from '../../../src/core/connectionService';
import { ProjectService } from '../../../src/core/projectService';
import { TemplateService } from '../../../src/core/templateService';

jest.mock('@salesforce/templates');
jest.mock('node:fs');

const vscode = require('vscode');

const mockCreate = jest.fn();

const mockExtensionUri = URI.file('/ext');

const ORG_CUSTOM_METADATA_TEMPLATES_KEY: string = OrgConfigProperties.ORG_CUSTOM_METADATA_TEMPLATES;

const createMockConfigService = (templateDir?: string): Layer.Layer<ConfigService> =>
  Layer.succeed(
    ConfigService,
    ConfigService.make({
      getConfigAggregator: () =>
        Effect.succeed({
          getPropertyValue: (prop: string) => (prop === ORG_CUSTOM_METADATA_TEMPLATES_KEY ? templateDir : undefined),
          getConfig: () => ({}),
          reload: () => Promise.resolve({})
        } as unknown as ConfigAggregator),
      invalidateConfigAggregator: () => Effect.void,
      getTargetDevHub: () => Effect.succeed(undefined),
      isCurrentTargetOrg: () => Effect.succeed(false),
      isCurrentTargetDevHub: () => Effect.succeed(false),
      unsetTargetOrg: () => Effect.void,
      unsetTargetDevHub: () => Effect.void
    })
  );

const createFailingConfigService = (): Layer.Layer<ConfigService> =>
  Layer.succeed(
    ConfigService,
    ConfigService.make({
      getConfigAggregator: () =>
        Effect.fail(
          new Error(
            'config unavailable'
          ) as unknown as import('../../../src/core/configService').FailedToCreateConfigAggregatorError
        ),
      invalidateConfigAggregator: () => Effect.void,
      getTargetDevHub: () => Effect.succeed(undefined),
      isCurrentTargetOrg: () => Effect.succeed(false),
      isCurrentTargetDevHub: () => Effect.succeed(false),
      unsetTargetOrg: () => Effect.void,
      unsetTargetDevHub: () => Effect.void
    })
  );

const createMockProjectService = (): Layer.Layer<ProjectService> => {
  const mockSfProject = {
    retrieveSfProjectJson: () => Promise.resolve({ get: () => '60.0' })
  } as unknown as import('@salesforce/core').SfProject;
  return Layer.succeed(
    ProjectService,
    ProjectService.make({
      isSalesforceProject: () => Effect.succeed(true),
      getSfProject: () => Effect.succeed(mockSfProject),
      isInPackageDirectories: () => Effect.succeed(true),
      ensureInPackageDirectories: () => Effect.void,
      getSoqlMetadataPath: () => Effect.succeed(URI.file('/test/soql')),
      getSoqlStandardObjectsPath: () => Effect.succeed(URI.file('/test/soql/std')),
      getSoqlCustomObjectsPath: () => Effect.succeed(URI.file('/test/soql/custom')),
      getFauxClassesPath: () => Effect.succeed(URI.file('/test/faux')),
      getFauxStandardObjectsPath: () => Effect.succeed(URI.file('/test/faux/std')),
      getFauxCustomObjectsPath: () => Effect.succeed(URI.file('/test/faux/custom')),
      getTypingsPath: () => Effect.succeed(URI.file('/test/.sfdx/typings'))
    })
  );
};

const createMockConnectionService = (): Layer.Layer<ConnectionService> =>
  Layer.succeed(
    ConnectionService,
    ConnectionService.make({
      getConnection: () => Effect.succeed({ version: '60.0' } as unknown as import('@salesforce/core').Connection),
      invalidateCachedConnections: () => Effect.void,
      listAllAuthorizations: () => Effect.succeed([])
    })
  );

const createTestLayer = (configLayer: Layer.Layer<ConfigService>) => {
  const deps = Layer.mergeAll(createMockProjectService(), createMockConnectionService(), configLayer);
  return Layer.provideMerge(TemplateService.Default, deps);
};

const baseParams = {
  cwd: '/test-project',
  templateType: SfTemplates.TemplateType.ApexClass,
  options: { template: 'DefaultApexClass', classname: 'MyClass' }
} as const;

describe('TemplateService', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ created: ['MyClass.cls'] });
    (SfTemplates.TemplateService.getInstance as jest.Mock).mockReturnValue({ create: mockCreate });
    vscode.extensions = {
      getExtension: jest.fn().mockReturnValue({ extensionUri: mockExtensionUri })
    };
  });

  it('passes custom templates path when ORG_CUSTOM_METADATA_TEMPLATES is set', async () => {
    const layer = createTestLayer(createMockConfigService('/my/custom/templates'));

    await Effect.runPromise(
      TemplateService.create(baseParams as Parameters<typeof TemplateService.create>[0]).pipe(Effect.provide(layer))
    );

    expect(mockCreate).toHaveBeenCalledWith(
      SfTemplates.TemplateType.ApexClass,
      expect.objectContaining({ classname: 'MyClass' }),
      '/my/custom/templates'
    );
  });

  it('passes undefined when ORG_CUSTOM_METADATA_TEMPLATES is not set', async () => {
    const layer = createTestLayer(createMockConfigService(undefined));

    await Effect.runPromise(
      TemplateService.create(baseParams as Parameters<typeof TemplateService.create>[0]).pipe(Effect.provide(layer))
    );

    expect(mockCreate).toHaveBeenCalledWith(
      SfTemplates.TemplateType.ApexClass,
      expect.objectContaining({ classname: 'MyClass' }),
      undefined
    );
  });

  it('falls back to undefined when getConfigAggregator fails', async () => {
    const layer = createTestLayer(createFailingConfigService());

    await Effect.runPromise(
      TemplateService.create(baseParams as Parameters<typeof TemplateService.create>[0]).pipe(Effect.provide(layer))
    );

    expect(mockCreate).toHaveBeenCalledWith(
      SfTemplates.TemplateType.ApexClass,
      expect.objectContaining({ classname: 'MyClass' }),
      undefined
    );
  });
});

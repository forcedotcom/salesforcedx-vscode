/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigAggregator, SfProject } from '@salesforce/core';
import { ComponentSet, RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { ComponentSetService, FailedToBuildComponentSetError } from '../../../src/core/componentSetService';
import { ConfigService } from '../../../src/core/configService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { ProjectService } from '../../../src/core/projectService';

const MEMBER_COUNT = 3135;

const makeComponentSetServiceLayer = ({
  registryAccess,
  project,
  configAggregator
}: {
  registryAccess: RegistryAccess;
  project: SfProject;
  configAggregator: ConfigAggregator;
}) =>
  Layer.provide(
    ComponentSetService.DefaultWithoutDependencies,
    Layer.mergeAll(
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(registryAccess)
      } as unknown as MetadataRegistryService),
      Layer.succeed(ProjectService, { getSfProject: () => Effect.succeed(project) } as unknown as ProjectService),
      Layer.succeed(ConfigService, {
        getConfigAggregator: () => Effect.succeed(configAggregator)
      } as unknown as ConfigService)
    )
  );

describe('ComponentSetService.getComponentSetFromManifest', () => {
  let testDirectory: string;

  beforeAll(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'component-set-service-'));
  });

  afterAll(async () => {
    await rm(testDirectory, { recursive: true });
  });

  it('retains every member when ComponentSet.fromManifest overflows', async () => {
    const fromManifest = jest
      .spyOn(ComponentSet, 'fromManifest')
      .mockRejectedValue(new RangeError('Maximum call stack size exceeded'));
    const manifestPath = join(testDirectory, 'package.xml');
    const packageDirectory = join(testDirectory, 'force-app');
    const classesDirectory = join(packageDirectory, 'main', 'default', 'classes');
    await mkdir(classesDirectory, { recursive: true });
    await writeFile(join(classesDirectory, 'LocalClass.cls'), 'public class LocalClass {}');
    await writeFile(
      join(classesDirectory, 'LocalClass.cls-meta.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
    );
    const memberNames = [...Array.from({ length: MEMBER_COUNT - 1 }, (_, index) => `Example${index}`), '*'];
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    ${memberNames.map(member => `<members>${member}</members>`).join('\n    ')}
    <name>ApexClass</name>
  </types>
  <version>67.0</version>
</Package>`;
    await writeFile(manifestPath, manifest);

    const registryAccess = new RegistryAccess();
    const project = {
      getPackageDirectories: () => [{ fullPath: packageDirectory }],
      getPath: () => testDirectory,
      retrieveSfProjectJson: () => Promise.resolve({ get: () => undefined })
    } as unknown as SfProject;
    const configAggregator = {
      getPropertyValue: () => undefined
    } as unknown as ConfigAggregator;
    const layer = makeComponentSetServiceLayer({ registryAccess, project, configAggregator });

    const componentSet = await Effect.runPromise(
      ComponentSetService.getComponentSetFromManifest(URI.file(manifestPath)).pipe(Effect.provide(layer))
    );

    expect(fromManifest).not.toHaveBeenCalled();
    expect(Array.from(componentSet, component => component.fullName)).toEqual([...memberNames, 'LocalClass']);
    expect(Array.from(componentSet.getSourceComponents(), component => component.fullName)).toEqual(['LocalClass']);
    expect(componentSet.sourceApiVersion).toBe('67.0');
    expect(componentSet.projectDirectory).toBe(testDirectory);
  });

  it('preserves BotVersion conversion and filters', async () => {
    const manifestPath = join(testDirectory, 'bot-package.xml');
    await writeFile(
      manifestPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>SpecificBot.v4</members>
    <members>AllBot.*</members>
    <members>HighestBot.unknown</members>
    <members>PlainBot</members>
    <name>BotVersion</name>
  </types>
  <version>67.0</version>
</Package>`
    );

    const registryAccess = new RegistryAccess();
    const project = {
      getPackageDirectories: () => [],
      getPath: () => testDirectory,
      retrieveSfProjectJson: () => Promise.resolve({ get: () => '66.0' })
    } as unknown as SfProject;
    const configAggregator = { getPropertyValue: () => '65.0' } as unknown as ConfigAggregator;
    const layer = makeComponentSetServiceLayer({ registryAccess, project, configAggregator });

    const componentSet = await Effect.runPromise(
      ComponentSetService.getComponentSetFromManifest(URI.file(manifestPath)).pipe(Effect.provide(layer))
    );

    expect(Array.from(componentSet, component => component.fullName)).toEqual([
      'SpecificBot',
      'AllBot',
      'HighestBot',
      'PlainBot'
    ]);
    expect(componentSet.botVersionFilters).toEqual([
      { botName: 'SpecificBot', versionFilter: 4 },
      { botName: 'AllBot', versionFilter: 'all' },
      { botName: 'HighestBot', versionFilter: 'highest' },
      { botName: 'PlainBot', versionFilter: 'highest' }
    ]);
    expect(componentSet.apiVersion).toBe('65.0');
    expect(componentSet.sourceApiVersion).toBe('66.0');
  });

  it('maps manifest parsing failures to FailedToBuildComponentSetError', async () => {
    const manifestPath = join(testDirectory, 'invalid-package.xml');
    await writeFile(manifestPath, '<Package>');

    const registryAccess = new RegistryAccess();
    const project = {
      getPackageDirectories: () => [],
      getPath: () => testDirectory,
      retrieveSfProjectJson: () => Promise.resolve({ get: () => undefined })
    } as unknown as SfProject;
    const configAggregator = { getPropertyValue: () => undefined } as unknown as ConfigAggregator;
    const layer = makeComponentSetServiceLayer({ registryAccess, project, configAggregator });

    const error = await Effect.runPromise(
      ComponentSetService.getComponentSetFromManifest(URI.file(manifestPath)).pipe(Effect.flip, Effect.provide(layer))
    );

    expect(error).toBeInstanceOf(FailedToBuildComponentSetError);
    expect(error.message).toContain('Failed to build ComponentSet from manifest: Invalid manifest file:');
  });
});

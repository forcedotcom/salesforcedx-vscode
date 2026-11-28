/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProjectJson, type SfProject, type Connection } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import * as SfTemplates from '@salesforce/templates';
import {
  ConfigService,
  ConnectionService,
  FailedToCreateConfigAggregatorError,
  NoWorkspaceOpenError,
  ProjectService,
  TemplateService
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as nodeFs from 'node:fs';
import { relative } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { TemplateMessages } from '../../../src/services/templateMessages.js';
import { TemplateServiceLayer } from '../../../src/services/templateService.js';

vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof nodeFs>()),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));
const messages: TemplateMessages['Service'] = {
  extensionUnavailable: 'Extension context not available',
  manifestLoadFailed: cause => `Manifest load failed: ${cause}`,
  manifestParseFailed: 'Manifest parse failed',
  fileCopyFailed: (path, cause) => `Copy failed: ${path}: ${cause}`,
  missingSourceApiVersion: 'sourceApiVersion is not defined'
};
const output: SfTemplates.CreateOutput = {
  created: ['MyClass.cls'],
  outputDir: '/project',
  rawOutput: 'Created MyClass'
};
const sdk = new SfTemplates.TemplateService('/initial');
const params = {
  cwd: '/project',
  templateType: SfTemplates.TemplateType.ApexClass,
  options: { template: 'CustomClass', classname: 'MyClass' }
} as const;
let customPath: string | undefined;
let configFails: boolean;
let projectFails: boolean;
let connectionFails: boolean;
const projectJson = new SfProjectJson();
const project = { retrieveSfProjectJson: () => Promise.resolve(projectJson) } as SfProject;
const connection = { version: '68.0' } as Connection;
beforeEach(() => {
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  customPath = undefined;
  configFails = false;
  projectFails = false;
  connectionFails = false;
  projectJson.setContentsFromObject({ packageDirectories: [{ path: 'force-app' }], sourceApiVersion: '67.0' });
  vi.spyOn(project, 'retrieveSfProjectJson').mockResolvedValue(projectJson);
  vi.spyOn(SfTemplates.TemplateService, 'getInstance').mockReturnValue(sdk);
  vi.spyOn(sdk, 'create').mockResolvedValue(output);
  vi.spyOn(SfTemplates.CreateUtil, 'getCommandTemplatesForFiletype').mockReturnValue(['DefaultApexClass']);
  vi.spyOn(SfTemplates.CreateUtil, 'getCommandTemplatesInSubdirs').mockReturnValue(['default', 'typeScript']);
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    extensionUri: URI.file('/extension')
  } as vscode.Extension<unknown>);
  vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('[]'));
  vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const graph = () =>
  TemplateServiceLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(TemplateMessages, messages),
        Layer.mock(ProjectService, {
          getSfProject: () =>
            projectFails ? Effect.fail(new NoWorkspaceOpenError({ message: 'no project' })) : Effect.succeed(project)
        }),
        Layer.mock(ConnectionService, {
          getConnection: () =>
            connectionFails
              ? Effect.fail(new NoWorkspaceOpenError({ message: 'no connection' }))
              : Effect.succeed(connection)
        }),
        Layer.mock(ConfigService, {
          getConfigAggregator: () =>
            configFails
              ? Effect.fail(new FailedToCreateConfigAggregatorError({ message: 'no config' }))
              : Effect.succeed({ getPropertyValue: () => customPath } as unknown as ConfigAggregator)
        })
      )
    )
  );
const makeRuntime = () => ManagedRuntime.make(graph());

it.each(['/custom/templates', undefined])(
  'preserves native output, custom template names/path and project API version: %s',
  async path => {
    customPath = path;
    const runtime = makeRuntime();
    try {
      expect(await runtime.runPromise(TemplateService.use(service => service.create(params)))).toBe(output);
      expect(sdk.create).toHaveBeenCalledExactlyOnceWith(
        params.templateType,
        { ...params.options, apiversion: '67.0' },
        path
      );
      expect(SfTemplates.TemplateService.getInstance).toHaveBeenCalledExactlyOnceWith('/project', {
        templatesRootPath: URI.file('/extension/dist/templates').fsPath,
        fs: nodeFs
      });
    } finally {
      await runtime.dispose();
    }
  }
);

it('falls back after config failure and honors an explicit API version', async () => {
  configFails = true;
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(
      TemplateService.use(service => service.create({ ...params, options: { ...params.options, apiversion: '65.0' } }))
    );
    expect(sdk.create).toHaveBeenCalledWith(params.templateType, { ...params.options, apiversion: '65.0' }, undefined);
    expect(project.retrieveSfProjectJson).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it.each(['missing-project', 'missing-version', 'null-version', 'project-read-failure'] as const)(
  'falls back to the connection version after %s',
  async reason => {
    projectFails = reason === 'missing-project';
    if (reason === 'missing-version') projectJson.unset('sourceApiVersion');
    if (reason === 'null-version') vi.spyOn(projectJson, 'get').mockReturnValue(null);
    if (reason === 'project-read-failure')
      vi.mocked(project.retrieveSfProjectJson).mockRejectedValueOnce(new Error('invalid project JSON'));
    const runtime = makeRuntime();
    try {
      await runtime.runPromise(TemplateService.use(service => service.create(params)));
      expect(sdk.create).toHaveBeenCalledWith(
        params.templateType,
        { ...params.options, apiversion: '68.0' },
        undefined
      );
    } finally {
      await runtime.dispose();
    }
  }
);

it('leaves API version unspecified when both optional lookups fail', async () => {
  projectFails = true;
  connectionFails = true;
  const runtime = makeRuntime();
  try {
    await runtime.runPromise(TemplateService.use(service => service.create(params)));
    expect(sdk.create).toHaveBeenCalledWith(params.templateType, params.options, undefined);
  } finally {
    await runtime.dispose();
  }
});

it('applies project defaults without overwriting supplied namespace/login URL and makes output paths relative', async () => {
  const runtime = makeRuntime();
  const options = {
    projectname: 'NewProject',
    template: 'standard' as const,
    defaultpackagedir: 'force-app',
    manifest: false
  };
  try {
    await runtime.runPromise(
      TemplateService.use(service =>
        service.create({
          cwd: '/project',
          templateType: SfTemplates.TemplateType.Project,
          options,
          outputdir: URI.file('/elsewhere/output')
        })
      )
    );
    expect(sdk.create).toHaveBeenLastCalledWith(
      SfTemplates.TemplateType.Project,
      {
        ...options,
        ns: '',
        loginurl: 'https://login.salesforce.com',
        apiversion: '67.0',
        outputdir: relative('/project', '/elsewhere/output')
      },
      undefined
    );
    await runtime.runPromise(
      TemplateService.use(service =>
        service.create({
          cwd: '/project',
          templateType: SfTemplates.TemplateType.Project,
          options: { ...options, ns: 'Fixture', loginurl: 'https://test.salesforce.com' }
        })
      )
    );
    expect(sdk.create).toHaveBeenLastCalledWith(
      SfTemplates.TemplateType.Project,
      { ...options, ns: 'Fixture', loginurl: 'https://test.salesforce.com', apiversion: '67.0' },
      undefined
    );
  } finally {
    await runtime.dispose();
  }
});

it('reports localized missing extension and manifest fetch/parse errors', async () => {
  vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
  const missing = makeRuntime();
  try {
    expect(
      await missing.runPromise(TemplateService.use(service => service.create(params)).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'TemplatesRootPathNotAvailableError', message: messages.extensionUnavailable });
  } finally {
    await missing.dispose();
  }
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    extensionUri: URI.parse('https://fixture.example/extension')
  } as vscode.Extension<unknown>);
  const runtime = makeRuntime();
  try {
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(new Error('offline'));
    expect(
      await runtime.runPromise(TemplateService.use(service => service.create(params)).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'TemplatesManifestLoadError', message: 'Manifest load failed: offline' });
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValueOnce(new TextEncoder().encode('{bad JSON'));
    expect(
      await runtime.runPromise(TemplateService.use(service => service.create(params)).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'TemplatesManifestLoadError', message: messages.manifestParseFailed });
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValueOnce(new TextEncoder().encode('[1]'));
    expect(
      await runtime.runPromise(TemplateService.use(service => service.create(params)).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'TemplatesManifestLoadError', message: messages.manifestParseFailed });
    expect(sdk.create).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it('lists built-in templates with the native SDK and lists matching custom files/directories', async () => {
  customPath = '/custom';
  vi.mocked(vscode.workspace.fs.readDirectory).mockImplementation(uri =>
    Promise.resolve(
      uri.path === '/custom/apexclass'
        ? [
            ['Mine.cls', vscode.FileType.File],
            ['wrong.txt', vscode.FileType.File],
            ['dir.cls', vscode.FileType.Directory]
          ]
        : uri.path === '/custom/lightningcomponent/lwc'
          ? [
              ['typed', vscode.FileType.Directory],
              ['wrong', vscode.FileType.Directory]
            ]
          : uri.path.endsWith('/typed')
            ? [['typed.ts', vscode.FileType.File]]
            : [['README.md', vscode.FileType.File]]
    )
  );
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(TemplateService);
    expect(await runtime.runPromise(service.getBuiltInTemplateNames('apexclass', /\.cls$/))).toEqual([
      'DefaultApexClass'
    ]);
    expect(
      await runtime.runPromise(service.getBuiltInTemplateSubdirNames('lightningcomponent', 'lwc', /\.html$/))
    ).toEqual(['default', 'typeScript']);
    expect(await runtime.runPromise(service.getCustomTemplateNames('apexclass', '.cls'))).toEqual(['Mine']);
    expect(
      await runtime.runPromise(service.getCustomTemplateSubdirNames('lightningcomponent', 'lwc', /\.(js|ts)$/))
    ).toEqual(['typed']);
  } finally {
    await runtime.dispose();
  }
});

it('treats missing/failed optional custom directories as empty', async () => {
  customPath = '/custom';
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(TemplateService);
    vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValueOnce(vscode.FileSystemError.FileNotFound('/custom'));
    expect(await runtime.runPromise(service.getCustomTemplateNames('apexclass', '.cls'))).toEqual([]);
    vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValueOnce(new Error('no access'));
    expect(
      await runtime.runPromise(service.getCustomTemplateSubdirNames('lightningcomponent', 'lwc', /\.html$/))
    ).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});

it('stages only once, makes concurrent callers await copies, and retains HTTPS path separators', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    extensionUri: URI.parse('https://fixture.example/extension')
  } as vscode.Extension<unknown>);
  const copying = Promise.withResolvers<void>();
  const copied = Promise.withResolvers<Uint8Array>();
  const reads: string[] = [];
  vi.mocked(vscode.workspace.fs.readFile).mockImplementation(uri => {
    reads.push(uri.toString());
    if (uri.path.endsWith('manifest.json'))
      return Promise.resolve(new TextEncoder().encode('["apexclass/DefaultApexClass.cls"]'));
    copying.resolve();
    return copied.promise;
  });
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(TemplateService);
    const first = runtime.runPromise(service.create(params));
    await copying.promise;
    const second = runtime.runPromise(service.getBuiltInTemplateNames('apexclass', /\.cls$/));
    await setImmediate();
    expect(sdk.create).not.toHaveBeenCalled();
    expect(SfTemplates.CreateUtil.getCommandTemplatesForFiletype).not.toHaveBeenCalled();
    copied.resolve(new TextEncoder().encode('public class <%= apiName %> {}'));
    await first;
    await second;
    await runtime.runPromise(service.create(params));
    expect(reads).toEqual([
      'https://fixture.example/extension/dist/templates/manifest.json',
      'https://fixture.example/extension/dist/templates/apexclass/DefaultApexClass.cls'
    ]);
    expect(nodeFs.writeFileSync).toHaveBeenCalledExactlyOnceWith(
      '/extension/dist/templates/apexclass/DefaultApexClass.cls',
      expect.any(Uint8Array)
    );
    expect(sdk.create).toHaveBeenCalledTimes(2);
  } finally {
    copied.resolve(new Uint8Array());
    await runtime.dispose();
  }
});

it('retries a failed manifest but preserves warning-only partial-copy behavior', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const runtime = makeRuntime();
  try {
    const service = await runtime.runPromise(TemplateService);
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(new Error('offline'));
    await runtime.runPromise(service.create(params).pipe(Effect.flip));
    vi.mocked(vscode.workspace.fs.readFile)
      .mockResolvedValueOnce(new TextEncoder().encode('["bad.cls","good.cls"]'))
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockResolvedValueOnce(new Uint8Array([1]));
    expect(await runtime.runPromise(service.create(params))).toBe(output);
    expect(await runtime.runPromise(service.create(params))).toBe(output);
    expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(4);
    expect(nodeFs.writeFileSync).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'joins a started native create before %s completes and rejects late calls after shutdown',
  async mode => {
    const started = Promise.withResolvers<void>();
    const completed = Promise.withResolvers<SfTemplates.CreateOutput>();
    vi.mocked(sdk.create).mockImplementationOnce(() => {
      started.resolve();
      return completed.promise;
    });
    const runtime = makeRuntime();
    const service = await runtime.runPromise(TemplateService);
    const controller = new AbortController();
    let returned = false;
    const running = Effect.runPromiseExit(service.create(params), { signal: controller.signal }).then(value => {
      returned = true;
      return value;
    });
    await started.promise;
    let disposed = false;
    const closing =
      mode === 'dispose'
        ? runtime.dispose().then(() => {
            disposed = true;
          })
        : Promise.resolve(controller.abort());
    try {
      await setImmediate();
      expect(returned).toBe(false);
      if (mode === 'dispose') {
        expect(disposed).toBe(false);
        expect(Exit.isFailure(await Effect.runPromiseExit(service.create(params)))).toBe(true);
      }
    } finally {
      completed.resolve(output);
      await closing;
    }
    expect(Exit.isFailure(await running)).toBe(true);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    await runtime.dispose();
  }
);

it('keeps a typed native create rejection and does not duplicate successful staging', async () => {
  const failure = new Error('native template error');
  vi.mocked(sdk.create).mockRejectedValueOnce(failure);
  const runtime = makeRuntime();
  try {
    expect(
      await runtime.runPromise(TemplateService.use(service => service.create(params)).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'UnknownError', cause: failure });
  } finally {
    await runtime.dispose();
  }
});

it('holds the staging permit through cancelled native copies before a queued caller can create', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Uint8Array>();
  vi.mocked(vscode.workspace.fs.readFile).mockImplementation(uri => {
    if (uri.path.endsWith('manifest.json'))
      return Promise.resolve(new TextEncoder().encode('["apexclass/DefaultApexClass.cls"]'));
    started.resolve();
    return release.promise;
  });
  const runtime = makeRuntime();
  const service = await runtime.runPromise(TemplateService);
  const controller = new AbortController();
  let cancelledReturned = false;
  const first = Effect.runPromiseExit(service.create(params), { signal: controller.signal }).then(value => {
    cancelledReturned = true;
    return value;
  });
  await started.promise;
  controller.abort();
  const second = Effect.runPromise(service.create(params));
  try {
    await setImmediate();
    expect(cancelledReturned).toBe(false);
    expect(sdk.create).not.toHaveBeenCalled();
  } finally {
    release.resolve(new Uint8Array([1]));
  }
  expect(Exit.isFailure(await first)).toBe(true);
  expect(await second).toBe(output);
  expect(sdk.create).toHaveBeenCalledTimes(1);
  await runtime.dispose();
});

it('copies at most twenty assets concurrently without serializing all asset reads', async () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const twentyStarted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<Uint8Array>();
  let inFlight = 0;
  let maximum = 0;
  let copied = 0;
  vi.mocked(vscode.workspace.fs.readFile).mockImplementation(uri => {
    if (uri.path.endsWith('manifest.json'))
      return Promise.resolve(
        new TextEncoder().encode(JSON.stringify(Array.from({ length: 43 }, (_, index) => `${index}.cls`)))
      );
    inFlight++;
    maximum = Math.max(inFlight, maximum);
    if (inFlight === 20) twentyStarted.resolve();
    return release.promise.then(value => {
      copied++;
      inFlight--;
      return value;
    });
  });
  const runtime = makeRuntime();
  try {
    const creating = runtime.runPromise(TemplateService.use(service => service.create(params)));
    await twentyStarted.promise;
    expect(inFlight).toBe(20);
    expect(sdk.create).not.toHaveBeenCalled();
    release.resolve(new Uint8Array([1]));
    await creating;
    expect(maximum).toBe(20);
    expect(copied).toBe(43);
    expect(nodeFs.writeFileSync).toHaveBeenCalledTimes(43);
  } finally {
    release.resolve(new Uint8Array());
    await runtime.dispose();
  }
});

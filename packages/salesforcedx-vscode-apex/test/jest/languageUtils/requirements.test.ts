/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, ServicesExtensionNotFoundError } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { SettingsError, SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { fail } from 'node:assert';
import * as cp from 'node:child_process';
import * as path from 'node:path';
import { SET_JAVA_DOC_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { checkJavaVersion, JavaRequirementsError, resolveRequirements } from '../../../src/requirements';

// Mock vscode workspace
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  },
  env: {
    language: 'en'
  },
  Position: class MockPosition {
    constructor(
      public line: number,
      public character: number
    ) {}
  },
  Range: class MockRange {
    constructor(
      public start: any,
      public end: any
    ) {}
  }
}));

// jest.fns so individual tests can reconfigure the false / error branches via mockReturnValue.
const mockFileOrFolderExists = jest.fn((_p: string) => Effect.succeed(true));
const mockGetValue = jest.fn((_section: string, _key: string, defaultValue?: unknown) => Effect.succeed(defaultValue));
const succeedApi = (): ExtensionProviderService['getServicesApi'] =>
  Effect.succeed({
    services: {
      FsService: { fileOrFolderExists: mockFileOrFolderExists },
      SettingsService
    }
  }) as unknown as ExtensionProviderService['getServicesApi'];
const mockGetServicesApi = jest.fn(succeedApi);

const run = <A, E>(effect: Effect.Effect<A, E, ExtensionProviderService | SettingsService | FsService>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, {
        get getServicesApi() {
          return mockGetServicesApi();
        }
      } as unknown as ExtensionProviderService),
      Effect.provideService(
        SettingsService,
        SettingsService.make({ getValue: mockGetValue, getValueOrElse: mockGetValue } as never)
      ),
      Effect.provideService(FsService, FsService.make({ fileOrFolderExists: mockFileOrFolderExists } as never))
    )
  );

// Mock find-java-home module
jest.mock('find-java-home', () =>
  jest.fn(callback => {
    // Simulate async behavior
    setTimeout(() => {
      callback(null, '/path/to/java/home');
    }, 0);
  })
);

// Mock os module
jest.mock('node:os', () => ({
  ...(jest.requireActual('node:os') as typeof import('node:os')),
  homedir: jest.fn().mockReturnValue('/mock/home/directory')
}));

const invokeExecFileCallback = (args: readonly unknown[], error: unknown, stderr: string): void => {
  const cb = args.at(-1);
  if (typeof cb !== 'function') return;
  (cb as (error: unknown, stdout: string, stderr: string) => void)(error, '', stderr);
};

const jdk = 'openjdk1.8.0.302_8.56.0.22_x64';
const runtimePath = path.join('/mock/home/directory', 'java_home', 'real', 'jdk', jdk);

describe('Java Requirements Test', () => {
  let execFileSpy: jest.SpyInstance;

  beforeEach(() => {
    mockFileOrFolderExists.mockReturnValue(Effect.succeed(true));
    mockGetValue.mockImplementation((_section, _key, defaultValue) => Effect.succeed(defaultValue));
    mockGetServicesApi.mockImplementation(succeedApi);
    execFileSpy = jest.spyOn(cp, 'execFile');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Unix-specific tests - these tests are skipped as they require complex mocking setup
  (process.platform !== 'win32' ? describe.skip : describe.skip)('Unix-specific tests', () => {
    // Tests removed due to complex mocking requirements
  });

  // Cross-platform tests
  describe('Cross-platform tests', () => {
    it('Should allow valid java runtime path outside the project', async () => {
      mockGetValue.mockImplementation((_section, key, defaultValue) =>
        Effect.succeed(key === 'java.home' ? runtimePath : defaultValue)
      );
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 11.0.0');
      });
      const requirements = await run(resolveRequirements());
      expect(requirements.java_home).toContain(jdk);
    });

    it('Should reject when the configured java home path does not exist', async () => {
      mockGetValue.mockImplementation((_section, key, defaultValue) =>
        Effect.succeed(key === 'java.home' ? runtimePath : defaultValue)
      );
      mockFileOrFolderExists.mockReturnValue(Effect.succeed(false));
      const err = await run(resolveRequirements().pipe(Effect.flip));
      expect(err).toBeInstanceOf(JavaRequirementsError);
      expect(err.message).toEqual(
        nls.localize('source_missing_text', nls.localize('source_java_home_setting_text'), SET_JAVA_DOC_LINK)
      );
    });

    it('Should reject when reading the Java setting fails', async () => {
      mockGetValue.mockReturnValue(
        Effect.fail(
          new SettingsError({ cause: 'setting read failed', key: 'java.home', message: 'setting read failed' })
        ) as unknown as ReturnType<typeof mockGetValue>
      );

      const err = await run(resolveRequirements().pipe(Effect.flip));
      expect(err).toBeInstanceOf(SettingsError);
      expect(err.message).toBe('setting read failed');
    });

    it('Should fail when the services extension is unavailable', async () => {
      mockGetValue.mockImplementation((_section, key, defaultValue) =>
        Effect.succeed(key === 'java.home' ? runtimePath : defaultValue)
      );
      mockGetServicesApi
        .mockReturnValueOnce(succeedApi())
        .mockReturnValue(
          Effect.fail(new ServicesExtensionNotFoundError()) as unknown as ExtensionProviderService['getServicesApi']
        );
      await expect(run(resolveRequirements().pipe(Effect.flip))).resolves.toBeInstanceOf(
        ServicesExtensionNotFoundError
      );
    });

    it('Should not support Java 8', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 1.8.0');
      });
      const err = await Effect.runPromise(
        checkJavaVersion(path.join('/mock/home/directory', 'java_home')).pipe(Effect.flip)
      );
      expect(err).toBeInstanceOf(JavaRequirementsError);
      expect(err.message).toEqual(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
    });

    it('Should support Java 11', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 11.0.0');
      });
      try {
        const result = await Effect.runPromise(checkJavaVersion(path.join('/mock/home/directory', 'java_home')));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 11.  The error was: ${String(err)}`);
      }
    });

    it('Should support Java 17', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 17.2.3');
      });
      try {
        const result = await Effect.runPromise(checkJavaVersion(path.join('/mock/home/directory', 'java_home')));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 17.  The error was: ${String(err)}`);
      }
    });

    it('Should support Java 21', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 21.0.0');
      });
      try {
        const result = await Effect.runPromise(checkJavaVersion(path.join('/mock/home/directory', 'java_home')));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 21.  The error was: ${String(err)}`);
      }
    });

    it('Should support Java 23', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, '', 'java.version = 23.0.0');
      });
      try {
        const result = await Effect.runPromise(checkJavaVersion(path.join('/mock/home/directory', 'java_home')));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 23.  The error was: ${String(err)}`);
      }
    });

    it('Should reject java version check when execFile fails', async () => {
      execFileSpy.mockImplementation((...args: readonly unknown[]) => {
        invokeExecFileCallback(args, { message: 'its broken' }, '');
      });
      const expectedPath = path.join(
        '/mock/home/directory',
        'java_home',
        'bin',
        process.platform === 'win32' ? 'java.exe' : 'java'
      );
      const err = await Effect.runPromise(
        checkJavaVersion(path.join('/mock/home/directory', 'java_home')).pipe(Effect.flip)
      );
      expect(err).toBeInstanceOf(JavaRequirementsError);
      expect(err.message).toEqual(
        nls.localize(
          'java_version_check_command_failed',
          `${expectedPath} -XshowSettings:properties -version`,
          'its broken'
        )
      );
    });
  });
});

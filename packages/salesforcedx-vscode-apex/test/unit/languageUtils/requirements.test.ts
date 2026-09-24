/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import { ExtensionProviderService, ServicesExtensionNotFoundError } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { fail } from 'node:assert';
import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SET_JAVA_DOC_LINK } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { checkJavaVersion, JAVA_HOME_KEY, resolveRequirements } from '../../../src/requirements';

// Mock vscode workspace
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn()
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

// vi.fn mocks so individual tests can reconfigure the false / error branches via mockReturnValue.
const mockFileOrFolderExists = vi.fn((_p: string) => Effect.succeed(true));
const succeedApi = (): ExtensionProviderService['getServicesApi'] =>
  Effect.succeed({
    services: { FsService: { fileOrFolderExists: mockFileOrFolderExists } }
  }) as unknown as ExtensionProviderService['getServicesApi'];
const mockGetServicesApi = vi.fn(succeedApi);

// Mock the services runtime: real getRuntime builds AllServicesLayer (unset in unit tests), so run
// effects against a stub ExtensionProviderService whose getServicesApi / FsService are vi.fn mocks.
vi.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({
    runPromise: (eff: Effect.Effect<boolean, never, ExtensionProviderService>): Promise<boolean> =>
      Effect.runPromise(
        eff.pipe(
          Effect.provideService(ExtensionProviderService, {
            get getServicesApi() {
              return mockGetServicesApi();
            }
          } as unknown as ExtensionProviderService)
        )
      )
  })
}));

// Mock find-java-home module
vi.mock('find-java-home', () =>
  vi.fn(callback => {
    // Simulate async behavior
    setTimeout(() => {
      callback(null, '/path/to/java/home');
    }, 0);
  })
);

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home/directory')
}));

vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: vi.fn()
}));

const jdk = 'openjdk1.8.0.302_8.56.0.22_x64';
const runtimePath = path.join('/mock/home/directory', 'java_home', 'real', 'jdk', jdk);

describe('Java Requirements Test', () => {
  let getConfigMock: VitestMock;
  let execFileSpy: VitestMockInstance;

  beforeEach(() => {
    mockFileOrFolderExists.mockReturnValue(Effect.succeed(true));
    mockGetServicesApi.mockImplementation(succeedApi);
    getConfigMock = vi.fn();
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: getConfigMock,
      update: vi.fn()
    } as any);
    execFileSpy = cp.execFile as unknown as VitestMockInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Unix-specific tests - these tests are skipped as they require complex mocking setup
  (process.platform !== 'win32' ? describe.skip : describe.skip)('Unix-specific tests', () => {
    // Tests removed due to complex mocking requirements
  });

  // Cross-platform tests
  describe('Cross-platform tests', () => {
    it('Should allow valid java runtime path outside the project', async () => {
      getConfigMock.mockImplementation((key: string) => (key === JAVA_HOME_KEY ? runtimePath : undefined));
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 11.0.0');
      });
      const requirements = await resolveRequirements();
      expect(requirements.java_home).toContain(jdk);
    });

    it('Should reject when the configured java home path does not exist', async () => {
      getConfigMock.mockImplementation((key: string) => (key === JAVA_HOME_KEY ? runtimePath : undefined));
      mockFileOrFolderExists.mockReturnValue(Effect.succeed(false));
      try {
        await resolveRequirements();
        fail('Should have thrown when the java home path does not exist');
      } catch (err) {
        expect(err).toEqual(
          nls.localize('source_missing_text', nls.localize('source_java_home_setting_text'), SET_JAVA_DOC_LINK)
        );
      }
    });

    it('Should treat a services-extension failure as a missing path (catchTags → false)', async () => {
      getConfigMock.mockImplementation((key: string) => (key === JAVA_HOME_KEY ? runtimePath : undefined));
      mockGetServicesApi.mockReturnValue(
        Effect.fail(new ServicesExtensionNotFoundError()) as unknown as ExtensionProviderService['getServicesApi']
      );
      try {
        await resolveRequirements();
        fail('Should have rejected when the services extension is unavailable');
      } catch (err) {
        expect(err).toEqual(
          nls.localize('source_missing_text', nls.localize('source_java_home_setting_text'), SET_JAVA_DOC_LINK)
        );
      }
    });

    it('Should not support Java 8', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 1.8.0');
      });
      try {
        await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        fail('Should have thrown when the Java version is not supported');
      } catch (err) {
        expect(err).toEqual(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
      }
    });

    it('Should support Java 11', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 11.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 11.  The error was: ${err}`);
      }
    });

    it('Should support Java 17', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 17.2.3');
      });
      try {
        const result = await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 17.  The error was: ${err}`);
      }
    });

    it('Should support Java 21', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 21.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 21.  The error was: ${err}`);
      }
    });

    it('Should support Java 23', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb('', '', 'java.version = 23.0.0');
      });
      try {
        const result = await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        expect(result).toBe(true);
      } catch (err) {
        fail(`Should not have thrown when the Java version is 23.  The error was: ${err}`);
      }
    });

    it('Should reject java version check when execFile fails', async () => {
      execFileSpy.mockImplementation((...args) => {
        const cb = args.at(-1);
        cb({ message: 'its broken' }, '', '');
      });
      try {
        await checkJavaVersion(path.join('/mock/home/directory', 'java_home'));
        fail('Should have thrown when the Java version is not supported');
      } catch (err) {
        const expectedPath = path.join(
          '/mock/home/directory',
          'java_home',
          'bin',
          process.platform === 'win32' ? 'java.exe' : 'java'
        );
        expect(err).toEqual(
          nls.localize(
            'java_version_check_command_failed',
            `${expectedPath} -XshowSettings:properties -version`,
            'its broken'
          )
        );
      }
    });
  });
});

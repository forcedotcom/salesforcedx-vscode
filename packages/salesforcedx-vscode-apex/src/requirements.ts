/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as cp from 'node:child_process';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { APEX_SETTINGS_SECTION, SET_JAVA_DOC_LINK } from './constants';
import { nls } from './messages';

/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const findJavaHome: (
  callback: (err: Error | undefined, home: string | undefined) => void
) => void = require('find-java-home');
/* eslint-enable @typescript-eslint/no-var-requires */

type RequirementsData = {
  java_home: string;
  java_memory: number | null;
};

export class JavaRequirementsError extends Schema.TaggedError<JavaRequirementsError>()('JavaRequirementsError', {
  message: Schema.String
}) {}

const getPlatformSpecificBinary = (binary: string): string => (process.platform === 'win32' ? `${binary}.exe` : binary);

const readJavaConfig = Effect.fn('requirements.readJavaConfig')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* (yield* api.services.SettingsService).getValue<string>(APEX_SETTINGS_SECTION, 'java.home');
});

const validateJavaInstallation = Effect.fn('requirements.validateJavaInstallation')(function* (javaHome: string) {
  if (!javaHome) {
    return yield* new JavaRequirementsError({ message: nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK) });
  }

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const binDir = path.join(javaHome, 'bin');

  // Check if bin directory exists and is accessible
  if (!(yield* api.services.FsService.fileOrFolderExists(binDir))) {
    return yield* new JavaRequirementsError({ message: nls.localize('java_bin_missing_text', javaHome) });
  }

  // Check for required binaries. Permission checking is skipped because the actual validation
  // happens when we run the Java binary in checkJavaVersion.
  yield* Effect.forEach(
    ['java', 'javac'],
    binary => {
      const platformBinary = getPlatformSpecificBinary(binary);
      return api.services.FsService.fileOrFolderExists(path.join(binDir, platformBinary)).pipe(
        Effect.filterOrFail(
          exists => exists,
          () =>
            new JavaRequirementsError({
              message: nls.localize('java_binary_missing_text', platformBinary, javaHome)
            })
        )
      );
    },
    { concurrency: 1 }
  );
});

const detectJavaHome = Effect.fn('requirements.detectJavaHome')(function* () {
  return yield* Effect.async<string, JavaRequirementsError>(resume => {
    findJavaHome((err: Error | undefined, home: string | undefined) => {
      resume(
        err || !home || !isString(home)
          ? Effect.fail(
              new JavaRequirementsError({ message: nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK) })
            )
          : Effect.succeed(home)
      );
    });
  });
});

const validateJavaHome = Effect.fn('requirements.validateJavaHome')(function* (javaHome: string) {
  yield* validateJavaInstallation(javaHome);
  return javaHome;
});

const expandHomeDir = (p: string): string | undefined => {
  if (!p || !isString(p)) return undefined;
  if (p === '~') return homedir();
  if (!p.startsWith('~/')) return p;
  return path.join(homedir(), p.slice(2));
};

const isLocal = (javaHome: string): boolean => {
  if (!javaHome || !isString(javaHome)) return true; // Consider invalid paths as local for safety
  return !path.isAbsolute(javaHome);
};

const checkJavaRuntime = Effect.fn('requirements.checkJavaRuntime')(function* () {
  const configuredHome = yield* readJavaConfig();
  const jdkHome = process.env['JDK_HOME'];
  const javaHomeEnv = process.env['JAVA_HOME'];
  const javaHome = [configuredHome, jdkHome, javaHomeEnv].find(home => isString(home) && home.length > 0);
  const source = configuredHome
    ? nls.localize('source_java_home_setting_text')
    : jdkHome
      ? nls.localize('source_jdk_home_env_var_text')
      : nls.localize('source_java_home_env_var_text');

  if (!javaHome) return yield* detectJavaHome().pipe(Effect.flatMap(validateJavaHome));

  const expandedHome = expandHomeDir(javaHome);
  if (!expandedHome) {
    return yield* new JavaRequirementsError({ message: nls.localize('java_home_expansion_failed_text') });
  }

  // On Windows, we don't need to check for local paths
  if (process.platform !== 'win32' && isLocal(expandedHome)) {
    return yield* new JavaRequirementsError({
      message: nls.localize('java_runtime_local_text', expandedHome, SET_JAVA_DOC_LINK)
    });
  }

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  if (!(yield* api.services.FsService.fileOrFolderExists(expandedHome))) {
    return yield* new JavaRequirementsError({
      message: nls.localize('source_missing_text', source, SET_JAVA_DOC_LINK)
    });
  }

  return yield* validateJavaHome(expandedHome);
});

/** Resolves the JDK requirements needed to run the Apex language server. */
export const resolveRequirements = Effect.fn('requirements.resolveRequirements')(function* () {
  const javaHome = yield* checkJavaRuntime();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const javaMemory = yield* (yield* api.services.SettingsService).getValue<number>(
    APEX_SETTINGS_SECTION,
    'java.memory'
  );
  yield* checkJavaVersion(javaHome);
  return {
    java_home: javaHome,
    java_memory: javaMemory ?? null
  } satisfies RequirementsData;
});

export const checkJavaVersion = Effect.fn('requirements.checkJavaVersion')(function* (javaHome: string) {
  if (!javaHome || !isString(javaHome)) {
    return yield* new JavaRequirementsError({ message: nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK) });
  }

  const cmdFile = path.join(javaHome, 'bin', getPlatformSpecificBinary('java'));
  const commandOptions = ['-XshowSettings:properties', '-version'];
  const stderr = yield* Effect.async<string, JavaRequirementsError>((resume, signal) => {
    cp.execFile(cmdFile, commandOptions, { encoding: 'utf8', signal }, (error, _stdout, execStderr) => {
      resume(
        error
          ? Effect.fail(
              new JavaRequirementsError({
                message: nls.localize(
                  'java_version_check_command_failed',
                  `${cmdFile} ${commandOptions.join(' ')}`,
                  error.message
                )
              })
            )
          : Effect.succeed(execStderr)
      );
    });
  });

  const versionMatch = stderr.match(/java\.version\s*=\s*(\d+)(?:\.(\d+))?/);
  const majorVersion = versionMatch ? Number.parseInt(versionMatch[1], 10) : undefined;
  if (majorVersion !== undefined && majorVersion >= 11) return true;

  return yield* new JavaRequirementsError({ message: nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK) });
});

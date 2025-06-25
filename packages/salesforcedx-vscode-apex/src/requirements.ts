/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as cp from 'node:child_process';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { workspace } from 'vscode';
import { SET_JAVA_DOC_LINK } from './constants';
import { nls } from './messages';

/* eslint-disable @typescript-eslint/no-var-requires */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const findJavaHome = require('find-java-home');
/* eslint-enable @typescript-eslint/no-var-requires */

export const JAVA_HOME_KEY = 'salesforcedx-vscode-apex.java.home';
const JAVA_MEMORY_KEY = 'salesforcedx-vscode-apex.java.memory';
type RequirementsData = {
  java_home: string;
  java_memory: number | null;
};

/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if all requirements are resolved.
 */
export const resolveRequirements = async (): Promise<RequirementsData> => {
  const javaHome = await checkJavaRuntime();
  const javaMemory: number | null = workspace.getConfiguration().get<number | null>(JAVA_MEMORY_KEY, null);
  await checkJavaVersion(javaHome);
  return Promise.resolve({
    java_home: javaHome,
    java_memory: javaMemory
  });
};

const getPlatformSpecificBinary = (binary: string): string => (process.platform === 'win32' ? `${binary}.exe` : binary);

const validateJavaInstallation = async (javaHome: string): Promise<boolean> => {
  if (!javaHome) {
    throw new Error(nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK));
  }

  const requiredBinaries = ['java', 'javac'];
  const binDir = path.join(javaHome, 'bin');

  // Check if bin directory exists and is accessible
  if (!(await fileOrFolderExists(binDir))) {
    throw new Error(nls.localize('java_bin_missing_text', javaHome));
  }

  // Check for required binaries
  for (const binary of requiredBinaries) {
    const platformBinary = getPlatformSpecificBinary(binary);
    const binaryPath = path.join(binDir, platformBinary);

    if (!(await fileOrFolderExists(binaryPath))) {
      throw new Error(nls.localize('java_binary_missing_text', platformBinary, javaHome));
    }

    // Note: Permission checking is skipped because the actual validation
    // happens when we run the Java binary in checkJavaVersion.
  }

  return true;
};

const checkJavaRuntime = async (): Promise<string> =>
  new Promise(async (resolve, reject) => {
    let source: string;
    let javaHome: string | undefined = readJavaConfig();

    if (javaHome) {
      source = nls.localize('source_java_home_setting_text');
    } else {
      javaHome = process.env['JDK_HOME'];

      if (javaHome) {
        source = nls.localize('source_jdk_home_env_var_text');
      } else {
        javaHome = process.env['JAVA_HOME'];
        source = nls.localize('source_java_home_env_var_text');
      }
    }

    if (javaHome) {
      const expandedHome = expandHomeDir(javaHome);
      if (!expandedHome) {
        reject(nls.localize('java_home_expansion_failed_text'));
        return;
      }

      // On Windows, we don't need to check for local paths
      if (process.platform !== 'win32' && isLocal(expandedHome)) {
        reject(nls.localize('java_runtime_local_text', expandedHome, SET_JAVA_DOC_LINK));
        return;
      }

      if (!(await fileOrFolderExists(expandedHome))) {
        reject(nls.localize('source_missing_text', source, SET_JAVA_DOC_LINK));
        return;
      }

      // Validate the Java installation
      validateJavaInstallation(expandedHome)
        .then(() => resolve(expandedHome))
        .catch(error => reject(error.message));
      return;
    }

    // Last resort, try to automatically detect
    findJavaHome((err: Error, home: string | undefined) => {
      if (err) {
        reject(nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK));
        return;
      }

      if (!home || typeof home !== 'string') {
        reject(nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK));
        return;
      }

      validateJavaInstallation(home)
        .then(() => resolve(home))
        .catch(error => reject(error.message));
    });
  });

const readJavaConfig = (): string | undefined => {
  const config = workspace.getConfiguration();
  return config.get<string>('salesforcedx-vscode-apex.java.home');
};

const expandHomeDir = (p: string): string | undefined => {
  if (!p || typeof p !== 'string') {
    return undefined;
  }
  if (p === '~') return homedir();
  if (!p.startsWith('~/')) return p;
  return path.join(homedir(), p.slice(2));
};

const isLocal = (javaHome: string): boolean => {
  if (!javaHome || typeof javaHome !== 'string') {
    return true; // Consider invalid paths as local for safety
  }
  return !path.isAbsolute(javaHome);
};

export const checkJavaVersion = async (javaHome: string): Promise<boolean> => {
  if (!javaHome || typeof javaHome !== 'string') {
    throw new Error(nls.localize('java_runtime_missing_text', SET_JAVA_DOC_LINK));
  }

  const cmdFile = path.join(javaHome, 'bin', getPlatformSpecificBinary('java'));
  const commandOptions = ['-XshowSettings:properties', '-version'];

  return new Promise((resolve, reject) => {
    cp.execFile(cmdFile, commandOptions, {}, (error, stdout, stderr) => {
      if (error) {
        reject(
          nls.localize('java_version_check_command_failed', `${cmdFile} ${commandOptions.join(' ')}`, error.message)
        );
        return;
      }

      const versionMatch = stderr.match(/java\.version\s*=\s*(\d+)(?:\.(\d+))?/);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1], 10);
        if (majorVersion >= 11) {
          resolve(true);
          return;
        }
      }

      reject(nls.localize('wrong_java_version_text', SET_JAVA_DOC_LINK));
    });
  });
};

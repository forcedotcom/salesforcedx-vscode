/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import * as cp from 'child_process';
import { workspace } from 'vscode';
import { nls } from './messages';

import pathExists = require('path-exists');

// tslint:disable-next-line:no-var-requires
const expandHomeDir = require('expand-home-dir');
// tslint:disable-next-line:no-var-requires
const findJavaHome = require('find-java-home');

export const JAVA_HOME_KEY = 'salesforcedx-vscode-apex.java.home';

export interface RequirementsData {
  java_home: string;
}

/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if all requirements are resolved.
 */
export async function resolveRequirements(): Promise<RequirementsData> {
  const javaHome = await checkJavaRuntime();
  await checkJavaVersion(javaHome);
  return Promise.resolve({ java_home: javaHome });
}

function checkJavaRuntime(): Promise<string> {
  return new Promise((resolve, reject) => {
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
      javaHome = expandHomeDir(javaHome) as string;
      if (!pathExists.sync(javaHome)) {
        return reject(nls.localize('source_missing_text', source));
      }
      return resolve(javaHome);
    }

    // Last resort, try to automatically detect
    findJavaHome((err: Error, home: string) => {
      if (err) {
        return reject(nls.localize('java_runtime_missing_text'));
      } else {
        return resolve(home);
      }
    });
  });
}

function readJavaConfig(): string {
  const config = workspace.getConfiguration();
  return config.get<string>('salesforcedx-vscode-apex.java.home', '');
}

function checkJavaVersion(javaHome: string): Promise<any> {
  return new Promise((resolve, reject) => {
    cp.execFile(
      javaHome + '/bin/java',
      ['-version'],
      {},
      (error, stdout, stderr) => {
        if (stderr.indexOf('1.8') < 0) {
          reject(nls.localize('wrong_java_version_text'));
        } else {
          resolve(true);
        }
      }
    );
  });
}

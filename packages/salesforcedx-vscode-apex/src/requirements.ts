// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import * as cp from 'child_process';
import { workspace } from 'vscode';
import { nls } from './messages';

import pathExists = require('path-exists');

// tslint:disable-next-line:no-var-requires
const expandHomeDir = require('expand-home-dir');

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
    let javaHome: string = readJavaConfig();

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
      javaHome = expandHomeDir(javaHome);
      if (!pathExists.sync(javaHome)) {
        reject(nls.localize('source_missing_text', source));
      }
      return resolve(javaHome);
    }

    reject(nls.localize('java_runtime_missing_text'));
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

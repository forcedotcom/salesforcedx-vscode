// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import { workspace } from 'vscode';
import * as cp from 'child_process';

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

function checkJavaRuntime(): Promise<any> {
  return new Promise((resolve, reject) => {
    let source: string;
    let javaHome: string = readJavaConfig();
    if (javaHome) {
      source = 'The java.home variable defined in VS Code settings';
    } else {
      javaHome = process.env['JDK_HOME'];
      if (javaHome) {
        source = 'The JDK_HOME environment variable';
      } else {
        javaHome = process.env['JAVA_HOME'];
        source = 'The JAVA_HOME environment variable';
      }
    }
    if (javaHome) {
      javaHome = expandHomeDir(javaHome);
      if (!pathExists.sync(javaHome)) {
        reject(`${source} points to a missing folder`);
      }
      return resolve(javaHome);
    }

    reject('Java runtime could not be located');
  });
}

function readJavaConfig(): string {
  const config = workspace.getConfiguration();
  return config.get<string>('java.home', '');
}

function checkJavaVersion(javaHome: string): Promise<any> {
  return new Promise((resolve, reject) => {
    cp.execFile(
      javaHome + '/bin/java',
      ['-version'],
      {},
      (error, stdout, stderr) => {
        if (stderr.indexOf('1.8') < 0) {
          reject(
            'Java 8 is required to run. Please download and install a JRE.'
          );
        } else {
          resolve(true);
        }
      }
    );
  });
}

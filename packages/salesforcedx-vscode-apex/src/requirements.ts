// From https://github.com/redhat-developer/vscode-java
// Original version licensed under the Eclipse Public License (EPL)

import { workspace, Uri } from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const pathExists = require('path-exists');
const expandHomeDir = require('expand-home-dir');
const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');

interface RequirementsData {
    java_home: string;
}

/**
 * Resolves the requirements needed to run the extension. 
 * Returns a promise that will resolve to a RequirementsData if all requirements are resolved.
 *  
 */
export async function resolveRequirements(): Promise<RequirementsData> {
    let java_home = await checkJavaRuntime();
    await checkJavaVersion(java_home);
    return Promise.resolve({ java_home: java_home }
    );
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

function checkJavaVersion(java_home: string): Promise<any> {
    return new Promise((resolve, reject) => {
        cp.execFile(java_home + '/bin/java', ['-version'], {}, (error, stdout, stderr) => {
            if (stderr.indexOf('1.8') < 0) {
                reject('Java 8 is required to run. Please download and install a JRE.');
            } else {
                resolve(true);
            }
        });
    });
}

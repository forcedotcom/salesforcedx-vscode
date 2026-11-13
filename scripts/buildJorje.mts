#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/*
 * Automates the process of updating the Language Server Jar from a local Jorje repo.
 *
 * Assumptions:
 * 0. You have a local Jorje repo, have saved the keystore to sign the Jar, and have
 *    saved the paths for those + the keystore to your bash profile.
 *    *Hard* reset VS Code once set.
 *
 * Ex:  export JORJE_DEV_DIR=~/Git-Repositories/apex-jorje
        export SFDC_KEYSTORE=~/KEYS/sfdc.jks
        export SFDC_KEYPASS=PASS #where PASS is the password for the keystore
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import util from 'node:util';
import { logger } from './loggerUtil.mts';
import { checkJorjeDirectory, checkSigningAbility } from './validationUtils.mts';

//Input Variables
const needSigning = process.argv[2];

//Messages
const LOG_HEADER = '='.repeat(80);
const SECTION_HEADER = '-'.repeat(80);
const BUILD_MSG = 'Building and signing apex-jorje project\n  from: %s...\n';
const FIND_MSG = 'Searching for artifacts\n     In: %s...\n';
const COPY_MSG = 'Copying: %s\n     To: %s\n';
const COPY_ERR = 'Failed to copy LSP jar: %s. Error: %s\n';
const SIGN_ERR = 'Failed to sign jar: %s\n';
const SIGN_INFO = '^^ Ignore the certificate signer expired errors. We are ok with these.';

//Directories
const CURRENT_DIR = process.cwd();
let JORJE_DEV_DIR = '';
let SFDC_KEYSTORE = '';
let SFDC_KEYPASS = '';
const JORJE_DEST_DIR = `${CURRENT_DIR}/packages/salesforcedx-vscode-apex/jars`;
const JORJE_DEST_PATH = `${JORJE_DEST_DIR}/apex-jorje-lsp.jar`;

const verifyPaths = () => {
  console.log(LOG_HEADER);
  JORJE_DEV_DIR = checkJorjeDirectory();
  if (needSigning === 'true') {
    ({ SFDC_KEYSTORE, SFDC_KEYPASS } = checkSigningAbility());
  }
  // Ensure the jars directory exists
  if (!fs.existsSync(JORJE_DEST_DIR)) {
    fs.mkdirSync(JORJE_DEST_DIR, { recursive: true });
  }
};

const buildLSP = () => {
  console.log(SECTION_HEADER);
  console.log(util.format(BUILD_MSG, CURRENT_DIR));
  process.chdir(JORJE_DEV_DIR);
  if (needSigning === 'true') {
    execSync(
      `mvn clean install package -Plsp -Psign-jars -Dsfdc.keystore=${SFDC_KEYSTORE} -Dsfdc.keypass=${SFDC_KEYPASS} -Dsfdc.storepass=${SFDC_KEYPASS} -DskipTests`
    );
  } else {
    execSync('mvn clean install package -Plsp -DskipTests;');
  }
};

const isJarFile = (file: string) => file.match(/apex-jorje-lsp-\d{3}\.\d*-SNAPSHOT\.jar$/);

const findJarFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? findJarFiles(fullPath) : isJarFile(entry.name) ? [fullPath] : [];
  });

const getLSP = () => {
  console.log(util.format(FIND_MSG, JORJE_DEV_DIR));
  const files = findJarFiles(JORJE_DEV_DIR);
  return files[0];
};

const copyLSP = (jar: string) => {
  console.log(SECTION_HEADER);
  console.log(util.format(COPY_MSG, jar, JORJE_DEST_PATH));

  try {
    fs.copyFileSync(jar, JORJE_DEST_PATH);
  } catch (error) {
    console.log(util.format(COPY_ERR, jar, error instanceof Error ? error.message : String(error)));
    process.exit();
  }

  if (needSigning === 'true') {
    const signedConf = execSync(`jarsigner -verify ${JORJE_DEST_PATH}`, { encoding: 'utf8' });
    if (!signedConf.includes('jar verified')) {
      logger.error(util.format(SIGN_ERR, JORJE_DEV_DIR));
    } else {
      console.log(SIGN_INFO);
    }
  }
};

// Put it all together
verifyPaths();
buildLSP();
copyLSP(getLSP());

logger.info('\nJorge is built!');
console.log('\nRun this command before testing to check for any stale servers: ');
console.log('\nps -eo pid,args | grep "[A]pexLanguageServerLauncher"');
console.log(util.format('%s\n', LOG_HEADER));

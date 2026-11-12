#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { logger } from './loggerUtil.mts';

// Exit on error
process.on('uncaughtException', err => {
  console.error(err);
  process.exit(1);
});

// Verbose output
process.env.DEBUG = '*';

export const checkVSCodeVersion = () => {
  const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
  if (!nextVersion?.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
    logger.error("You must set environment variable 'SALESFORCEDX_VSCODE_VERSION'.");
    logger.info("To set: 'export SALESFORCEDX_VSCODE_VERSION=xx.yy.zz'. Where xx.yy.zz is the release number.");
    process.exit(-1);
  }
};

export const checkBaseBranch = (baseBranch: string) => {
  logger.header(`\nVerifying script execution from branch ${baseBranch}.`);
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  if (currentBranch !== baseBranch) {
    logger.error(
      `You must execute this script in ${baseBranch}. You are currently running the script on branch ${currentBranch}.`
    );
    process.exit(-1);
  }
};

export const checkJorjeDirectory = () => {
  const JORJE_DEV_DIR = process.env['JORJE_DEV_DIR'];
  if (!JORJE_DEV_DIR) {
    logger.error("You must set environment variable 'JORJE_DEV_DIR'.");
    logger.info(
      "To set: Add 'export JORJE_DEV_DIR=/path/to/apex-jorje' to your bash profile, where the path is your local Jorje repository."
    );
    process.exit(-1);
  }

  try {
    if (!fs.statSync(JORJE_DEV_DIR).isDirectory() || !JORJE_DEV_DIR.includes('apex-jorje')) {
      logger.error(
        `JORJE_DEV_DIR environment variable does not direct to apex-jorje: ${JORJE_DEV_DIR}. Check your bash profile.`
      );
      process.exit(-1);
    }
  } catch {
    logger.error('Apex Jorje source repository not found.');
    logger.error(`Verify the path of the environment variable JORJE_DEV_DIR: ${JORJE_DEV_DIR}`);
    process.exit(-1);
  }
  return JORJE_DEV_DIR;
};

export const checkSigningAbility = () => {
  const KEYSTORE = process.env['SFDC_KEYSTORE'];
  if (!KEYSTORE) {
    logger.error("You must set environment variable 'SFDC_KEYSTORE'.");
    logger.info(
      "To set: Add 'export SFDC_KEYSTORE=/path/to/sfdc.jks' to your bash profile, where the file is the saved keystore to sign the LSP jar."
    );
    process.exit(-1);
  }
  try {
    if (!fs.statSync(KEYSTORE).isFile() || !KEYSTORE.includes('.jks')) {
      logger.error(
        `SFDC_KEYSTORE environment variable does not point to a .jks file: ${KEYSTORE}. Check your bash profile.`
      );
      process.exit(-1);
    }
  } catch {
    logger.error(`File ${KEYSTORE} not found. Verify the path of the SFDC_KEYSTORE environment variable`);
    logger.info('Verify the path of the SFDC_KEYSTORE environment variable');
    process.exit(-1);
  }

  if (!process.env['SFDC_KEYPASS']) {
    logger.error("You must set environment 'SFDC_KEYPASS'. Refer to LSP FAQ Quip doc for more info.");
    logger.info(
      "To set: Add 'export SFDC_KEYSTORE=PASS' to your bash profile, where PASS is the passphrase for the keystore."
    );
    process.exit(-1);
  }
  return {
    SFDC_KEYSTORE: KEYSTORE,
    SFDC_KEYPASS: process.env['SFDC_KEYPASS']
  };
};

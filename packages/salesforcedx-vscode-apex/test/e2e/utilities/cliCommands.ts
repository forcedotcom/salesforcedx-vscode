import spawn from 'cross-spawn';
import { exec, SpawnOptionsWithoutStdio } from 'child_process';
import { debug, log } from './miscellaneous';
import { OrgEdition, SfCommandRunResults } from './types';
import { EnvironmentSettings } from '../environmentSettings';

export type NONE = 'NONE';

export async function runCliCommand(
  command: string,
  ...args: (string | SpawnOptionsWithoutStdio)[]
): Promise<SfCommandRunResults> {
  const commandArgs = args.filter(arg => typeof arg === 'string');
  const hadJsonFlag = commandArgs.some(arg => arg === '--json');
  let options = args.find(arg => typeof arg !== 'string') as SpawnOptionsWithoutStdio;
  let message = `running CLI command ${command} ${commandArgs.join(' ')}`;
  if (options) {
    message += `\nspawn options: ${JSON.stringify(options)}`;
  }
  const logLevel = EnvironmentSettings.getInstance().logLevel;

  log(message);
  // add NODE_ENV=production
  options = {
    ...(options ?? {}),
    env: {
      ...process.env, // Ensure existing environment variables are included
      NODE_ENV: 'production',
      SF_LOG_LEVEL: logLevel,
      ...(options?.env ?? {}) // Ensure any additional env vars in options are included
    }
  };

  return new Promise((resolve, reject) => {
    const sfProcess = spawn('sf', [command, ...commandArgs] as string[], options);

    let stdout = '';
    let stderr = '';

    sfProcess.stdout?.on('data', data => {
      stdout += data.toString();
    });

    sfProcess.stderr?.on('data', data => {
      stderr += data.toString();
    });

    sfProcess.on('close', code => {
      // Post-command processing
      const result: SfCommandRunResults = { stdout, stderr, exitCode: code ?? 0 };
      result.stdout = hadJsonFlag ? removeEscapedCharacters(result.stdout) : result.stdout;
      // Perform any necessary post-processing here
      // For example, you can modify the result object or log additional information
      log(`Command finished with exit code ${result.exitCode}`);
      resolve(result);
    });

    sfProcess.on('error', err => {
      reject(new Error(`Failed to start process: ${err.message}`));
    });
  });
}

export async function deleteScratchOrg(orgAliasName: string | undefined): Promise<void> {
  if (orgAliasName) {
    // The Terminal view can be a bit unreliable, so directly call exec() instead:
    const sfOrgDeleteResults = await runCliCommand('org:delete:scratch', '--target-org', orgAliasName, '--no-prompt');
    if (sfOrgDeleteResults.exitCode > 0) {
      log(
        `deleteScratchOrg for org ${orgAliasName} failed with exit code ${sfOrgDeleteResults.exitCode}.\nRaw stderr ${sfOrgDeleteResults.stderr}.`
      );
    }
  }
}

export async function orgLoginSfdxUrl(authFilePath: string): Promise<SfCommandRunResults> {
  const sfSfdxUrlStoreResult = await runCliCommand('org:login:sfdx-url', '-d', '-f', authFilePath);
  if (sfSfdxUrlStoreResult.exitCode > 0) {
    debug('sfSfdxUrlStoreResult.exitCode = ' + sfSfdxUrlStoreResult.exitCode);
    debug('sfSfdxUrlStoreResult.stdout = ' + sfSfdxUrlStoreResult.stdout);
    throw new Error(
      `orgLoginSfdxUrl failed with exit code ${sfSfdxUrlStoreResult.exitCode}\nRaw stderr: ${sfSfdxUrlStoreResult.stderr}\nRaw stdout: ${sfSfdxUrlStoreResult.stdout}`
    );
  }
  debug(`orgLoginSfdxUrl results ${JSON.stringify(sfSfdxUrlStoreResult)}`);
  return sfSfdxUrlStoreResult;
}

export async function orgDisplay(usernameOrAlias: string): Promise<SfCommandRunResults> {
  const sfOrgDisplayResult = await runCliCommand('org:display', '--target-org', usernameOrAlias, '--verbose', '--json');
  if (sfOrgDisplayResult.exitCode > 0) {
    const message = `sf org display failed with exit code: ${sfOrgDisplayResult.exitCode}.\n${sfOrgDisplayResult.stderr}`;
    log(message);
    throw new Error(message);
  }
  debug(`orgDisplay results ${JSON.stringify(sfOrgDisplayResult)}`);
  return sfOrgDisplayResult;
}

export async function orgList(): Promise<SfCommandRunResults> {
  const sfOrgListResult = await runCliCommand('org:list', '--json');
  if (sfOrgListResult.exitCode > 0) {
    const message = `org list failed with exit code ${sfOrgListResult.exitCode}\n stderr ${sfOrgListResult.stderr}`;
    log(message);
    throw new Error(message);
  }
  debug(`orgList results ${JSON.stringify(sfOrgListResult)}`);
  return sfOrgListResult;
}

export async function aliasList(): Promise<SfCommandRunResults> {
  const sfAliasListResult = await runCliCommand('alias:list', '--json');
  if (sfAliasListResult.exitCode > 0) {
    const message = `alias list failed with exit code ${sfAliasListResult.exitCode}\n stderr ${sfAliasListResult.stderr}`;
    log(message);
    throw new Error(message);
  }
  debug(`aliasList results ${JSON.stringify(sfAliasListResult)}`);
  return sfAliasListResult;
}

export async function scratchOrgCreate(
  edition: OrgEdition,
  definitionFileOrNone: string | NONE,
  scratchOrgAliasName: string,
  durationDays: number
): Promise<SfCommandRunResults> {
  log('calling "sf org:create:scratch"...');
  const args = [
    '--edition',
    edition,
    '--alias',
    scratchOrgAliasName,
    '--duration-days',
    durationDays.toString(),
    '--set-default',
    '--json',
    ...(definitionFileOrNone !== 'NONE' ? ['--definition-file', definitionFileOrNone] : [])
  ];

  const sfOrgCreateResult = await runCliCommand('org:create:scratch', ...args);

  if (sfOrgCreateResult.exitCode > 0) {
    log(
      `create scratch org failed. Exit code: ${sfOrgCreateResult.exitCode}. \ncreate scratch org failed. Raw stderr: ${sfOrgCreateResult.stderr}`
    );
    throw new Error(sfOrgCreateResult.stderr);
  }

  log(`..."sf org:create:scratch" finished`);
  debug(`scratchOrgCreate results ${JSON.stringify(sfOrgCreateResult)}`);

  return sfOrgCreateResult;
}

export async function setAlias(devHubAliasName: string, devHubUserName: string): Promise<SfCommandRunResults> {
  const setAliasResult = await runCliCommand('alias:set', `${devHubAliasName}=${devHubUserName}`);
  if (setAliasResult.exitCode > 0) {
    log(`alias failed. Exit code: ${setAliasResult.exitCode}. \nRaw stderr: ${setAliasResult.stderr}`);
    throw new Error(setAliasResult.stderr);
  }
  return setAliasResult;
}

export async function installJestUTToolsForLwc(projectFolder: string | undefined): Promise<void> {
  log(`SetUp - Started Install @salesforce/sfdx-lwc-jest Node module...`);
  if (!projectFolder) {
    throw new Error('cannot setup lwc tests without a project folder.');
  }
  const command =
    'npm install @lwc/eslint-plugin-lwc@^2.0.0 --save-dev && npm install && npm uninstall husky --force && npm install eslint@^8 --save-dev && npm install --save-dev && npm install @salesforce/sfdx-lwc-jest --save-dev';
  return new Promise((resolve, reject) => {
    exec(command, { cwd: projectFolder }, (error, stdout, stderr) => {
      if (error) {
        log(`Error with ${command}`);
        reject(error);
        return;
      }
      if (stderr) {
        log(`Error output for ${command}`);
      }
      log(stdout);
      log(`...SetUp - Finished Install @salesforce/sfdx-lwc-jest Node module`);
      resolve();
    });
  });
}

export async function createUser(
  systemAdminUserDefPath: string,
  targetOrg: string | undefined
): Promise<SfCommandRunResults> {
  if (!targetOrg) {
    throw new Error('cannot create user with target');
  }
  const sfOrgCreateUserResult = await runCliCommand(
    'org:create:user',
    '--definition-file',
    systemAdminUserDefPath,
    '--target-org',
    targetOrg
  );
  if (sfOrgCreateUserResult.exitCode > 0) {
    log(
      `org create user failed Exit code: ${sfOrgCreateUserResult.exitCode}. \nRaw stderr: ${sfOrgCreateUserResult.stderr}`
    );
    throw new Error(sfOrgCreateUserResult.stderr);
  }
  debug(`createUser results ${JSON.stringify(sfOrgCreateUserResult)}`);
  return sfOrgCreateUserResult;
}

export function removeEscapedCharacters(result: string): string {
  const resultJson = result.replace(/\u001B\[\d\dm/g, '').replace(/\\n/g, '');

  return resultJson;
}

export async function generateSfProject(
  name: string,
  path?: string | undefined,
  template?: string | undefined
): Promise<SfCommandRunResults> {
  const sfProjectGenerateResult = await runCliCommand(
    'project:generate',
    '--name',
    name,
    '--template',
    template ?? 'standard',
    ...(path ? ['-d', path] : [])
  );
  if (sfProjectGenerateResult.exitCode > 0) {
    log(
      `project generate failed Exit code: ${sfProjectGenerateResult.exitCode}. \nRaw stderr: ${sfProjectGenerateResult.stderr}`
    );
    throw new Error(sfProjectGenerateResult.stderr);
  }
  debug(`generateSfProject results ${JSON.stringify(sfProjectGenerateResult)}`);
  return sfProjectGenerateResult;
}

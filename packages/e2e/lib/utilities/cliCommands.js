"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCliCommand = runCliCommand;
exports.deleteScratchOrg = deleteScratchOrg;
exports.orgLoginSfdxUrl = orgLoginSfdxUrl;
exports.orgDisplay = orgDisplay;
exports.orgList = orgList;
exports.aliasList = aliasList;
exports.scratchOrgCreate = scratchOrgCreate;
exports.setAlias = setAlias;
exports.installJestUTToolsForLwc = installJestUTToolsForLwc;
exports.createUser = createUser;
exports.removeEscapedCharacters = removeEscapedCharacters;
exports.generateSfProject = generateSfProject;
const cross_spawn_1 = __importDefault(require("cross-spawn"));
const child_process_1 = require("child_process");
const miscellaneous_1 = require("./miscellaneous");
const environmentSettings_1 = require("../environmentSettings");
async function runCliCommand(command, ...args) {
    const commandArgs = args.filter(arg => typeof arg === 'string');
    const hadJsonFlag = commandArgs.some(arg => arg === '--json');
    let options = args.find(arg => typeof arg !== 'string');
    let message = `running CLI command ${command} ${commandArgs.join(' ')}`;
    if (options) {
        message += `\nspawn options: ${JSON.stringify(options)}`;
    }
    const logLevel = environmentSettings_1.EnvironmentSettings.getInstance().logLevel;
    (0, miscellaneous_1.log)(message);
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
        const sfProcess = (0, cross_spawn_1.default)('sf', [command, ...commandArgs], options);
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
            const result = { stdout, stderr, exitCode: code ?? 0 };
            result.stdout = hadJsonFlag ? removeEscapedCharacters(result.stdout) : result.stdout;
            // Perform any necessary post-processing here
            // For example, you can modify the result object or log additional information
            (0, miscellaneous_1.log)(`Command finished with exit code ${result.exitCode}`);
            resolve(result);
        });
        sfProcess.on('error', err => {
            reject(new Error(`Failed to start process: ${err.message}`));
        });
    });
}
async function deleteScratchOrg(orgAliasName) {
    if (orgAliasName) {
        // The Terminal view can be a bit unreliable, so directly call exec() instead:
        const sfOrgDeleteResults = await runCliCommand('org:delete:scratch', '--target-org', orgAliasName, '--no-prompt');
        if (sfOrgDeleteResults.exitCode > 0) {
            (0, miscellaneous_1.log)(`deleteScratchOrg for org ${orgAliasName} failed with exit code ${sfOrgDeleteResults.exitCode}.\nRaw stderr ${sfOrgDeleteResults.stderr}.`);
        }
    }
}
async function orgLoginSfdxUrl(authFilePath) {
    const sfSfdxUrlStoreResult = await runCliCommand('org:login:sfdx-url', '-d', '-f', authFilePath);
    if (sfSfdxUrlStoreResult.exitCode > 0) {
        (0, miscellaneous_1.debug)('sfSfdxUrlStoreResult.exitCode = ' + sfSfdxUrlStoreResult.exitCode);
        (0, miscellaneous_1.debug)('sfSfdxUrlStoreResult.stdout = ' + sfSfdxUrlStoreResult.stdout);
        throw new Error(`orgLoginSfdxUrl failed with exit code ${sfSfdxUrlStoreResult.exitCode}\nRaw stderr: ${sfSfdxUrlStoreResult.stderr}\nRaw stdout: ${sfSfdxUrlStoreResult.stdout}`);
    }
    (0, miscellaneous_1.debug)(`orgLoginSfdxUrl results ${JSON.stringify(sfSfdxUrlStoreResult)}`);
    return sfSfdxUrlStoreResult;
}
async function orgDisplay(usernameOrAlias) {
    const sfOrgDisplayResult = await runCliCommand('org:display', '--target-org', usernameOrAlias, '--verbose', '--json');
    if (sfOrgDisplayResult.exitCode > 0) {
        const message = `sf org display failed with exit code: ${sfOrgDisplayResult.exitCode}.\n${sfOrgDisplayResult.stderr}`;
        (0, miscellaneous_1.log)(message);
        throw new Error(message);
    }
    (0, miscellaneous_1.debug)(`orgDisplay results ${JSON.stringify(sfOrgDisplayResult)}`);
    return sfOrgDisplayResult;
}
async function orgList() {
    const sfOrgListResult = await runCliCommand('org:list', '--json');
    if (sfOrgListResult.exitCode > 0) {
        const message = `org list failed with exit code ${sfOrgListResult.exitCode}\n stderr ${sfOrgListResult.stderr}`;
        (0, miscellaneous_1.log)(message);
        throw new Error(message);
    }
    (0, miscellaneous_1.debug)(`orgList results ${JSON.stringify(sfOrgListResult)}`);
    return sfOrgListResult;
}
async function aliasList() {
    const sfAliasListResult = await runCliCommand('alias:list', '--json');
    if (sfAliasListResult.exitCode > 0) {
        const message = `alias list failed with exit code ${sfAliasListResult.exitCode}\n stderr ${sfAliasListResult.stderr}`;
        (0, miscellaneous_1.log)(message);
        throw new Error(message);
    }
    (0, miscellaneous_1.debug)(`aliasList results ${JSON.stringify(sfAliasListResult)}`);
    return sfAliasListResult;
}
async function scratchOrgCreate(edition, definitionFileOrNone, scratchOrgAliasName, durationDays) {
    (0, miscellaneous_1.log)('calling "sf org:create:scratch"...');
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
        (0, miscellaneous_1.log)(`create scratch org failed. Exit code: ${sfOrgCreateResult.exitCode}. \ncreate scratch org failed. Raw stderr: ${sfOrgCreateResult.stderr}`);
        throw new Error(sfOrgCreateResult.stderr);
    }
    (0, miscellaneous_1.log)(`..."sf org:create:scratch" finished`);
    (0, miscellaneous_1.debug)(`scratchOrgCreate results ${JSON.stringify(sfOrgCreateResult)}`);
    return sfOrgCreateResult;
}
async function setAlias(devHubAliasName, devHubUserName) {
    const setAliasResult = await runCliCommand('alias:set', `${devHubAliasName}=${devHubUserName}`);
    if (setAliasResult.exitCode > 0) {
        (0, miscellaneous_1.log)(`alias failed. Exit code: ${setAliasResult.exitCode}. \nRaw stderr: ${setAliasResult.stderr}`);
        throw new Error(setAliasResult.stderr);
    }
    return setAliasResult;
}
async function installJestUTToolsForLwc(projectFolder) {
    (0, miscellaneous_1.log)(`SetUp - Started Install @salesforce/sfdx-lwc-jest Node module...`);
    if (!projectFolder) {
        throw new Error('cannot setup lwc tests without a project folder.');
    }
    const command = 'npm install @lwc/eslint-plugin-lwc@^2.0.0 --save-dev && npm install && npm uninstall husky --force && npm install eslint@^8 --save-dev && npm install --save-dev && npm install @salesforce/sfdx-lwc-jest --save-dev';
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, { cwd: projectFolder }, (error, stdout, stderr) => {
            if (error) {
                (0, miscellaneous_1.log)(`Error with ${command}`);
                reject(error);
                return;
            }
            if (stderr) {
                (0, miscellaneous_1.log)(`Error output for ${command}`);
            }
            (0, miscellaneous_1.log)(stdout);
            (0, miscellaneous_1.log)(`...SetUp - Finished Install @salesforce/sfdx-lwc-jest Node module`);
            resolve();
        });
    });
}
async function createUser(systemAdminUserDefPath, targetOrg) {
    if (!targetOrg) {
        throw new Error('cannot create user with target');
    }
    const sfOrgCreateUserResult = await runCliCommand('org:create:user', '--definition-file', systemAdminUserDefPath, '--target-org', targetOrg);
    if (sfOrgCreateUserResult.exitCode > 0) {
        (0, miscellaneous_1.log)(`org create user failed Exit code: ${sfOrgCreateUserResult.exitCode}. \nRaw stderr: ${sfOrgCreateUserResult.stderr}`);
        throw new Error(sfOrgCreateUserResult.stderr);
    }
    (0, miscellaneous_1.debug)(`createUser results ${JSON.stringify(sfOrgCreateUserResult)}`);
    return sfOrgCreateUserResult;
}
function removeEscapedCharacters(result) {
    const resultJson = result.replace(/\u001B\[\d\dm/g, '').replace(/\\n/g, '');
    return resultJson;
}
async function generateSfProject(name, path, template) {
    const sfProjectGenerateResult = await runCliCommand('project:generate', '--name', name, '--template', template ?? 'standard', ...(path ? ['-d', path] : []));
    if (sfProjectGenerateResult.exitCode > 0) {
        (0, miscellaneous_1.log)(`project generate failed Exit code: ${sfProjectGenerateResult.exitCode}. \nRaw stderr: ${sfProjectGenerateResult.stderr}`);
        throw new Error(sfProjectGenerateResult.stderr);
    }
    (0, miscellaneous_1.debug)(`generateSfProject results ${JSON.stringify(sfProjectGenerateResult)}`);
    return sfProjectGenerateResult;
}
//# sourceMappingURL=cliCommands.js.map
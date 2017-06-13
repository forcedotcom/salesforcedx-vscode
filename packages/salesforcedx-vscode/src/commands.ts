import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as status from './status';

let channel = vscode.window.createOutputChannel('Salesforce');

export function forceAuthWebLogin() {
    channel.appendLine('force:auth:web:login');

    status.showStatus('Authenticating');
    child_process.exec(
        `sfdx force:auth:web:login -d`,
        {
            cwd: vscode.workspace.rootPath
        },
        (err, stdout, stderr) => {
            genericOutputHandler(err, stdout, stderr, 'force:auth:web:login');
            status.hideStatus();
        });
}

export function forceOrgCreate() {
    channel.appendLine('force:org:create');

    vscode.workspace.findFiles('config/*.json', '').then(files => {
        let fileItems: vscode.QuickPickItem[] = files.map(file => {
            return {
                label: path.basename(file.toString()),
                description: file.fsPath,
            }
        });
        vscode.window.showQuickPick(fileItems).then(selection => {
            if (selection) {
                status.showStatus('Creating org');
                let rootPath = vscode.workspace.rootPath!;
                let selectionPath = path.relative(rootPath, selection.description.toString());
                child_process.exec(
                    `sfdx force:org:create -f ${selectionPath} -s`,
                    {
                        cwd: vscode.workspace.rootPath
                    },
                    (err, stdout, stderr) => {
                        genericOutputHandler(err, stdout, stderr, 'force:org:create');
                        status.hideStatus();
                    });
            }
        });
    });
}

export function forceOrgOpen() {
    channel.appendLine('force:org:open');

    status.showStatus('Opening org');
    child_process.exec(
        `sfdx force:org:open`,
        {
            cwd: vscode.workspace.rootPath
        },
        (err, stdout, stderr) => {
            genericOutputHandler(err, stdout, stderr, 'force:org:open');
            status.hideStatus();
        });
}

export function forceSourcePull() {
    channel.appendLine('force:source:pull');

    status.showStatus('Pulling from org...');
    child_process.exec(
        `sfdx force:source:pull`,
        {
            cwd: vscode.workspace.rootPath
        },
        (err, stdout, stderr) => {
            genericOutputHandler(err, stdout, stderr, `force:source:pull`);
            status.hideStatus();
        });
}

export function forceSourcePush() {
    channel.appendLine('force:source:push');

    status.showStatus('Pushing to org');
    child_process.exec(
        `sfdx force:source:push`,
        {
            cwd: vscode.workspace.rootPath
        },
        (err, stdout, stderr) => {
            genericOutputHandler(err, stdout, stderr, `force:source:push`);
            status.hideStatus();
        });
}

export function forceSourceStatus() {
    channel.appendLine('force:source:status');

    status.showStatus('Checking status against org');
    child_process.exec(
        `sfdx force:source:status`,
        {
            cwd: vscode.workspace.rootPath
        },
        (err, stdout, stderr) => {
            genericOutputHandler(err, stdout, stderr, `force:source:status`);
            status.hideStatus();
        });
}

export function forceApexTestRun(testClass?: string) {
    channel.appendLine('force:apex:test:run');

    if (testClass) {
        status.showStatus('Running apex tests');
        child_process.exec(
            `sfdx force:apex:test:run -n ${testClass} -r human`,
            {
                cwd: vscode.workspace.rootPath
            },
            (err, stdout, stderr) => {
                genericOutputHandler(err, stdout, stderr, 'force:apex:test:run');
                status.hideStatus();
            });
    } else {
        vscode.workspace.findFiles('**/*.testSuite-meta.xml', '').then(files => {
            let fileItems: vscode.QuickPickItem[] = files.map(file => {
                return {
                    label: path.basename(file.toString()).replace('.testSuite-meta.xml', ''),
                    description: file.fsPath,
                }
            });

            fileItems.push({
                label: 'All tests',
                description: 'Runs all tests in the current workspace',
            });

            vscode.window.showQuickPick(fileItems).then(selection => {
                if (selection) {
                    status.showStatus('Running apex tests');
                    if (selection.label === 'All tests') {
                        child_process.exec(
                            `sfdx force:apex:test:run -r human`,
                            {
                                cwd: vscode.workspace.rootPath
                            },
                            (err, stdout, stderr) => {
                                genericOutputHandler(err, stdout, stderr, 'force:apex:test:run');
                                status.hideStatus();
                            });
                    } else {
                        child_process.exec(
                            `sfdx force:apex:test:run -s ${selection.label} -r human`,
                            {
                                cwd: vscode.workspace.rootPath
                            },
                            (err, stdout, stderr) => {
                                genericOutputHandler(err, stdout, stderr, 'force:apex:test:run');
                                status.hideStatus();
                            });
                    }
                }
            });
        });
    }

}

function genericOutputHandler(err: Error, stdout: string, stderr: string, command: string) {
    if (err) {
        vscode.window.showErrorMessage(err.message);
    }

    channel.clear();

    if (stdout) {
        channel.append(stdout);
        channel.show();
    }

    if (stderr) {
        vscode.window.showErrorMessage(`Failed to execute${command}. Check the console for errors.`);
        channel.append(stderr);
        channel.show(true);
    }

}
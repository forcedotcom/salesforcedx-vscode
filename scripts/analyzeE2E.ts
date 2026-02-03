/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync, spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

type WorkflowRun = {
  databaseId: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  workflowName: string;
  createdAt: string;
  headBranch: string;
};

type WorkflowStatus = {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
};

const checkPrerequisites = (): void => {
  try {
    execSync('which gh', { stdio: 'ignore' });
  } catch {
    console.error('GitHub CLI (gh) not found. Install from: https://cli.github.com/');
    process.exit(1);
  }

  try {
    execSync('gh auth status', { stdio: 'ignore' });
  } catch {
    console.error('GitHub CLI not authenticated. Run: gh auth login');
    process.exit(1);
  }
};

const getCurrentBranch = (): string => {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    if (!branch) {
      throw new Error('No branch checked out');
    }
    return branch;
  } catch (error) {
    console.error('No branch checked out. Please checkout a branch first.');
    process.exit(1);
  }
};

const findPlaywrightWorkflows = (branch: string): WorkflowRun[] => {
  try {
    const output = execSync(
      `gh run list -b ${branch} --limit 50 --json databaseId,status,conclusion,workflowName,createdAt,headBranch`,
      { encoding: 'utf-8' }
    );
    const runs = JSON.parse(output) as WorkflowRun[];
    return runs.filter(run => run.workflowName.includes('(Playwright)'));
  } catch (error) {
    console.error(
      `Failed to list workflows for branch ${branch}:`,
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
};

const prioritizeWorkflows = (workflows: WorkflowRun[]): WorkflowRun[] => {
  const running = workflows.filter(w => w.status === 'in_progress' || w.status === 'queued');
  if (running.length > 0) {
    return running;
  }
  return workflows
    .filter(w => w.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 1);
};

const watchWorkflow = (runId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['run', 'watch', String(runId)], {
      stdio: 'inherit'
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`gh run watch exited with code ${code}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
};

const checkWorkflowStatus = (runId: number): WorkflowStatus => {
  try {
    const output = execSync(`gh run view ${runId} --json status,conclusion`, { encoding: 'utf-8' });
    return JSON.parse(output) as WorkflowStatus;
  } catch (error) {
    console.error(`Failed to check workflow status:`, error instanceof Error ? error.message : String(error));
    return { status: 'completed', conclusion: null };
  }
};

const monitorWorkflows = async (workflows: WorkflowRun[]): Promise<WorkflowRun[]> => {
  const running = workflows.filter(w => w.status === 'in_progress' || w.status === 'queued');

  if (running.length === 0) {
    return workflows;
  }

  console.log(`Monitoring ${running.length} workflow(s)...`);

  for (const workflow of running) {
    console.log(`Monitoring workflow: ${workflow.workflowName} (run ${workflow.databaseId})...`);

    try {
      await watchWorkflow(workflow.databaseId);
    } catch (error) {
      console.log(`Watch command completed or timed out, checking status...`);
    }

    // Poll until completed
    let status = checkWorkflowStatus(workflow.databaseId);
    while (status.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = checkWorkflowStatus(workflow.databaseId);
    }

    // Update workflow with final status
    workflow.status = status.status;
    workflow.conclusion = status.conclusion;
  }

  return workflows;
};

const sanitizeWorkflowName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
};

const downloadArtifacts = (runId: number, branch: string, workflowName: string): string | undefined => {
  const sanitizedName = sanitizeWorkflowName(workflowName);
  const artifactDir = `.e2e-artifacts/${branch}/${runId}-${sanitizedName}`;

  try {
    // Check if artifacts exist
    const artifactsOutput = execSync(`gh run view ${runId} --json artifacts`, { encoding: 'utf-8' });
    const artifacts = JSON.parse(artifactsOutput) as { artifacts: Array<{ name: string }> };

    if (!artifacts.artifacts || artifacts.artifacts.length === 0) {
      console.log('No artifacts available for this workflow run.');
      return undefined;
    }

    mkdirSync(artifactDir, { recursive: true });
    execSync(`gh run download ${runId} -D ${artifactDir}`, { stdio: 'inherit' });

    // Extract zip files if needed
    try {
      execSync(`find ${artifactDir} -name "*.zip" -exec unzip -o {} -d ${artifactDir} \\;`, { stdio: 'ignore' });
    } catch {
      // No zip files or unzip failed, continue
    }

    return artifactDir;
  } catch (error) {
    console.error(`Failed to download artifacts:`, error instanceof Error ? error.message : String(error));
    console.log(`Try manual download: gh run download ${runId}`);
    return undefined;
  }
};

const findHtmlReport = async (artifactDir: string): Promise<string | undefined> => {
  try {
    const reports = await glob('**/playwright-report/index.html', { cwd: artifactDir });
    return reports.length > 0 ? join(artifactDir, reports[0]) : undefined;
  } catch {
    return undefined;
  }
};

const findTestResults = async (artifactDir: string): Promise<string[]> => {
  try {
    return await glob('**/test-results/**', { cwd: artifactDir });
  } catch {
    return [];
  }
};

const handleResults = async (workflows: WorkflowRun[], branch: string): Promise<void> => {
  for (const workflow of workflows) {
    if (workflow.conclusion === 'success') {
      console.log(`✓ E2E tests passed for workflow \`${workflow.workflowName}\` on branch \`${branch}\``);
      console.log(`View workflow: gh run view ${workflow.databaseId} --web`);
    } else if (workflow.conclusion === 'failure' || workflow.conclusion === 'cancelled') {
      const symbol = workflow.conclusion === 'failure' ? '✗' : '⊘';
      console.log(
        `${symbol} E2E tests ${workflow.conclusion === 'failure' ? 'failed' : 'cancelled'} for workflow \`${workflow.workflowName}\` on branch \`${branch}\``
      );

      const artifactDir = downloadArtifacts(workflow.databaseId, branch, workflow.workflowName);

      if (artifactDir) {
        console.log(`Artifacts downloaded to: ${artifactDir}`);

        const htmlReport = await findHtmlReport(artifactDir);
        const testResults = await findTestResults(artifactDir);

        if (htmlReport) {
          console.log(`HTML report found: ${htmlReport}`);
          console.log(`Open with: open ${htmlReport}`);
        }

        if (testResults.length > 0) {
          console.log(`Test results found: ${testResults.length} file(s)`);
        }

        console.log(`View workflow: gh run view ${workflow.databaseId} --web`);
      }
    }
  }
};

const main = async (): Promise<void> => {
  checkPrerequisites();

  const branch = getCurrentBranch();
  console.log(`Current branch: ${branch}`);

  const allWorkflows = findPlaywrightWorkflows(branch);

  if (allWorkflows.length === 0) {
    try {
      execSync(`git ls-remote --heads origin ${branch}`, { stdio: 'ignore' });
      console.log(`No e2e workflows found for branch \`${branch}\`. The branch may not have triggered workflows yet.`);
    } catch {
      console.log(
        `No e2e workflows found for branch \`${branch}\`. This branch may not have been pushed or may not trigger e2e workflows.`
      );
    }
    console.log('Push your commits to trigger workflows, or check the workflow configuration.');
    process.exit(0);
  }

  const workflows = prioritizeWorkflows(allWorkflows);
  console.log(`Found ${workflows.length} workflow(s) to monitor`);

  const monitoredWorkflows = await monitorWorkflows(workflows);
  await handleResults(monitoredWorkflows, branch);
};

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { main, checkPrerequisites, getCurrentBranch, findPlaywrightWorkflows };

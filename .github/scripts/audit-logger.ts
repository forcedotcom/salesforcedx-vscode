/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { appendFileSync, existsSync } from 'fs';
import { join } from 'path';

interface AuditLogEntry {
  timestamp: string;
  action: string;
  actor: string;
  repository: string;
  branch: string;
  workflow: string;
  runId: string;
  details: Record<string, any>;
}

interface AuditLoggerOptions {
  action: string;
  actor: string;
  repository: string;
  branch: string;
  workflow: string;
  runId: string;
  details: string;
  logFile?: string;
}

function getAuditLogPath(): string {
  const logDir = join(process.cwd(), '.github', 'audit-logs');
  const logFile = join(logDir, 'release-audit.log');

  // Ensure log directory exists
  if (!existsSync(logDir)) {
    // Create directory if it doesn't exist
    const fs = require('fs');
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logFile;
}

function formatAuditEntry(entry: AuditLogEntry): string {
  const timestamp = new Date().toISOString();
  const details = JSON.stringify(entry.details, null, 2);

  // eslint-disable-next-line max-len
  const header = `[${timestamp}] ${entry.action} | Actor: ${entry.actor} | Repo: ${entry.repository} | Branch: ${entry.branch} | Workflow: ${entry.workflow} | Run: ${entry.runId}`;
  const separator = '-'.repeat(80);

  return `${header}\nDetails: ${details}\n${separator}\n`;
}

function logAuditEvent(options: AuditLoggerOptions): void {
  const {
    action,
    actor,
    repository,
    branch,
    workflow,
    runId,
    details,
    logFile,
  } = options;

  try {
    // Parse details JSON
    const parsedDetails = JSON.parse(details);

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      actor,
      repository,
      branch,
      workflow,
      runId,
      details: parsedDetails,
    };

    const auditLogPath = logFile || getAuditLogPath();
    const logEntry = formatAuditEntry(entry);

    // Append to audit log
    appendFileSync(auditLogPath, logEntry, 'utf-8');

    console.log(`✅ Audit log entry written to: ${auditLogPath}`);
    console.log(`Action: ${action}`);
    console.log(`Actor: ${actor}`);
    console.log(`Repository: ${repository}`);
    console.log(`Branch: ${branch}`);
    console.log(`Workflow: ${workflow}`);
    console.log(`Run ID: ${runId}`);
    console.log('Details:', JSON.stringify(parsedDetails, null, 2));
  } catch (error) {
    console.error('Failed to write audit log entry:', error);
    throw error;
  }
}

// Export for use in other modules
export { logAuditEvent };

import {
  commandDenial,
  editedPaths,
  formatCompletionFailure,
  formatEditFailure,
  verifyCompletion,
  verifyEdit
} from '../../scripts/ai-safeguards.mjs';

const createSafeguards = ({ client, worktree }, verify = {}) => {
  const dirty = new Set();
  const verifying = new Set();
  const continuationIssued = new Set();
  const editVersions = new Map();
  const runEditVerification = verify.edit ?? verifyEdit;
  const runCompletionVerification = verify.completion ?? verifyCompletion;

  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;
      const reason = commandDenial({
        command: output.args.command ?? '',
        cwd: output.args.workdir ?? worktree
      });
      if (reason) throw new Error(reason);
    },
    'tool.execute.after': async (input, output) => {
      const files = editedPaths(input.tool, input.args);
      if (!files.length) return;
      dirty.add(input.sessionID);
      editVersions.set(input.sessionID, (editVersions.get(input.sessionID) ?? 0) + 1);
      continuationIssued.delete(input.sessionID);
      const message = formatEditFailure(runEditVerification({ root: worktree, files }));
      if (message) output.output = `${output.output}\n\n${message}`;
    },
    event: async ({ event }) => {
      if (event.type !== 'session.idle') return;
      const sessionID = event.properties.sessionID;
      if (!dirty.has(sessionID) || verifying.has(sessionID) || continuationIssued.has(sessionID)) return;
      verifying.add(sessionID);
      const verifiedVersion = editVersions.get(sessionID) ?? 0;
      try {
        const result = await Promise.resolve(runCompletionVerification({ root: worktree }));
        const message = formatCompletionFailure(result);
        if (!message && editVersions.get(sessionID) === verifiedVersion) dirty.delete(sessionID);
        if (message) {
          continuationIssued.add(sessionID);
          const response = await client.session.promptAsync({
            path: { id: sessionID },
            body: {
              parts: [
                {
                  type: 'text',
                  text: `${message}\nContinue in this session: fix the failure, then complete the task.`
                }
              ]
            }
          });
          if (response.error) {
            continuationIssued.delete(sessionID);
            throw new Error(`Unable to continue failed verification: ${response.error}`);
          }
        }
      } finally {
        verifying.delete(sessionID);
      }
    }
  };
};

export default async (input, options) => createSafeguards(input, options);

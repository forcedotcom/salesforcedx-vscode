import {
  commandDenial,
  editedPaths,
  formatCompletionFailure,
  formatEditFailure,
  verifyCompletionAsync,
  verifyEditAsync
} from '../../scripts/ai-safeguards.mjs';

const eventData = event => event?.data ?? event?.properties ?? event;

const sessionIDOf = event => {
  const data = eventData(event);
  return data?.sessionID ?? event?.sessionID;
};

const isIdleEvent = event => {
  if (event?.type === 'session.idle') return true;
  if (event?.type !== 'session.status') return false;
  const status = eventData(event)?.status;
  return (typeof status === 'string' ? status : status?.type) === 'idle';
};

const appendEditFailure = (result, existing) => {
  const message = formatEditFailure(result);
  if (!message) return existing;
  if (existing.status !== 'completed') return existing;
  const content = resultContent(existing.result);
  if (content === undefined) return existing;
  return {
    ...existing,
    result: {
      ...existing.result,
      content: `${content}\n\n${message}`
    }
  };
};

const resultContent = result => {
  if (typeof result?.content === 'string') return result.content;
  const text = result?.content?.find?.(part => part?.type === 'text')?.text;
  return typeof text === 'string' ? text : undefined;
};

export const createSafeguards = ({ session, worktree }, verify = {}) => {
  const dirty = new Set();
  const verifying = new Set();
  const continuationIssued = new Set();
  const editVersions = new Map();
  const runEditVerification = verify.edit ?? verifyEditAsync;
  const runCompletionVerification = verify.completion ?? verifyCompletionAsync;

  const denyUnsafeShell = ({ command, cwd }) => {
    const reason = commandDenial({ command, cwd: cwd ?? worktree });
    if (reason) throw new Error(reason);
  };

  const afterEdit = async ({ tool, sessionID, input, output }) => {
    const files = editedPaths(tool, input);
    if (!files.length) return output;
    dirty.add(sessionID);
    editVersions.set(sessionID, (editVersions.get(sessionID) ?? 0) + 1);
    continuationIssued.delete(sessionID);
    return appendEditFailure(await runEditVerification({ root: worktree, files }), output);
  };

  const onIdle = async event => {
    if (!isIdleEvent(event)) return;
    const sessionID = sessionIDOf(event);
    if (!sessionID || !dirty.has(sessionID) || verifying.has(sessionID) || continuationIssued.has(sessionID)) {
      return;
    }
    verifying.add(sessionID);
    const verifiedVersion = editVersions.get(sessionID) ?? 0;
    try {
      const message = formatCompletionFailure(await Promise.resolve(runCompletionVerification({ root: worktree })));
      if (!message && editVersions.get(sessionID) === verifiedVersion) dirty.delete(sessionID);
      if (!message) return;
      continuationIssued.add(sessionID);
      await session.prompt({
        sessionID,
        text: `${message}\nContinue in this session: fix the failure, then complete the task.`
      });
    } catch (error) {
      continuationIssued.delete(sessionID);
      throw error;
    } finally {
      verifying.delete(sessionID);
    }
  };

  return { denyUnsafeShell, afterEdit, onIdle };
};

/** Worktree for verification: plugin/repo location, not daemon process.cwd(). */
export const createSafeguardsFromContext = (ctx, verify) =>
  createSafeguards({ session: ctx.session, worktree: ctx.location.directory }, verify);

export const runSafeguardEventLoop = async ({ events, onIdle, reportError, signal }) => {
  const completionVerifications = new Set();
  const dispatchCompletionVerification = event => {
    const completionVerification = onIdle(event)
      .catch(error => reportError('Completion verification failed', error))
      .finally(() => completionVerifications.delete(completionVerification));
    completionVerifications.add(completionVerification);
  };

  try {
    for await (const event of events) {
      dispatchCompletionVerification(event);
    }
  } catch (error) {
    if (!signal?.aborted) reportError('Event subscription failed', error);
  }
  await Promise.allSettled(completionVerifications);
};

const plugin = {
  id: 'safeguards',
  async setup(ctx) {
    const hooks = createSafeguardsFromContext(ctx);

    await ctx.shell.hook('create.before', event => {
      hooks.denyUnsafeShell({ command: event.command, cwd: event.cwd });
    });

    await ctx.tool.hook('execute.after', async event => {
      if (event.status !== 'completed') return;
      const next = await hooks.afterEdit({
        tool: event.tool,
        sessionID: event.sessionID,
        input: event.input,
        output: event
      });
      if (next !== event && next.status === 'completed') event.result = next.result;
    });

    const controller = new AbortController();
    const loop = runSafeguardEventLoop({
      events: ctx.event.subscribe({ signal: controller.signal }),
      onIdle: hooks.onIdle,
      reportError: (message, error) => console.error(`[safeguards] ${message}`, error),
      signal: controller.signal
    });

    return async () => {
      controller.abort();
      await loop;
    };
  }
};

export default plugin;

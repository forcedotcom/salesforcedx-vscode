import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  NO_VERIFY_REASON,
  commandDenial,
  editedPaths,
  verifyCompletion,
  verifyCompletionAsync,
  verifyEdit,
  verifyEditAsync
} from '../scripts/ai-safeguards.mjs';
import {
  createSafeguards,
  createSafeguardsFromContext,
  runSafeguardEventLoop
} from '../.opencode/plugins/safeguards.ts';

const temporaryDirectory = async callback => {
  const directory = await mkdtemp(resolve(tmpdir(), 'ai-safeguards-'));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const fakeRun = responses => {
  const calls = [];
  const run = input => {
    calls.push(input);
    return responses.shift() ?? { ok: true, output: '' };
  };
  return { calls, run };
};

test('denies git --no-verify', () => {
  assert.equal(commandDenial({ command: 'git commit --no-verify', cwd: '/tmp' }), NO_VERIFY_REASON);
  assert.equal(commandDenial({ command: 'git commit --no\\\n-verify', cwd: '/tmp' }), NO_VERIFY_REASON);
  assert.equal(commandDenial({ command: 'git commit --no-veri\\fy', cwd: '/tmp' }), NO_VERIFY_REASON);
  assert.equal(commandDenial({ command: 'git commit --no-veri""fy', cwd: '/tmp' }), NO_VERIFY_REASON);
});

test('denies dynamically assembled Git safeguards', () => {
  assert.match(commandDenial({ command: 'x=; git p${x}ush', cwd: '/tmp' }), /shell expansion/);
  assert.match(commandDenial({ command: 'x=; git commit --no-veri${x}fy', cwd: '/tmp' }), /shell expansion/);
  assert.match(commandDenial({ command: 'g=git; $g push', cwd: '/tmp' }), /shell expansion/);
  assert.match(commandDenial({ command: 'g=git; $g commit --no-verify', cwd: '/tmp' }), /shell expansion/);
});

test('allows literal shell characters in single-quoted Git arguments', () => {
  assert.equal(commandDenial({ command: "git commit -m 'cost $5 `literal`'", cwd: '/tmp' }), undefined);
});

test('inspects nested shell and eval Git commands', async () =>
  temporaryDirectory(root => {
    const commands = [
      "bash -c 'git commit --no-verify'",
      "bash -lc 'git commit --no-verify'",
      "bash -c 'git push'",
      'sh -c "git push"',
      "eval 'git push'",
      'eval "bash -c \'git commit --no-verify\'"'
    ];
    commands.forEach(command => {
      const { run } = fakeRun([{ ok: true, output: root }]);
      assert.ok(commandDenial({ command, cwd: root, run }));
    });
  }));

test('allows commands that only print Git text', () => {
  assert.equal(commandDenial({ command: 'echo git --no-verify', cwd: '/tmp' }), undefined);
  assert.equal(commandDenial({ command: "printf '%s' git push", cwd: '/tmp' }), undefined);
});

test('supports known executable wrappers', async () =>
  temporaryDirectory(root => {
    [
      'command git push',
      'command -p git push',
      'env FOO=bar git push',
      'sudo -u root git push',
      'command env git push',
      'sudo env git push',
      'sudo command git push',
      "env bash -lc 'git push'"
    ].forEach(command => {
      const { run } = fakeRun([{ ok: true, output: root }]);
      assert.match(commandDenial({ command, cwd: root, run }), /node_modules missing/);
    });
    assert.match(commandDenial({ command: 'env -S "git push"', cwd: root }), /shell expansion/);
  }));

test('denies push when repository dependencies are absent', async () =>
  temporaryDirectory(root => {
    const { run } = fakeRun([{ ok: true, output: root }]);
    assert.match(commandDenial({ command: 'git push', cwd: root, run }), /node_modules missing/);
  }));

test('allows push when node_modules is a symlink', async () =>
  temporaryDirectory(root => {
    const dependencies = resolve(root, 'dependencies');
    mkdirSync(dependencies);
    symlinkSync(dependencies, resolve(root, 'node_modules'));
    const { run } = fakeRun([{ ok: true, output: root }]);
    assert.equal(commandDenial({ command: 'git push', cwd: root, run }), undefined);
  }));

test('tracks cd before a bare push', async () =>
  temporaryDirectory(root => {
    const nested = resolve(root, 'nested');
    mkdirSync(nested);
    const { calls, run } = fakeRun([{ ok: true, output: nested }]);
    commandDenial({ command: 'cd nested && git push', cwd: root, run });
    assert.equal(calls[0].args[1], nested);
  }));

test('checks quoted git -C paths', async () =>
  temporaryDirectory(root => {
    const repository = resolve(root, 'repo with spaces');
    mkdirSync(repository);
    const { calls, run } = fakeRun([{ ok: true, output: repository }]);
    assert.match(commandDenial({ command: `git -C "${repository}" push`, cwd: root, run }), /node_modules missing/);
    assert.equal(calls[0].args[1], repository);
  }));

test('preserves Windows separators in quoted git -C paths', () => {
  const repository = String.raw`C:\Users\runner\repo with spaces`;
  const { calls, run } = fakeRun([{ ok: true, output: repository }]);
  assert.match(commandDenial({ command: `git -C "${repository}" push`, cwd: repository, run }), /node_modules missing/);
  assert.equal(calls[0].args[1], repository);
});

test('does not split shell metacharacters inside quoted paths', async () =>
  temporaryDirectory(root => {
    const repository = resolve(root, 'repo;name');
    mkdirSync(repository);
    const { calls, run } = fakeRun([{ ok: true, output: repository }]);
    assert.match(commandDenial({ command: `git -C "${repository}" push`, cwd: root, run }), /node_modules missing/);
    assert.equal(calls[0].args[1], repository);
  }));

test('resolves git -C after cd and Git global options', async () =>
  temporaryDirectory(root => {
    const nested = resolve(root, 'nested');
    const repository = resolve(nested, 'repo with spaces');
    mkdirSync(repository, { recursive: true });
    const { calls, run } = fakeRun([{ ok: true, output: repository }]);
    const command = 'cd nested && git --no-pager -C "repo with spaces" push';
    assert.match(commandDenial({ command, cwd: root, run }), /node_modules missing/);
    assert.equal(calls[0].args[1], repository);
  }));

test('checks push split over a shell line continuation', async () =>
  temporaryDirectory(root => {
    const { run } = fakeRun([{ ok: true, output: root }]);
    assert.match(commandDenial({ command: 'git \\\npush', cwd: root, run }), /node_modules missing/);
  }));

test('checks escaped and quote-concatenated push subcommands', async () =>
  temporaryDirectory(root => {
    const { run } = fakeRun([
      { ok: true, output: root },
      { ok: true, output: root }
    ]);
    assert.match(commandDenial({ command: 'git p\\ush', cwd: root, run }), /node_modules missing/);
    assert.match(commandDenial({ command: 'git p""ush', cwd: root, run }), /node_modules missing/);
  }));

test('denies push with attached repository directory options', () => {
  assert.match(
    commandDenial({ command: 'git --git-dir=/target/.git --work-tree=/target push', cwd: '/tmp' }),
    /Use git -C/
  );
  assert.match(
    commandDenial({ command: 'git --git-dir /target/.git --work-tree /target push', cwd: '/tmp' }),
    /Use git -C/
  );
});

test('extracts and deduplicates apply_patch paths', () => {
  const patchText = `*** Begin Patch
*** Update File: src/a.ts
*** Move to: src/b.ts
*** Update File: src/a.ts
*** End Patch`;
  assert.deepEqual(editedPaths('apply_patch', { patchText }), ['src/a.ts', 'src/b.ts']);
});

test('extracts edit path from V2 path field', () => {
  assert.deepEqual(editedPaths('edit', { path: 'src/a.ts' }), ['src/a.ts']);
});

test('edit verification stops after compile failure', () => {
  const { calls, run } = fakeRun([{ ok: false, output: 'compile failed' }]);
  const result = verifyEdit({ root: '/tmp', files: ['/tmp/a.ts'], run });
  assert.equal(result.step, 'compile');
  assert.equal(calls.length, 1);
});

test('completion verification runs checks in order', () => {
  const { calls, run } = fakeRun(Array.from({ length: 8 }, () => ({ ok: true, output: '' })));
  assert.equal(verifyCompletion({ root: '/tmp', run }).ok, true);
  assert.deepEqual(
    calls.filter(call => call.command === 'npm').map(call => call.args[1]),
    ['compile', 'lint', 'test', 'vscode:bundle', 'check:knip']
  );
});

test('async verification awaits nonblocking runners in order', async () => {
  const calls = [];
  const run = async input => {
    calls.push(input);
    await new Promise(resolveRun => setTimeout(resolveRun, 0));
    return { ok: true, output: '' };
  };
  assert.equal((await verifyEditAsync({ root: '/tmp', files: [], run })).ok, true);
  assert.equal((await verifyCompletionAsync({ root: '/tmp', run })).ok, true);
  assert.deepEqual(
    calls.filter(call => call.command === 'npm').map(call => call.args[1]),
    ['compile', 'compile', 'lint', 'test', 'vscode:bundle', 'check:knip']
  );
});

test('plugin setup verifies edits and completion against ctx.location.directory', async () => {
  const pluginDirectory = '/plugin/location';
  const cwd = process.cwd();
  assert.notEqual(pluginDirectory, cwd);
  const roots = [];
  const hooks = createSafeguardsFromContext(
    { session: {}, location: { directory: pluginDirectory } },
    {
      edit: input => {
        roots.push(input.root);
        return { ok: true, step: 'edit verification' };
      },
      completion: input => {
        roots.push(input.root);
        return { ok: true, step: 'completion verification' };
      }
    }
  );
  await hooks.afterEdit({
    tool: 'edit',
    sessionID: 'session',
    input: { path: 'src/a.ts' },
    output: { status: 'completed', result: { content: 'edited' } }
  });
  await hooks.onIdle({ type: 'session.idle', data: { sessionID: 'session' } });
  assert.deepEqual(roots, [pluginDirectory, pluginDirectory]);
  assert.ok(roots.every(root => root !== cwd));
});

test('OpenCode event subscription drains while completion verification runs', async () => {
  const finishVerifications = [];
  let eventsConsumed = 0;
  const events = async function* () {
    eventsConsumed += 1;
    yield { type: 'session.idle', data: { sessionID: 'one' } };
    eventsConsumed += 1;
    yield { type: 'session.idle', data: { sessionID: 'two' } };
  };
  const loop = runSafeguardEventLoop({
    events: events(),
    onIdle: () =>
      new Promise(resolveVerification => {
        finishVerifications.push(resolveVerification);
      }),
    reportError: assert.fail
  });

  await new Promise(resolveImmediate => setImmediate(resolveImmediate));
  assert.equal(eventsConsumed, 2);
  finishVerifications.forEach(finishVerification => finishVerification());
  await loop;
});

test('OpenCode event subscription does not overlap completion verification for one session', async () => {
  let finishVerification;
  let verifications = 0;
  const hooks = createSafeguards(
    { session: {}, worktree: '/tmp' },
    {
      edit: async () => ({ ok: true, step: 'edit verification' }),
      completion: () => {
        verifications += 1;
        return new Promise(resolveVerification => {
          finishVerification = resolveVerification;
        });
      }
    }
  );
  await hooks.afterEdit({
    tool: 'edit',
    sessionID: 'session',
    input: { path: '/tmp/file.ts' },
    output: { status: 'completed', result: { content: 'edited' } }
  });
  const events = async function* () {
    yield { type: 'session.idle', data: { sessionID: 'session' } };
    yield { type: 'session.idle', data: { sessionID: 'session' } };
  };
  const loop = runSafeguardEventLoop({
    events: events(),
    onIdle: hooks.onIdle,
    reportError: assert.fail
  });

  await new Promise(resolveImmediate => setImmediate(resolveImmediate));
  assert.equal(verifications, 1);
  finishVerification({ ok: true, step: 'completion verification' });
  await loop;
});

test('OpenCode event subscription and completion failures are reported', async () => {
  const subscriptionFailure = new Error('subscription failed');
  const completionFailure = new Error('completion failed');
  const errors = [];
  const events = async function* () {
    yield { type: 'session.idle', data: { sessionID: 'session' } };
    throw subscriptionFailure;
  };

  await runSafeguardEventLoop({
    events: events(),
    onIdle: async () => Promise.reject(completionFailure),
    reportError: (message, error) => errors.push({ message, error })
  });

  assert.deepEqual(errors, [
    { message: 'Event subscription failed', error: subscriptionFailure },
    { message: 'Completion verification failed', error: completionFailure }
  ]);
});

test('OpenCode event subscription does not report normal cleanup abort', async () => {
  const controller = new AbortController();
  const errors = [];
  const events = {
    async *[Symbol.asyncIterator]() {
      throw new Error('aborted');
    }
  };
  controller.abort();

  await runSafeguardEventLoop({
    events,
    onIdle: assert.fail,
    reportError: (message, error) => errors.push({ message, error }),
    signal: controller.signal
  });

  assert.deepEqual(errors, []);
});

test('OpenCode blocks unsafe shell before execution', () => {
  const hooks = createSafeguards({ session: {}, worktree: '/tmp' });
  assert.throws(() => hooks.denyUnsafeShell({ command: 'git commit --no-verify' }), /--no-verify is blocked/);
});

test('OpenCode appends edit failures and continues the same session once', async () =>
  temporaryDirectory(async root => {
    const file = resolve(root, 'file.ts');
    writeFileSync(file, 'export {};');
    const prompts = [];
    const session = {
      prompt: async request => {
        prompts.push(request);
      }
    };
    const hooks = createSafeguards(
      { session, worktree: root },
      {
        edit: () => ({ ok: false, step: 'compile', output: 'bad edit' }),
        completion: () => ({ ok: false, step: 'lint', output: 'bad completion' })
      }
    );
    const next = await hooks.afterEdit({
      tool: 'edit',
      sessionID: 'session',
      input: { filePath: file },
      output: { status: 'completed', result: { content: 'edited' } }
    });
    assert.match(next.result.content, /bad edit/);
    const event = { type: 'session.idle', data: { sessionID: 'session' } };
    await hooks.onIdle(event);
    await hooks.onIdle(event);
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].sessionID, 'session');
  }));

test('OpenCode treats session.status idle as stop', async () =>
  temporaryDirectory(async root => {
    const file = resolve(root, 'file.ts');
    writeFileSync(file, 'export {};');
    const prompts = [];
    const hooks = createSafeguards(
      {
        session: {
          prompt: async request => {
            prompts.push(request);
          }
        },
        worktree: root
      },
      {
        edit: () => ({ ok: true, step: 'edit verification' }),
        completion: () => ({ ok: false, step: 'lint', output: 'bad completion' })
      }
    );
    await hooks.afterEdit({
      tool: 'edit',
      sessionID: 'session',
      input: { path: file },
      output: { status: 'completed', result: { content: 'edited' } }
    });
    await hooks.onIdle({ type: 'session.status', data: { sessionID: 'session', status: { type: 'idle' } } });
    assert.equal(prompts.length, 1);
  }));

test('OpenCode preserves edits made during completion verification', async () =>
  temporaryDirectory(async root => {
    const file = resolve(root, 'file.ts');
    writeFileSync(file, 'export {};');
    let finishVerification;
    let verifications = 0;
    const hooks = createSafeguards(
      { session: {}, worktree: root },
      {
        edit: () => ({ ok: true, step: 'edit verification' }),
        completion: () => {
          verifications += 1;
          return new Promise(resolveVerification => {
            finishVerification = () => resolveVerification({ ok: true, step: 'completion verification' });
          });
        }
      }
    );
    const edit = () =>
      hooks.afterEdit({
        tool: 'edit',
        sessionID: 'session',
        input: { filePath: file },
        output: { status: 'completed', result: { content: 'edited' } }
      });
    await edit();
    const event = { type: 'session.idle', data: { sessionID: 'session' } };
    const firstIdle = hooks.onIdle(event);
    await edit();
    finishVerification();
    await firstIdle;
    const secondIdle = hooks.onIdle(event);
    finishVerification();
    await secondIdle;
    assert.equal(verifications, 2);
  }));

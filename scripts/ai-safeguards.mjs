import { existsSync, lstatSync } from 'node:fs';
import { isAbsolute, resolve, win32 } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const VALUE_OPTIONS = new Set(['-C', '-c', '--config-env', '--exec-path', '--git-dir', '--work-tree', '--namespace']);

export const NO_VERIFY_REASON = 'git with --no-verify is blocked. Run without --no-verify so hooks run.';
const DYNAMIC_GIT_REASON =
  'Git commands assembled with shell expansion are blocked because safeguards cannot verify the resulting command. Use literal Git arguments.';
const ATTACHED_DIRECTORY_REASON =
  'git push with --git-dir or --work-tree is blocked because safeguards cannot verify the target repository. Use git -C <repo> push.';
const SHELL_EXECUTORS = new Set(['bash', 'sh', 'zsh']);
const WRAPPERS = new Set(['command', 'env', 'sudo']);
const SUDO_VALUE_OPTIONS = new Set([
  '-C',
  '-g',
  '-h',
  '-p',
  '-R',
  '-T',
  '-u',
  '--chdir',
  '--group',
  '--host',
  '--prompt',
  '--user'
]);

const cleanOutput = (value, limit) => value.replace(CONTROL_CHARS, '').slice(0, limit);

const defaultRun = ({ command, args = [], cwd }) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`
  };
};

const defaultRunAsync = ({ command, args = [], cwd }) =>
  new Promise(resolveRun => {
    const child = spawn(command, args, { cwd, env: process.env });
    const output = [];
    child.stdout?.on('data', data => output.push(data));
    child.stderr?.on('data', data => output.push(data));
    child.on('error', error => resolveRun({ ok: false, output: String(error) }));
    child.on('close', code => resolveRun({ ok: code === 0, output: Buffer.concat(output).toString() }));
  });

const decodeShellWord = word =>
  word.replace(/^\$HOME(?=\/|$)/, process.env.HOME ?? '$HOME').replace(/^~(?=\/|$)/, process.env.HOME ?? '~');

const resolveCommandDirectory = (cwd, value) =>
  isAbsolute(value) || win32.isAbsolute(value) ? value : resolve(cwd, value);

const shellSegments = command => {
  const parsed = [...command].reduce(
    (state, character, index, characters) => {
      if (state.escaped) {
        return character === '\n'
          ? { ...state, escaped: false }
          : { ...state, escaped: false, word: `${state.word}${character}` };
      }
      if (character === '\\' && state.quote !== "'") {
        const escapedCharacter = characters[index + 1];
        return state.quote === '"' && escapedCharacter && !['$', '`', '"', '\\', '\n'].includes(escapedCharacter)
          ? { ...state, word: `${state.word}${character}` }
          : { ...state, escaped: true };
      }
      if (state.quote) {
        return character === state.quote
          ? { ...state, quote: undefined }
          : {
              ...state,
              word: `${state.word}${character}`,
              dynamic: state.dynamic || (state.quote === '"' && (character === '$' || character === '`'))
            };
      }
      if (character === '"' || character === "'") return { ...state, quote: character };
      if (/\s/.test(character)) {
        return state.word
          ? {
              ...state,
              segments: [
                ...state.segments.slice(0, -1),
                [...state.segments.at(-1), { dynamic: state.dynamic, value: state.word }]
              ],
              word: '',
              dynamic: false
            }
          : state;
      }
      if (';&|'.includes(character)) {
        const segment = state.word
          ? [...state.segments.at(-1), { dynamic: state.dynamic, value: state.word }]
          : state.segments.at(-1);
        return { ...state, segments: [...state.segments.slice(0, -1), segment, []], word: '', dynamic: false };
      }
      return {
        ...state,
        word: `${state.word}${character}`,
        dynamic: state.dynamic || character === '$' || character === '`'
      };
    },
    { segments: [[]], word: '', quote: undefined, escaped: false, dynamic: false }
  );
  const last = parsed.word
    ? [...parsed.segments.at(-1), { dynamic: parsed.dynamic, value: parsed.word }]
    : parsed.segments.at(-1);
  return [...parsed.segments.slice(0, -1), last].filter(segment => segment.length);
};

const gitCommand = words => {
  const values = words.map(word => (typeof word === 'string' ? word : word.value));
  const git = values.indexOf('git');
  if (git < 0) return undefined;
  return values.slice(git + 1).reduce(
    (state, word) => {
      if (state.subcommand) return state;
      if (state.awaiting) {
        return state.awaiting === '-C'
          ? { ...state, directory: decodeShellWord(word), awaiting: undefined }
          : { ...state, awaiting: undefined };
      }
      if (VALUE_OPTIONS.has(word)) {
        return word === '--git-dir' || word === '--work-tree'
          ? { ...state, attachedDirectory: true, awaiting: word }
          : { ...state, awaiting: word };
      }
      if (word.startsWith('--git-dir=') || word.startsWith('--work-tree=')) {
        return { ...state, attachedDirectory: true };
      }
      if (word.startsWith('-')) return state;
      return { ...state, subcommand: word };
    },
    { attachedDirectory: false, directory: undefined, awaiting: undefined, subcommand: undefined }
  );
};

const unwrapCommand = tokens => {
  const start = tokens.findIndex(token => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token.value));
  const command = tokens.slice(start < 0 ? tokens.length : start);
  if (!command.length) return { command: [] };
  if (command[0].dynamic) return { reason: DYNAMIC_GIT_REASON };
  if (!WRAPPERS.has(command[0].value)) return { command };
  const wrapped = command.slice(1).reduce(
    (state, token) => {
      if (state.done) return state;
      if (state.reason) return state;
      if (state.awaiting) return { ...state, awaiting: false };
      if (state.wrapper === 'env' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token.value)) return state;
      if (state.wrapper === 'env' && (token.value === '-S' || token.value === '--split-string')) {
        return { ...state, reason: DYNAMIC_GIT_REASON };
      }
      if (state.wrapper === 'sudo' && SUDO_VALUE_OPTIONS.has(token.value)) return { ...state, awaiting: true };
      if (token.value.startsWith('-')) return state;
      return { ...state, command: command.slice(command.indexOf(token)), done: true };
    },
    { awaiting: false, command: [], done: false, reason: undefined, wrapper: command[0].value }
  );
  if (wrapped.reason) return { reason: wrapped.reason };
  return wrapped.command.length ? unwrapCommand(wrapped.command) : { command: [] };
};

const inspectCommand = (command, cwd, inspect) =>
  shellSegments(command).reduce(
    (state, tokens) => {
      if (state.reason) return state;
      const unwrapped = unwrapCommand(tokens);
      if (unwrapped.reason) return { ...state, reason: unwrapped.reason };
      const words = unwrapped.command;
      const executable = words[0]?.value;
      if (!executable) return state;
      if (executable === 'cd') {
        const directory = decodeShellWord(words[1]?.value ?? '');
        return directory ? { ...state, cwd: resolveCommandDirectory(state.cwd, directory) } : state;
      }
      if (SHELL_EXECUTORS.has(executable)) {
        const commandIndex = words.findIndex(token => /^-[^-]*c/.test(token.value));
        const nested = words[commandIndex + 1];
        return commandIndex >= 0 && nested ? inspectCommand(nested.value, state.cwd, inspect) : state;
      }
      if (executable === 'eval') {
        const nested = words
          .slice(1)
          .map(token => token.value)
          .join(' ');
        return /(?:^|[;&|]\s*)(?:bash|sh|zsh)(?:\s|$)/.test(nested)
          ? { ...state, reason: DYNAMIC_GIT_REASON }
          : inspectCommand(nested, state.cwd, inspect);
      }
      return executable === 'git' ? { ...state, reason: inspect(words, state.cwd) } : state;
    },
    { cwd, reason: undefined }
  );

const hasDependencies = root => {
  const path = resolve(root, 'node_modules');
  return existsSync(path) && (lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink());
};

const gitRoot = (directory, run) => {
  const result = run({
    command: 'git',
    args: ['-C', directory, 'rev-parse', '--show-toplevel'],
    cwd: directory
  });
  return result.ok ? result.output.trim() : undefined;
};

const noVerifyDenial = command =>
  inspectCommand(command, process.cwd(), words =>
    words.some(word => word.dynamic)
      ? DYNAMIC_GIT_REASON
      : words.some(word => word.value === '--no-verify')
        ? NO_VERIFY_REASON
        : undefined
  ).reason;

const missingDependenciesDenial = ({ command, cwd, run = defaultRun }) => {
  const result = inspectCommand(command, cwd, (tokens, directory) => {
    if (tokens.some(token => token.dynamic)) return DYNAMIC_GIT_REASON;
    const git = gitCommand(tokens);
    if (git?.subcommand !== 'push') return undefined;
    if (git.attachedDirectory) return ATTACHED_DIRECTORY_REASON;
    const target = git.directory ? resolveCommandDirectory(directory, git.directory) : directory;
    const root = gitRoot(target, run);
    return !root || hasDependencies(root)
      ? undefined
      : `node_modules missing at ${root} — local lint/compile hooks can't run, so a push would ship unverified code. Run 'npm install' at the repo root, then push.`;
  });
  return result.reason;
};

export const commandDenial = (input, policy = 'all') =>
  policy === 'no-verify'
    ? noVerifyDenial(input.command)
    : policy === 'push-dependencies'
      ? missingDependenciesDenial(input)
      : (noVerifyDenial(input.command) ?? missingDependenciesDenial(input));

const failure = (step, output, limit = 500) => ({
  ok: false,
  step,
  output: cleanOutput(output, limit)
});

const runStep = ({ root, step, command, args = [], run, limit }) => {
  const result = run({ command, args, cwd: root });
  return result.ok ? { ok: true, step } : failure(step, result.output, limit);
};

const runStepAsync = async ({ root, step, command, args = [], run, limit }) => {
  const result = await run({ command, args, cwd: root });
  return result.ok ? { ok: true, step } : failure(step, result.output, limit);
};

const effectDiagnostics = ({ root, file, run, requireExecutable = false }) => {
  const executable = resolve(root, 'node_modules/.bin/effect-language-service');
  if (!existsSync(executable)) {
    return requireExecutable
      ? failure('effect LS', `${executable} not found — run npm install`)
      : { ok: true, step: `effect LS (${file})` };
  }
  const result = run({
    command: executable,
    args: ['diagnostics', '--file', file],
    cwd: root
  });
  const summary = /^Checked .* files? out of.*$/m.exec(result.output)?.[0] ?? '';
  const findings = /[1-9][0-9]* (?:warning|message)/.test(summary);
  return result.ok && !findings
    ? { ok: true, step: `effect LS (${file})` }
    : failure(`effect LS (${file})`, result.output, 1500);
};

const effectDiagnosticsAsync = async ({ root, file, run, requireExecutable = false }) => {
  const executable = resolve(root, 'node_modules/.bin/effect-language-service');
  if (!existsSync(executable)) {
    return requireExecutable
      ? failure('effect LS', `${executable} not found — run npm install`)
      : { ok: true, step: `effect LS (${file})` };
  }
  const result = await run({ command: executable, args: ['diagnostics', '--file', file], cwd: root });
  const summary = /^Checked .* files? out of.*$/m.exec(result.output)?.[0] ?? '';
  const findings = /[1-9][0-9]* (?:warning|message)/.test(summary);
  return result.ok && !findings
    ? { ok: true, step: `effect LS (${file})` }
    : failure(`effect LS (${file})`, result.output, 1500);
};

export const verifyEdit = ({ root, files, run = defaultRun }) => {
  const compile = runStep({
    root,
    step: 'compile',
    command: 'npm',
    args: ['run', 'compile'],
    run
  });
  if (!compile.ok) return compile;
  const typescriptFiles = [...new Set(files)]
    .map(file => (isAbsolute(file) ? file : resolve(root, file)))
    .filter(file => file.endsWith('.ts') && existsSync(file));
  return (
    typescriptFiles.map(file => effectDiagnostics({ root, file, run })).find(result => !result.ok) ?? {
      ok: true,
      step: 'edit verification'
    }
  );
};

export const verifyEditAsync = async ({ root, files, run = defaultRunAsync }) => {
  const compile = await runStepAsync({
    root,
    step: 'compile',
    command: 'npm',
    args: ['run', 'compile'],
    run
  });
  if (!compile.ok) return compile;
  const typescriptFiles = [...new Set(files)]
    .map(file => (isAbsolute(file) ? file : resolve(root, file)))
    .filter(file => file.endsWith('.ts') && existsSync(file));
  for (const file of typescriptFiles) {
    const result = await effectDiagnosticsAsync({ root, file, run });
    if (!result.ok) return result;
  }
  return { ok: true, step: 'edit verification' };
};

const changedTypescriptFiles = ({ root, run }) => {
  const changed = run({
    command: 'git',
    args: ['diff', '--name-only', 'HEAD'],
    cwd: root
  });
  const untracked = run({
    command: 'git',
    args: ['ls-files', '--others', '--exclude-standard'],
    cwd: root
  });
  return [
    ...new Set([
      ...(changed.ok ? changed.output.split('\n') : []),
      ...(untracked.ok ? untracked.output.split('\n') : [])
    ])
  ].filter(file => file.endsWith('.ts') && existsSync(resolve(root, file)));
};

const changedTypescriptFilesAsync = async ({ root, run }) => {
  const [changed, untracked] = await Promise.all([
    run({ command: 'git', args: ['diff', '--name-only', 'HEAD'], cwd: root }),
    run({ command: 'git', args: ['ls-files', '--others', '--exclude-standard'], cwd: root })
  ]);
  return [
    ...new Set([
      ...(changed.ok ? changed.output.split('\n') : []),
      ...(untracked.ok ? untracked.output.split('\n') : [])
    ])
  ].filter(file => file.endsWith('.ts') && existsSync(resolve(root, file)));
};

export const verifyCompletion = ({ root, run = defaultRun }) => {
  const steps = [
    () => runStep({ root, step: 'compile', command: 'npm', args: ['run', 'compile'], run }),
    () => runStep({ root, step: 'lint', command: 'npm', args: ['run', 'lint'], run }),
    ...changedTypescriptFiles({ root, run }).map(
      file => () => effectDiagnostics({ root, file, run, requireExecutable: true })
    ),
    () => runStep({ root, step: 'test', command: 'npm', args: ['run', 'test'], run }),
    () => runStep({ root, step: 'vscode:bundle', command: 'npm', args: ['run', 'vscode:bundle'], run }),
    () => runStep({ root, step: 'knip', command: 'npm', args: ['run', 'check:knip'], run })
  ];
  return steps.reduce((result, step) => (result.ok ? step() : result), { ok: true, step: 'completion verification' });
};

export const verifyCompletionAsync = async ({ root, run = defaultRunAsync }) => {
  const steps = [
    () => runStepAsync({ root, step: 'compile', command: 'npm', args: ['run', 'compile'], run }),
    () => runStepAsync({ root, step: 'lint', command: 'npm', args: ['run', 'lint'], run }),
    ...(await changedTypescriptFilesAsync({ root, run })).map(
      file => () => effectDiagnosticsAsync({ root, file, run, requireExecutable: true })
    ),
    () => runStepAsync({ root, step: 'test', command: 'npm', args: ['run', 'test'], run }),
    () => runStepAsync({ root, step: 'vscode:bundle', command: 'npm', args: ['run', 'vscode:bundle'], run }),
    () => runStepAsync({ root, step: 'knip', command: 'npm', args: ['run', 'check:knip'], run })
  ];
  for (const step of steps) {
    const result = await step();
    if (!result.ok) return result;
  }
  return { ok: true, step: 'completion verification' };
};

export const editedPaths = (tool, args) => {
  if (tool === 'edit' || tool === 'write') {
    const file = args.filePath ?? args.path;
    return file ? [file] : [];
  }
  if (tool !== 'apply_patch') return [];
  const paths = [
    ...String(args.patchText ?? '').matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)
  ].map(match => match[1] ?? match[2]);
  return [...new Set(paths)];
};

export const formatEditFailure = result =>
  result.ok
    ? undefined
    : `Verification failed after edit: ${result.step}. Fix the errors before continuing:\n${result.output}`;

export const formatCompletionFailure = result =>
  result.ok ? undefined : `Verification failed: ${result.step} — ${result.output}. Fix the errors and try again.`;

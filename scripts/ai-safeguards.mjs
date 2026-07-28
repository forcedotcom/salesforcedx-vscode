import { existsSync, lstatSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const VALUE_OPTIONS = new Set(['-C', '-c', '--config-env', '--exec-path', '--git-dir', '--work-tree', '--namespace']);

export const NO_VERIFY_REASON = 'git with --no-verify is blocked. Run without --no-verify so hooks run.';
const DYNAMIC_GIT_REASON =
  'Git commands assembled with shell expansion are blocked because safeguards cannot verify the resulting command. Use literal Git arguments.';
const ATTACHED_DIRECTORY_REASON =
  'git push with --git-dir or --work-tree is blocked because safeguards cannot verify the target repository. Use git -C <repo> push.';

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

const decodeShellWord = word =>
  word.replace(/^\$HOME(?=\/|$)/, process.env.HOME ?? '$HOME').replace(/^~(?=\/|$)/, process.env.HOME ?? '~');

const resolveCommandDirectory = (cwd, value) => (isAbsolute(value) ? value : resolve(cwd, value));

const shellSegments = command => {
  const parsed = [...command].reduce(
    (state, character) => {
      if (state.escaped) {
        return character === '\n'
          ? { ...state, escaped: false }
          : { ...state, escaped: false, word: `${state.word}${character}` };
      }
      if (character === '\\' && state.quote !== "'") return { ...state, escaped: true };
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
  shellSegments(command).reduce((reason, words) => {
    if (reason) return reason;
    const commandStart = words.findIndex(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word.value));
    const executable = words[commandStart];
    if (executable?.dynamic) return DYNAMIC_GIT_REASON;
    if (!words.some(word => word.value === 'git')) return reason;
    if (words.some(word => word.dynamic)) return DYNAMIC_GIT_REASON;
    return words.some(word => word.value === '--no-verify') ? NO_VERIFY_REASON : undefined;
  }, undefined);

const missingDependenciesDenial = ({ command, cwd, run = defaultRun }) => {
  const initial = { directory: cwd, reason: undefined };
  const result = shellSegments(command).reduce((state, tokens) => {
    if (state.reason) return state;
    const words = tokens.map(token => token.value);
    const start = words.findIndex(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
    const commandWords = words.slice(start < 0 ? words.length : start);
    const cd = commandWords[0] === 'cd' ? decodeShellWord(commandWords[1] ?? '') : undefined;
    if (cd) return { ...state, directory: resolveCommandDirectory(state.directory, cd) };
    const git = gitCommand(commandWords);
    if (git?.subcommand !== 'push') return state;
    if (git.attachedDirectory) return { ...state, reason: ATTACHED_DIRECTORY_REASON };
    const directory = git.directory ? resolveCommandDirectory(state.directory, git.directory) : state.directory;
    const root = gitRoot(directory, run);
    return !root || hasDependencies(root)
      ? state
      : {
          ...state,
          reason: `node_modules missing at ${root} — local lint/compile hooks can't run, so a push would ship unverified code. Run 'npm install' at the repo root, then push.`
        };
  }, initial);
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

export const editedPaths = (tool, args) => {
  if (tool === 'edit' || tool === 'write') return args.filePath ? [args.filePath] : [];
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

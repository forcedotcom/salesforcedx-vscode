/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container lifecycle: pull / run / restart / teardown, returning a typed ContainerHandle that
 * threads through swap, seed, and verify. The toolkit owns docker (plan C1).
 *
 * Readiness is FOLDED INTO run and restart — they resolve only once the workbench URL answers, so a
 * caller can never obtain an unhealthy handle. `restart` is a SINGLE verb: one `docker restart`
 * re-scans /base/extension-overrides (applies a swap) AND re-runs the image's start-time org auth;
 * splitting them would be a fiction the image doesn't support (ADR 0022).
 */

import { bootEnvToDockerArgs, type BootEnv } from './auth';
import { defaultRunner, type CommandRunner } from './runner';

/** The code-server port inside the CB image (served with --auth none); published to a host port. */
export const CONTAINER_PORT = 58_080;

/*
 * A running container + the facts downstream steps need. Returned by run/restart, accepted by every
 * verb. Deliberately does NOT carry bootEnv: the access token is an INPUT to `run` (baked into the
 * container's env by `docker run`), not a downstream fact — keeping it here would (a) leak a live
 * secret into any object a consumer logs, and (b) falsely imply mutating it before `restart` re-auths
 * (it can't — `docker restart` reuses the original container env).
 */
export type ContainerHandle = {
  name: string;
  imageRef: string;
  /** URL the workbench is served at, e.g. http://localhost:8123. */
  publishedUrl: string;
  /** Host port published to the container's code-server port. */
  publishedPort: number;
  /**
   * The bind mounts `run` applied (empty when none). Recorded so downstream steps — notably seed —
   * can validate a path against a REAL mount instead of trusting a "keep in sync" comment.
   */
  mounts: readonly Mount[];
};

/** A host→container bind mount (e.g. the fixture project). */
export type Mount = { hostPath: string; containerPath: string };

/** Returns true once the workbench URL answers. Injectable for tests; default does an HTTP GET. */
export type ReadinessProbe = (url: string) => Promise<boolean>;

export type ReadinessOptions = {
  /** Overall wait budget in ms (default 120_000 — 60×2s, matching #7718). */
  timeoutMs?: number;
  /** Poll interval in ms (default 2_000). */
  intervalMs?: number;
  /** Health probe (default: fetch the URL, ok on any response). */
  probe?: ReadinessProbe;
};

export type RunSpec = {
  name: string;
  imageRef: string;
  /** Host port to publish the container's code-server port to. */
  publishedPort: number;
  bootEnv: BootEnv;
  mounts?: readonly Mount[];
  /** Workbench URL; defaults to http://localhost:<publishedPort>. */
  url?: string;
  readiness?: ReadinessOptions;
};

export type LifecycleOptions = { runner?: CommandRunner };

/*
 * Default probe: GET the workbench URL. Two guards the naive version missed:
 *  - a per-request AbortSignal.timeout — otherwise a half-open socket (container accepted the TCP
 *    connection but never responds) hangs the fetch forever and the overall readiness budget is a
 *    lie (the loop can only check the deadline BETWEEN probes, not mid-probe).
 *  - `status < 400` (NOT res.ok) — code-server with `--auth none` answers `/` with a 302 redirect
 *    (e.g. to `?folder=…`); res.ok (2xx-only) would reject that healthy response and burn the whole
 *    budget. This matches #7718's proven `curl -fsS` (no -L), which treats 3xx as success and only
 *    fails on 4xx/5xx. A booting server that answers 4xx/5xx is correctly still "not ready".
 */
const defaultProbe: ReadinessProbe = async url => {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return res.status < 400;
  } catch {
    return false;
  }
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Poll until the workbench answers or the budget is exhausted; throw loud (with docker logs) on timeout. */
const waitForWorkbench = async (
  runner: CommandRunner,
  handle: ContainerHandle,
  readiness: ReadinessOptions = {}
): Promise<void> => {
  const timeoutMs = readiness.timeoutMs ?? 120_000;
  const intervalMs = readiness.intervalMs ?? 2000;
  const probe = readiness.probe ?? defaultProbe;
  const deadline = Date.now() + timeoutMs;
  // Check the deadline BEFORE the trailing sleep (not after): the loop still probes first — an
  // already-up container returns on the first iteration with zero wasted interval — but it never
  // burns a full intervalMs sleep once the budget is spent, so the effective wait stays within
  // timeoutMs (the do-while overshot by up to one interval) and a timeoutMs: 0 fast-fail probes zero
  // times. Each probe is itself time-bounded (default AbortSignal.timeout), so no probe can hang.
  while (Date.now() < deadline) {
    if (await probe(handle.publishedUrl)) {
      return;
    }
    await sleep(intervalMs);
  }
  let logs = '';
  try {
    logs = runner('docker', ['logs', handle.name]);
  } catch {
    /* best-effort */
  }
  throw new Error(`Code Builder never became reachable at ${handle.publishedUrl} within ${timeoutMs}ms\n${logs}`);
};

/** Pull the image. */
export const pull = (imageRef: string, options: LifecycleOptions = {}): void => {
  (options.runner ?? defaultRunner)('docker', ['pull', imageRef]);
};

/*
 * Start the container (detached), then wait for the workbench. Resolves only when healthy — the
 * returned handle is always usable.
 */
export const run = async (spec: RunSpec, options: LifecycleOptions = {}): Promise<ContainerHandle> => {
  const runner = options.runner ?? defaultRunner;
  const publishedUrl = spec.url ?? `http://localhost:${spec.publishedPort}`;
  const mountArgs = (spec.mounts ?? []).flatMap(m => ['-v', `${m.hostPath}:${m.containerPath}`]);
  runner('docker', [
    'run',
    '-d',
    '--name',
    spec.name,
    ...bootEnvToDockerArgs(spec.bootEnv),
    ...mountArgs,
    '-p',
    `${spec.publishedPort}:${CONTAINER_PORT}`,
    spec.imageRef
  ]);
  const handle: ContainerHandle = {
    name: spec.name,
    imageRef: spec.imageRef,
    publishedUrl,
    publishedPort: spec.publishedPort,
    mounts: spec.mounts ?? []
  };
  try {
    await waitForWorkbench(runner, handle, spec.readiness);
  } catch (err) {
    // Readiness failed — tear the just-started container down so a retry with the same name isn't
    // blocked by "container name already in use", and no orphan is left running.
    teardown(handle, { runner });
    throw err;
  }
  return handle;
};

/*
 * Restart the container and wait for the workbench again. One `docker restart` both re-scans the
 * extension-overrides (applying a prior swap) and re-runs the image's start-time org auth.
 *
 * CAVEAT (plan §16 OQ3): `docker restart` reuses the env baked at `docker run`, so start-time org
 * auth re-runs against the ORIGINAL SF_ACCESS_TOKEN — there is no path to inject a fresh token here.
 * `waitForWorkbench` only probes code-server's HTTP surface (which answers 2xx/3xx regardless of org
 * auth state), so a restart after the token expired resolves as "healthy" while the org is actually
 * unauthenticated, and downstream org-dependent specs then fail with confusing auth errors far from
 * the cause. Low likelihood in practice (sf tokens last ~2h vs. a typically-seconds run→restart gap),
 * so this is documented rather than asserted; if it ever bites, add a post-restart org-auth check.
 */
export const restart = async (
  handle: ContainerHandle,
  readiness: ReadinessOptions = {},
  options: LifecycleOptions = {}
): Promise<ContainerHandle> => {
  const runner = options.runner ?? defaultRunner;
  runner('docker', ['restart', handle.name]);
  await waitForWorkbench(runner, handle, readiness);
  return handle;
};

/** Remove the container (best-effort; safe to call in an always()/finally cleanup). */
export const teardown = (handle: ContainerHandle, options: LifecycleOptions = {}): void => {
  try {
    (options.runner ?? defaultRunner)('docker', ['rm', '-f', handle.name]);
  } catch {
    /* best-effort cleanup */
  }
};

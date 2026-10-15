import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [port, outputPath, appPid] = process.argv.slice(2);
if (!port || !outputPath) {
  throw new Error('Usage: node profileExtensionHost.mjs <port> <output-path> [app-pid]');
}

function appIsRunning() {
  if (!appPid) return true;
  try {
    process.kill(Number(appPid), 0);
    return true;
  } catch {
    return false;
  }
}

async function findInspector() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (!appIsRunning()) {
      throw new Error('VS Code exited before opening the extension host inspector; see the launch log above');
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find(item => item.webSocketDebuggerUrl);
        if (target) return target.webSocketDebuggerUrl;
      }
    } catch {
      // The extension host has not opened its inspector yet.
    }
    await delay(250);
  }
  throw new Error(`Extension host inspector did not open on port ${port}`);
}

const socket = new WebSocket(await findInspector());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});
socket.addEventListener('close', () => {
  for (const request of pending.values()) {
    request.reject(new Error('Extension host inspector closed before the profile was saved'));
  }
  pending.clear();
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await send('Profiler.enable');
  await send('Profiler.setSamplingInterval', { interval: 1000 });
  await send('Profiler.start');
  await send('Runtime.runIfWaitingForDebugger');
  console.log(
    'Extension host profiling started. Press Enter after the activity you want to capture, before quitting VS Code.'
  );

  await new Promise(resolve => {
    if (process.stdin.isTTY) {
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
      process.stdin.resume();
    } else {
      console.log('No interactive terminal detected; capturing for 30 seconds.');
      setTimeout(resolve, 30_000);
    }
  });

  const { profile } = await send('Profiler.stop');
  await writeFile(outputPath, JSON.stringify(profile));
  console.log(`Saved CPU profile: ${outputPath}`);
} finally {
  socket.close();
}

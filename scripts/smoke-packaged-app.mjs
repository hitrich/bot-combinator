#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, repoRoot, run, walkFiles } from './_lib.mjs';

const args = parseArgs();
const releaseDir = path.resolve(
  args['release-dir'] ?? path.join(repoRoot, 'apps', 'desktop', 'release'),
);
const timeoutMs = Number(args['timeout-ms'] ?? 120_000);
const stageKinds = process.platform === 'darwin' ? ['dmg', 'zip'] : [undefined];

for (const stageKind of stageKinds) {
  const distributions = await stageDistributions(releaseDir, stageKind);
  try {
    for (const distribution of distributions) await smokeDistribution(distribution, timeoutMs);
  } finally {
    for (const distribution of [...distributions].reverse()) await distribution.cleanup();
  }
}

async function smokeDistribution(distribution, timeout) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-smoke-profile-'));
  const debuggingPort = await availablePort();
  let child;
  let stdout = '';
  let stderr = '';
  try {
    console.log(`Launching final ${distribution.kind} distribution: ${distribution.executable}`);
    child = spawn(
      distribution.executable,
      [
        `--user-data-dir=${profile}`,
        `--remote-debugging-port=${debuggingPort}`,
        '--remote-debugging-address=127.0.0.1',
        '--outreachr-smoke-test',
        '--disable-gpu',
      ],
      {
        env: {
          ...process.env,
          ...distribution.environment,
          OUTREACHR_SMOKE_TEST: '1',
          ELECTRON_ENABLE_LOGGING: '1',
          ELECTRON_DISABLE_SECURITY_WARNINGS: '0',
        },
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-40_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-40_000);
    });

    const earlyExit = new Promise((_, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        reject(new Error(`application exited before readiness (code=${code}, signal=${signal})`));
      });
    });
    const renderer = await Promise.race([
      waitForRendererReadiness(debuggingPort, timeout),
      earlyExit,
    ]);
    if (child.exitCode !== null) throw new Error('application exited immediately after readiness');
    console.log(
      `${distribution.kind} renderer ready: ${renderer.title}; ${renderer.workspace}; ${renderer.bodyTextLength} visible text characters.`,
    );
  } catch (error) {
    throw new Error(
      `${distribution.kind} smoke failed: ${error instanceof Error ? error.message : String(error)}\n` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`,
      { cause: error },
    );
  } finally {
    if (child?.pid) await terminateTree(child.pid);
    await removeTree(profile);
  }
}

async function stageDistributions(root, requestedKind) {
  const files = await walkFiles(root);
  const staged = [];
  try {
    if (process.platform === 'darwin') {
      const dmgs = files.filter((file) => file.toLowerCase().endsWith('.dmg'));
      const zips = files.filter((file) => file.toLowerCase().endsWith('.zip'));
      if (dmgs.length !== 1 || zips.length !== 1) {
        throw new Error(
          `Expected one DMG and one ZIP under ${root}; found ${dmgs.length}/${zips.length}`,
        );
      }
      if (requestedKind !== 'zip') {
        const mountpoint = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-dmg-'));
        const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-dmg-install-'));
        let mounted = false;
        try {
          await run(
            'hdiutil',
            ['attach', '-nobrowse', '-readonly', '-mountpoint', mountpoint, dmgs[0]],
            {
              capture: false,
              timeoutMs: 60_000,
            },
          );
          mounted = true;
          const mountedExecutable = await uniqueAppExecutable(mountpoint, 'mounted DMG');
          const mountedBundle = appBundleForExecutable(mountedExecutable);
          const installedBundle = path.join(installRoot, path.basename(mountedBundle));
          await run('ditto', [mountedBundle, installedBundle], {
            capture: false,
            timeoutMs: 120_000,
          });
          await run('hdiutil', ['detach', mountpoint, '-force']);
          mounted = false;
          await removeTree(mountpoint);
          const installedExecutable = await uniqueAppExecutable(installRoot, 'DMG installation');
          await verifyMacAppBundle(installedExecutable, 'DMG installation');
          staged.push({
            kind: 'DMG installation',
            executable: installedExecutable,
            environment: {},
            async cleanup() {
              await removeTree(installRoot);
            },
          });
        } catch (error) {
          if (mounted) {
            await run('hdiutil', ['detach', mountpoint, '-force'], { allowFailure: true });
          }
          await removeTree(mountpoint);
          await removeTree(installRoot);
          throw error;
        }
      }

      if (requestedKind !== 'dmg') {
        const zipRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-zip-'));
        try {
          await run('ditto', ['-x', '-k', zips[0], zipRoot], {
            capture: false,
            timeoutMs: 60_000,
          });
          const zippedExecutable = await uniqueAppExecutable(zipRoot, 'release ZIP');
          await verifyMacAppBundle(zippedExecutable, 'release ZIP');
          staged.push({
            kind: 'ZIP',
            executable: zippedExecutable,
            environment: {},
            async cleanup() {
              await removeTree(zipRoot);
            },
          });
        } catch (error) {
          await removeTree(zipRoot);
          throw error;
        }
      }
      return staged;
    }

    if (process.platform === 'win32') {
      const installers = files.filter(
        (file) =>
          file.toLowerCase().endsWith('.exe') &&
          path.basename(file).toLowerCase().startsWith('outreachr-') &&
          !file.toLowerCase().includes('unpacked'),
      );
      if (installers.length !== 1) {
        throw new Error(
          `Expected one final NSIS installer under ${root}, found ${installers.length}`,
        );
      }
      const installRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-nsis-'));
      try {
        await run(installers[0], ['/S', `/D=${installRoot}`], {
          capture: false,
          timeoutMs: 120_000,
        });
        const installed = (await walkFiles(installRoot)).filter(
          (file) => path.basename(file).toLowerCase() === 'outreachr.exe',
        );
        if (installed.length !== 1) {
          throw new Error(`NSIS install produced ${installed.length} Outreachr executables`);
        }
        staged.push({
          kind: 'NSIS installer',
          executable: installed[0],
          environment: {},
          cleanup: () => cleanupNsis(installRoot),
        });
      } catch (error) {
        await cleanupNsis(installRoot);
        throw error;
      }
      return staged;
    }

    if (process.platform === 'linux') {
      const appImages = files.filter((file) => file.toLowerCase().endsWith('.appimage'));
      const debs = files.filter((file) => file.toLowerCase().endsWith('.deb'));
      if (appImages.length !== 1 || debs.length !== 1) {
        throw new Error(
          `Expected one AppImage and one deb under ${root}; found ${appImages.length}/${debs.length}`,
        );
      }
      await fs.chmod(appImages[0], 0o755);
      staged.push({
        kind: 'AppImage',
        executable: appImages[0],
        environment: { APPIMAGE_EXTRACT_AND_RUN: '1' },
        async cleanup() {},
      });

      await run('dpkg-deb', ['--info', debs[0]], { capture: false });
      const packageName = (await run('dpkg-deb', ['--field', debs[0], 'Package'])).stdout.trim();
      if (!/^[a-z0-9][a-z0-9+.-]+$/.test(packageName)) {
        throw new Error(`Invalid deb package name: ${packageName}`);
      }
      try {
        await run('sudo', ['apt-get', 'install', '--yes', '--no-install-recommends', debs[0]], {
          capture: false,
          timeoutMs: 120_000,
        });
        const installedFiles = (await run('dpkg', ['--listfiles', packageName])).stdout
          .split(/\r?\n/)
          .filter(Boolean);
        const installedExecutable = installedFiles.find(
          (file) => path.basename(file).toLowerCase() === 'outreachr',
        );
        if (!installedExecutable || !(await fs.stat(installedExecutable)).isFile()) {
          throw new Error('Installed deb does not contain the Outreachr executable');
        }
        const desktopEntries = installedFiles.filter(
          (file) => path.basename(file).toLowerCase() === 'outreachr.desktop',
        );
        if (desktopEntries.length !== 1) {
          throw new Error(
            `Installed deb contains ${desktopEntries.length} outreachr.desktop entries`,
          );
        }
        const desktopEntry = await fs.readFile(desktopEntries[0], 'utf8');
        if (!/^StartupWMClass=outreachr$/m.test(desktopEntry)) {
          throw new Error('Installed desktop entry does not match the Electron app identity');
        }
        if (!/^Icon=outreachr$/m.test(desktopEntry)) {
          throw new Error('Installed desktop entry does not use the packaged Outreachr icon');
        }
        const desktopExec = /^Exec=(.+)$/m.exec(desktopEntry)?.[1];
        if (!desktopExec?.startsWith(installedExecutable)) {
          throw new Error(
            'Installed desktop entry does not launch the packaged Outreachr executable',
          );
        }
        staged.push({
          kind: 'deb',
          executable: installedExecutable,
          environment: {},
          cleanup: () => cleanupDeb(packageName),
        });
      } catch (error) {
        await cleanupDeb(packageName);
        throw error;
      }
      return staged;
    }
    throw new Error(`Unsupported smoke-test platform ${process.platform}`);
  } catch (error) {
    for (const distribution of [...staged].reverse()) await distribution.cleanup();
    throw error;
  }
}

async function uniqueAppExecutable(root, label) {
  const executables = (await walkFiles(root)).filter((file) =>
    /Outreachr\.app\/Contents\/MacOS\/Outreachr$/.test(file),
  );
  if (executables.length !== 1)
    throw new Error(`${label} contains ${executables.length} Outreachr executables`);
  return executables[0];
}

function appBundleForExecutable(executable) {
  const bundle = path.dirname(path.dirname(path.dirname(executable)));
  if (path.extname(bundle).toLowerCase() !== '.app') {
    throw new Error(`Executable is not inside a macOS app bundle: ${executable}`);
  }
  return bundle;
}

async function verifyMacAppBundle(executable, label) {
  await run('codesign', ['--verify', '--deep', '--strict', appBundleForExecutable(executable)], {
    capture: false,
  });
  console.log(`${label} preserves a valid macOS code signature.`);
}

async function cleanupNsis(installRoot) {
  const uninstallers = (await walkFiles(installRoot)).filter((file) =>
    /^uninstall.*\.exe$/i.test(path.basename(file)),
  );
  for (const uninstaller of uninstallers) {
    await run(uninstaller, ['/S'], { allowFailure: true, timeoutMs: 60_000 });
  }
  await removeTree(installRoot);
}

async function removeTree(target) {
  await fs.rm(target, {
    recursive: true,
    force: true,
    maxRetries: process.platform === 'win32' ? 20 : 4,
    retryDelay: 250,
  });
}

async function cleanupDeb(packageName) {
  await run('sudo', ['dpkg', '--remove', packageName], {
    allowFailure: true,
    capture: false,
    timeoutMs: 60_000,
  });
}

async function waitForRendererReadiness(port, timeout) {
  const deadline = Date.now() + timeout;
  let lastError = 'DevTools endpoint not available';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`DevTools HTTP ${response.status}`);
      const targets = await response.json();
      for (const target of targets.filter(
        (item) => item.type === 'page' && item.webSocketDebuggerUrl,
      )) {
        const snapshot = await evaluateRenderer(target.webSocketDebuggerUrl);
        if (
          ['interactive', 'complete'].includes(snapshot.readyState) &&
          snapshot.title === 'Outreachr' &&
          snapshot.rootChildCount > 0 &&
          snapshot.bodyTextLength > 40 &&
          !snapshot.loading &&
          !snapshot.error &&
          ['onboarding', 'workspace'].includes(snapshot.workspace)
        ) {
          return snapshot;
        }
        lastError = `renderer not ready: ${JSON.stringify(snapshot)}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`timed out waiting for initialized renderer: ${lastError}`);
}

async function evaluateRenderer(webSocketUrl) {
  const expression = `(() => ({
    readyState: document.readyState,
    title: document.title,
    rootChildCount: document.querySelector('#root')?.childElementCount ?? 0,
    bodyTextLength: document.body?.innerText?.trim().length ?? 0,
    loading: Boolean(document.querySelector('.loading-screen')),
    error: Boolean(document.querySelector('.error-screen')),
    workspace: document.querySelector('.onboarding-shell') ? 'onboarding' : document.querySelector('.app-shell') ? 'workspace' : 'unknown'
  }))()`;
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('CDP renderer evaluation timed out'));
    }, 4_000);
    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true },
        }),
      );
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error || message.result?.exceptionDetails) {
        reject(
          new Error(
            `CDP evaluation failed: ${JSON.stringify(message.error ?? message.result.exceptionDetails)}`,
          ),
        );
      } else {
        resolve(message.result?.result?.value);
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP WebSocket failed'));
    });
  });
}

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error('Could not allocate a renderer-debugging port'));
      });
    });
  });
}

async function terminateTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
      });
      killer.once('close', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // The process tree exited cleanly after SIGTERM.
  }
}

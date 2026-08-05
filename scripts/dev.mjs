import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { killPorts } from './kill-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let cleaning = false;
const children = [];

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  child.on('exit', (code, signal) => {
    if (!cleaning) {
      console.log(`\n[${name}] exited (${signal || code})`);
      cleanup(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  console.log('\nShutting down Nura dev servers...');
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  killPorts('all');
  setTimeout(() => process.exit(exitCode), 300);
}

console.log('Starting Nura (API :5002 + Web :4000)');
console.log('Open http://localhost:4000 — API is proxied at /api/v1');
console.log('Press Ctrl+C to stop both servers.\n');

killPorts('all');

run('npm', ['run', 'start:dev', '-w', '@pulseai/api'], 'api');
setTimeout(() => {
  run('npm', ['run', 'dev', '-w', '@pulseai/web'], 'web');
}, 1500);

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

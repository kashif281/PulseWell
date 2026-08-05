import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { killPorts } from './kill-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let cleaning = false;
let child;

function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  console.log('\nStopping API server...');
  try {
    child?.kill('SIGTERM');
  } catch {
    // ignore
  }
  killPorts('api');
  setTimeout(() => process.exit(exitCode), 300);
}

killPorts('api');
console.log('Starting API only on http://localhost:5002/api/v1');
console.log('Press Ctrl+C to stop.\n');

child = spawn('npm', ['run', 'start:dev', '-w', '@pulseai/api'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (!cleaning) cleanup(signal ? 0 : code ?? 0);
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

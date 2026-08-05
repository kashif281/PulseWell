import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { killPorts } from './kill-ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, '../apps/web');

let cleaning = false;
let child;

function cleanup(exitCode = 0) {
  if (cleaning) return;
  cleaning = true;
  console.log('\nStopping frontend...');
  try {
    child?.kill('SIGTERM');
  } catch {
    // ignore
  }
  killPorts('web');
  setTimeout(() => process.exit(exitCode), 300);
}

killPorts('web');
console.log('Starting frontend only on http://localhost:4000');
console.log('Ensure API is running separately: npm run dev:api');
console.log('Press Ctrl+C to stop.\n');

child = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (!cleaning) cleanup(signal ? 0 : code ?? 0);
});

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

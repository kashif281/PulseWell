import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { killPorts } from '../../../scripts/kill-ports.mjs';

const PORT = 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, '..');
const devCacheDir = path.join(webDir, '.next/dev');
const lockPath = path.join(devCacheDir, 'lock');

// Only clear frontend ports when starting web alone (not when started via root dev.mjs)
killPorts('web');

if (fs.existsSync(devCacheDir)) {
  fs.rmSync(devCacheDir, { recursive: true, force: true });
}

if (fs.existsSync(lockPath)) {
  fs.unlinkSync(lockPath);
}

console.log(`Frontend will use port ${PORT}`);

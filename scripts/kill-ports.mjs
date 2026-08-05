import { execSync } from 'child_process';

const PORTS = {
  web: [3000, 4000],
  api: [5002],
  all: [3000, 4000, 5002],
};

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (!pids) return 0;
    let killed = 0;
    for (const pid of pids.split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        killed += 1;
      } catch {
        // already exited
      }
    }
    return killed;
  } catch {
    return 0;
  }
}

export function killPorts(target = 'all') {
  const ports = PORTS[target] ?? PORTS.all;
  let total = 0;
  for (const port of ports) {
    total += killPort(port);
  }
  return total;
}

const target = process.argv[2] || 'all';
const killed = killPorts(target);
if (process.argv[1]?.includes('kill-ports.mjs')) {
  const label = target === 'all' ? 'dev servers' : target;
  console.log(killed > 0 ? `Stopped ${killed} process(es) on ${label} port(s).` : `No processes found on ${label} port(s).`);
}

#!/usr/bin/env node
// Roda o Jest (ADR-001) sobre os testes compilados em dist-test/.
// O backend é ESM; o Jest precisa de --experimental-vm-modules para isso.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const jest = require.resolve('jest/bin/jest');
const backend = join(dirname(fileURLToPath(import.meta.url)), '..');

const resultado = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', '--no-warnings', jest, '--runInBand', ...process.argv.slice(2)],
  { cwd: backend, stdio: 'inherit' },
);
process.exit(resultado.status ?? 1);

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');
const engineDir = path.resolve(webDir, '../engine');
const wasmOutDir = path.resolve(webDir, 'src/wasm-pkg');

function runChecked(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: webDir,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

console.log('[grocerylab-build] Step 1/3: Bundling YAML config defaults...');
runChecked('node', [path.join(webDir, 'scripts/bundleConfig.cjs')], webDir);

console.log('[grocerylab-build] Step 2/3: Checking Rust/WebAssembly toolchain...');
const hasEngineCargo = fs.existsSync(path.join(engineDir, 'Cargo.toml'));
const hasCargo = commandExists('cargo');
const hasWasmPack = commandExists('wasm-pack');

if (hasEngineCargo && hasCargo && hasWasmPack) {
  console.log('[engine: wasm] Rust + wasm-pack detected. Running engine unit tests & building Wasm...');
  runChecked('cargo', ['test', '--manifest-path', path.join(engineDir, 'Cargo.toml')], webDir);
  runChecked(
    'wasm-pack',
    ['build', engineDir, '--target', 'web', '--out-dir', wasmOutDir, '--release'],
    webDir
  );
} else {
  const missing = [];
  if (!hasCargo) missing.push('cargo');
  if (!hasWasmPack) missing.push('wasm-pack');
  if (!hasEngineCargo) missing.push('engine/Cargo.toml');
  console.log(
    `[engine: typescript-fallback] Missing ${missing.join(', ')} in build environment; skipping Wasm compile and bundling the TypeScript Web Worker engine.`
  );
}

console.log('[grocerylab-build] Step 3/3: Compiling TypeScript & building Vite assets...');
runChecked('npm', ['run', 'build'], webDir);
console.log('[grocerylab-build] Build complete! Ready for `npx wrangler deploy`.');

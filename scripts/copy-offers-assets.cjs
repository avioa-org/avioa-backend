const { readdirSync, existsSync, mkdirSync, copyFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const targets = [
  join(root, 'dist', 'src', 'infrastructure', 'offers-runtime'),
  join(root, 'dist', 'infrastructure', 'offers-runtime'),
];

const srcDir = join(root, 'src', 'infrastructure', 'offers-runtime');
const files = ['runtime.cjs', 'postgres-adapter.cjs'];

let copied = 0;
for (const targetDir of targets) {
  const parent = join(targetDir, '..');
  if (existsSync(parent)) {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    for (const file of files) {
      const srcFile = join(srcDir, file);
      const dstFile = join(targetDir, file);
      if (existsSync(srcFile)) {
        copyFileSync(srcFile, dstFile);
        copied++;
      }
    }
  }
}

console.log(`Ofertas: ${copied} assets CJS copiados a dist.`);

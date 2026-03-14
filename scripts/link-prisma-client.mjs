import { mkdir, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , packageName, mode, generatedClientDir] = process.argv;

if (!packageName || !mode || (mode === 'generated' && !generatedClientDir)) {
  console.error(
    'Usage: node scripts/link-prisma-client.mjs <package-name> <installed|generated> [generated-client-dir]',
  );
  process.exit(1);
}

const repoRoot = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const packageRoot = path.join(repoRoot, 'packages', packageName);
const prismaScopeDir = path.join(packageRoot, 'node_modules', '@prisma');
const clientLinkPath = path.join(prismaScopeDir, 'client');
const resolveInstalledClientPath = async () => {
  const directPath = path.join(repoRoot, 'node_modules', '@prisma', 'client');

  try {
    const entries = await readdir(path.join(repoRoot, 'node_modules', '.pnpm'));
    const matchingEntry = entries.find((entry) => entry.startsWith('@prisma+client@'));

    if (!matchingEntry) {
      return directPath;
    }

    return path.join(repoRoot, 'node_modules', '.pnpm', matchingEntry, 'node_modules', '@prisma', 'client');
  } catch {
    return directPath;
  }
};
const targetPath =
  mode === 'installed'
    ? await resolveInstalledClientPath()
    : path.join(packageRoot, 'node_modules', '.prisma', generatedClientDir);
const relativeTarget = path.relative(prismaScopeDir, targetPath);

await mkdir(prismaScopeDir, { recursive: true });
await rm(clientLinkPath, { recursive: true, force: true });
await symlink(relativeTarget, clientLinkPath, 'dir');

console.log(`Linked ${clientLinkPath} -> ${relativeTarget}`);

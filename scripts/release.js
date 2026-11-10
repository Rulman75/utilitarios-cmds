const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Uso: node scripts/release.js [patch|minor|major]');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const filesToBump = [
  path.join(rootDir, 'package.json'),
  path.join(rootDir, 'backend', 'package.json'),
  path.join(rootDir, 'frontend', 'package.json')
];

const rootPkg = JSON.parse(fs.readFileSync(filesToBump[0], 'utf-8'));
const [major, minor, patch] = (rootPkg.version || '1.0.0').split('.').map(Number);

let nextVersion = '';
if (bumpType === 'major') {
  nextVersion = `${major + 1}.0.0`;
} else if (bumpType === 'minor') {
  nextVersion = `${major}.${minor + 1}.0`;
} else {
  nextVersion = `${major}.${minor}.${patch + 1}`;
}

console.log(`Actualizando versión SemVer: v${rootPkg.version} -> v${nextVersion}...`);

for (const file of filesToBump) {
  if (fs.existsSync(file)) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    pkg.version = nextVersion;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }
}

console.log('Compilando frontend con la nueva versión...');
execSync('npm run build', { cwd: path.join(rootDir, 'frontend'), stdio: 'inherit' });

console.log(`Creando commit y tag Git v${nextVersion}...`);
execSync('git add .', { cwd: rootDir, stdio: 'inherit' });
execSync(`git commit -m "chore(release): v${nextVersion}"`, { cwd: rootDir, stdio: 'inherit' });
execSync(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`, { cwd: rootDir, stdio: 'inherit' });

try {
  execSync('git push origin main --follow-tags', { cwd: rootDir, stdio: 'inherit' });
  console.log(`Versión v${nextVersion} publicada exitosamente en GitHub.`);
} catch {
  console.log(`Tag local v${nextVersion} creado. Ejecute "git push origin main --follow-tags" para subirlo.`);
}

// Copies the game's static files into www/, which is what Capacitor packages
// into the native Android app. There's no bundler/transpile step — this is
// a plain file copy — because the game is already dependency-free ES
// modules, plain CSS, and an SVG icon.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'www');
const ENTRIES = ['index.html', 'styles', 'src', 'public'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
for (const entry of ENTRIES) {
  copyRecursive(path.join(ROOT, entry), path.join(DEST, entry));
}
console.log(`Copied ${ENTRIES.join(', ')} -> www/`);

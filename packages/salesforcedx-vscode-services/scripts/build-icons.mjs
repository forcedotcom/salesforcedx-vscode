import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import svgtofont from 'svgtofont';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '..');
const ICONS_SRC = path.join(PKG_DIR, 'media/icons-src');
const ICONS_FONT = path.join(PKG_DIR, 'resources/icons-font');
const FONT_NAME = 'sf-media-icons';
const FONT_PATH = `resources/icons-font/${FONT_NAME}.woff`;

async function build() {
  const manifestPath = path.join(ICONS_SRC, 'icons.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifestEntries = Object.entries(manifest);
  const unicodeByName = new Map(manifestEntries.map(([name], index) => [name, String.fromCodePoint(0xe001 + index)]));

  await svgtofont({
    src: ICONS_SRC,
    dist: ICONS_FONT,
    fontName: FONT_NAME,
    css: false,
    generateInfoData: true,
    startUnicode: 0xe001,
    getIconUnicode: name => [unicodeByName.get(name), 0xe001],
    svgicons2svgfont: {
      fontHeight: 1000,
      normalize: true
    },
    website: null
  });

  const infoPath = path.join(ICONS_FONT, 'info.json');
  const infoData = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : {};

  const generatedNames = Object.keys(infoData);
  const missing = manifestEntries.map(([name]) => name).filter(name => !generatedNames.includes(name));
  const extra = generatedNames.filter(name => !Object.hasOwn(manifest, name));
  if (missing.length || extra.length) {
    throw new Error(`Icon manifest mismatch. Missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
  }

  const icons = Object.fromEntries(manifestEntries.map(([svgName, { id, description }]) => {
    const meta = infoData[svgName];
    const encoded = String(meta.encodedCode ?? '').replace(/^\\/i, '');
    return [id, {
      description,
      default: {
        fontPath: FONT_PATH,
        fontCharacter: `\\${encoded.toUpperCase()}`
      }
    }];
  }));

  const pkgPath = path.join(PKG_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.contributes = pkg.contributes ?? {};
  pkg.contributes.icons = icons;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  console.log('Icon font generated.');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});

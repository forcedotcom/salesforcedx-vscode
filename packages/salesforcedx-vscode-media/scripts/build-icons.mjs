import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import svgtofont from 'svgtofont';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '..');
const ICONS_SRC = path.join(PKG_DIR, 'media/icons-src');
const ICONS_FONT = path.join(PKG_DIR, 'media/icons-font');
const FONT_NAME = 'sf-media-icons';
const FONT_PATH = `media/icons-font/${FONT_NAME}.woff`;

async function build() {
  const infoData = await svgtofont({
    src: ICONS_SRC,
    dist: ICONS_FONT,
    fontName: FONT_NAME,
    css: false,
    startUnicode: 0xe001,
    svgicons2svgfont: {
      fontHeight: 1000,
      normalize: true
    },
    website: null
  });

  const manifestPath = path.join(ICONS_SRC, 'icons.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  const icons = {};
  for (const [svgName, meta] of Object.entries(infoData ?? {})) {
    const { id, description } = manifest[svgName] ?? {
      id: `sf-org-${svgName}`,
      description: `Icon for ${svgName}`
    };
    const encoded = String(meta.encodedCode ?? '').replace(/^\\/i, '');
    const fontCharacter = '\\' + encoded.toUpperCase();
    icons[id] = {
      description,
      default: {
        fontPath: FONT_PATH,
        fontCharacter
      }
    };
  }

  const pkgPath = path.join(PKG_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.contributes.icons = icons;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  console.log('Icon font generated.');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});

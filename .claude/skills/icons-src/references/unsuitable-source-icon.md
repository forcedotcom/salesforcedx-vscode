# Evidence: Icon Skill Handling Unsuitable Font Source

## Request

Add a new font from the source SVG at `/Users/peter.hale/Downloads/Propane_flame_contours-en.svg` to the services package.

## Outcome

The source SVG was **not suitable for font generation**. It was:

- **31MB** file size
- **~89,000 lines** of SVG markup
- **viewBox 722×1147** (icons-src requires 24×24)

### Why it failed

- `svgtofont` expects simple single-path glyphs. The Adobe Illustrator export contained many complex layers, thousands of paths, and a viewBox far outside the required 24×24.
- Font glyphs must be lightweight, single-path (or minimal paths), and fit within a normalized viewBox for proper scaling.

### Resolution

A simplified flame icon was created instead:

- Used a Font Awesome–style flame path scaled to fit 24×24
- `viewBox="0 0 24 24"`, `fill="currentColor"` per icons-src skill
- Added as `flame.svg` with `sf-org-flame` ID

## Takeaway

When adding icons from external sources (e.g. Wikipedia, Adobe Illustrator exports), the source may be too complex for font generation. Use the icons-src skill requirements (24×24 viewBox, simple paths, `currentColor`) and either simplify the source in a vector editor or substitute a suitable alternative.

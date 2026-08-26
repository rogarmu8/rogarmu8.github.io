# Rómulo García — portfolio

Minimal file-explorer style portfolio built with [Astro](https://astro.build), deployed to GitHub Pages from the `docs/` folder.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `docs/` for GitHub Pages.

## Content

Edit Markdown under `content/`:

- `content/about/about-me.md`
- `content/projects/<slug>/index.md` (+ any images in the same folder)

After editing project assets, copy non-markdown files into `public/projects/<slug>/` (or re-run the sync below) so they are served statically:

```bash
for d in content/projects/*/; do
  name=$(basename "$d")
  mkdir -p "public/projects/$name"
  find "$d" -maxdepth 1 -type f ! -name '*.md' -exec cp {} "public/projects/$name/" \;
done
```

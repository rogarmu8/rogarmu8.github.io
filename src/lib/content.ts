import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type ContentKind = "project" | "experience" | "about";

export type ContentFile = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  kind: ContentKind;
  filename: string;
  body: string;
  lines: string[];
  assetBase: string;
};

const ROOT = process.cwd();

const KIND_ORDER: Record<ContentKind, number> = {
  experience: 0,
  project: 1,
  about: 2,
};

function stripHugoShortcodes(body: string): string {
  return body
    .replace(/\{\{<\s*youtube\s+([^\s>]+)\s*>\}\}/g, (_m, id) => {
      return `\n<iframe class="yt" src="https://www.youtube.com/embed/${id}?enablejsapi=1" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>\n`;
    })
    .replace(/\{\{<[^>]+>\}\}/g, "")
    .replace(/\{\{%[^%]+%\}\}/g, "");
}

function rewriteRelativeAssets(body: string, assetBase: string): string {
  return body
    .replace(
      /!\[([^\]]*)\]\((?!https?:|\/|#)([^)]+)\)/g,
      (_m, alt, src) => `![${alt}](${assetBase}/${src.replace(/^\.\//, "")})`,
    )
    .replace(
      /\[([^\]]+)\]\((?!https?:|\/|#|mailto:|~\/)([^)]+)\)/g,
      (_m, text, href) => `[${text}](${assetBase}/${href.replace(/^\.\//, "")})`,
    );
}

function loadMarkdownFile(
  filePath: string,
  meta: { id: string; kind: ContentKind; assetBase: string; filename: string; order?: number },
): ContentFile {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const body = rewriteRelativeAssets(stripHugoShortcodes(content.trim()), meta.assetBase);
  const title = String(data.title ?? meta.id);
  const description = String(data.description ?? "");
  const order = Number(data.order ?? meta.order ?? 99);

  return {
    id: meta.id,
    slug: meta.id,
    title,
    description,
    order,
    kind: meta.kind,
    filename: meta.filename,
    body,
    lines: body.split("\n"),
    assetBase: meta.assetBase,
  };
}

function loadFlatMarkdownDir(dir: string, kind: ContentKind, assetRoot: string) {
  const files: ContentFile[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const slug = entry.name.replace(/\.md$/, "");
    files.push(
      loadMarkdownFile(path.join(dir, entry.name), {
        id: slug,
        kind,
        assetBase: `${assetRoot}/${slug}`,
        filename: entry.name,
      }),
    );
  }
  return files;
}

export function loadAllContent(): ContentFile[] {
  const files: ContentFile[] = [];

  files.push(...loadFlatMarkdownDir(path.join(ROOT, "content/projects"), "project", "/projects"));
  files.push(...loadFlatMarkdownDir(path.join(ROOT, "content/experience"), "experience", "/experience"));

  const aboutPath = path.join(ROOT, "content/about/about-me.md");
  if (fs.existsSync(aboutPath)) {
    files.push(
      loadMarkdownFile(aboutPath, {
        id: "about-me",
        kind: "about",
        assetBase: "/about",
        filename: "about-me.md",
        order: 0,
      }),
    );
  }

  return files.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );
}

function isSearchableLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith("<") && t.endsWith(">")) return false;
  if (/^<\/?[a-z][\s\S]*>$/i.test(t)) return false;
  if (t.startsWith("<iframe") || t.startsWith("<video") || t.startsWith("<source")) return false;
  return true;
}

export function buildSearchIndex(files: ContentFile[]) {
  return files.flatMap((file) => {
    const lineRows = file.lines
      .map((text, index) => ({
        fileId: file.id,
        filename: file.filename,
        title: file.title,
        description: file.description,
        line: index + 1,
        text,
      }))
      .filter((row) => isSearchableLine(row.text));

    if (file.description.trim()) {
      lineRows.unshift({
        fileId: file.id,
        filename: file.filename,
        title: file.title,
        description: file.description,
        line: 0,
        text: file.description,
      });
    }
    return lineRows;
  });
}

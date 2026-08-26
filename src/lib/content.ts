import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type ContentFile = {
  id: string;
  slug: string;
  title: string;
  description: string;
  weight: number;
  date: string | null;
  kind: "project" | "about";
  filename: string;
  body: string;
  lines: string[];
  assetBase: string;
};

const ROOT = process.cwd();

function stripHugoShortcodes(body: string): string {
  return body
    .replace(/\{\{<\s*youtube\s+([^\s>]+)\s*>\}\}/g, (_m, id) => {
      return `\n<iframe class="yt" src="https://www.youtube.com/embed/${id}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>\n`;
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
      /\[([^\]]+)\]\((?!https?:|\/|#|mailto:)([^)]+)\)/g,
      (_m, text, href) => `[${text}](${assetBase}/${href.replace(/^\.\//, "")})`,
    );
}

function loadMarkdownFile(
  filePath: string,
  meta: { id: string; kind: "project" | "about"; assetBase: string; filename: string; weight?: number },
): ContentFile {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const body = rewriteRelativeAssets(stripHugoShortcodes(content.trim()), meta.assetBase);
  const title = String(data.title ?? meta.id);
  const description = String(data.description ?? data.subtitle ?? "");
  const weight = Number(data.weight ?? meta.weight ?? 99);
  const date = data.date ? new Date(data.date).toISOString() : null;

  return {
    id: meta.id,
    slug: meta.id,
    title,
    description,
    weight,
    date,
    kind: meta.kind,
    filename: meta.filename,
    body,
    lines: body.split("\n"),
    assetBase: meta.assetBase,
  };
}

export function loadAllContent(): ContentFile[] {
  const files: ContentFile[] = [];

  const aboutPath = path.join(ROOT, "content/about/about-me.md");
  if (fs.existsSync(aboutPath)) {
    files.push(
      loadMarkdownFile(aboutPath, {
        id: "about-me",
        kind: "about",
        assetBase: "/about",
        filename: "about-me.md",
        weight: 0,
      }),
    );
  }

  const projectsDir = path.join(ROOT, "content/projects");
  if (fs.existsSync(projectsDir)) {
    for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(projectsDir, entry.name, "index.md");
      if (!fs.existsSync(indexPath)) continue;
      files.push(
        loadMarkdownFile(indexPath, {
          id: entry.name,
          kind: "project",
          assetBase: `/projects/${entry.name}`,
          filename: `${entry.name}.md`,
        }),
      );
    }
  }

  return files.sort((a, b) => a.weight - b.weight || a.title.localeCompare(b.title));
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
  return files.flatMap((file) =>
    file.lines
      .map((text, index) => ({
        fileId: file.id,
        filename: file.filename,
        title: file.title,
        line: index + 1,
        text,
      }))
      .filter((row) => isSearchableLine(row.text)),
  );
}

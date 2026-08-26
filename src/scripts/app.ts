import Fuse, { type FuseResultMatch } from "fuse.js";
import { marked } from "marked";

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

export type SearchRow = {
  fileId: string;
  filename: string;
  title: string;
  line: number;
  text: string;
};

type AppData = {
  files: ContentFile[];
  searchIndex: SearchRow[];
  pluginCount: number;
};

type View = "dashboard" | "explorer";
type FocusPane = "tree" | "editor";

const THEME_KEY = "portfolio-theme";
const LINE_SCROLL = 48;

marked.setOptions({ gfm: true, breaks: false });

function svgIcon(path: string, viewBox = "0 0 24 24") {
  return `<svg class="icon-svg" viewBox="${viewBox}" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const ICONS = {
  folder: svgIcon(
    `<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l1.8 2H19.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z"/>`,
  ),
  file: svgIcon(
    `<path d="M7 3.5h6.5L19 9v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5V9H19"/>`,
  ),
  user: svgIcon(
    `<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.2c1.6-3.1 3.8-4.6 6.5-4.6s4.9 1.5 6.5 4.6"/>`,
  ),
  search: svgIcon(`<circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/>`),
  sun: svgIcon(
    `<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>`,
  ),
  moon: svgIcon(
    `<path d="M20 13.5A7.5 7.5 0 1 1 10.5 4 6 6 0 0 0 20 13.5Z"/>`,
  ),
  bolt: "⚡",
  close: "✕",
  back: "←",
} as const;

export function bootApp(root: HTMLElement, data: AppData) {
  const filesById = new Map(data.files.map((f) => [f.id, f]));
  const projects = data.files.filter((f) => f.kind === "project");
  const about = data.files.find((f) => f.kind === "about");
  const treeFiles = [...projects, ...(about ? [about] : [])];

  let view: View = "dashboard";
  let selectedMenu = 0;
  let openTabs: string[] = [];
  let activeFileId: string | null = null;
  let highlightQuery: string | null = null;
  let highlightLine: number | null = null;
  let finderOpen = false;
  let finderQuery = "";
  let finderSelected = 0;
  let focusPane: FocusPane = "tree";
  let treeCursor = 0;
  let pendingKey: string | null = null;
  let pendingTimer: number | null = null;
  let helpOpen = false;
  let treeDrawerOpen = false;
  let editorLineIndex = 0;

  const fuse = new Fuse(data.searchIndex, {
    keys: [
      { name: "text", weight: 0.7 },
      { name: "title", weight: 0.2 },
      { name: "filename", weight: 0.1 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeMatches: true,
    minMatchCharLength: 1,
  });

  const menu = [
    { id: "browse", label: "Browse", key: "b", icon: ICONS.folder },
    { id: "fuzzy", label: "Fuzzy find", key: "f", icon: ICONS.search },
    { id: "about", label: "About me", key: "a", icon: ICONS.user },
    { id: "theme", label: "Toggle theme", key: "t", icon: ICONS.sun },
  ] as const;

  function preferredTheme(): "dark" | "light" {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function getTheme(): "dark" | "light" {
    return (document.documentElement.getAttribute("data-theme") as "dark" | "light") || preferredTheme();
  }

  function setTheme(theme: "dark" | "light", persist = true) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark", true);
    render();
  }

  function openFile(fileId: string | null | undefined, opts?: { highlight?: boolean; focus?: FocusPane }) {
    if (!fileId || !filesById.has(fileId)) return;
    const switched = activeFileId !== fileId;
    if (!openTabs.includes(fileId)) openTabs = [...openTabs, fileId];
    activeFileId = fileId;
    const idx = treeFiles.findIndex((f) => f.id === fileId);
    if (idx >= 0) treeCursor = idx;
    if (opts?.focus) focusPane = opts.focus;
    if (switched) editorLineIndex = 0;
    if (!opts?.highlight) {
      highlightQuery = null;
      highlightLine = null;
    }
  }

  function closeTab(fileId: string) {
    const index = openTabs.indexOf(fileId);
    if (index === -1) return;
    const wasActive = activeFileId === fileId;
    openTabs = openTabs.filter((id) => id !== fileId);
    if (wasActive) {
      activeFileId = openTabs[index] ?? openTabs[index - 1] ?? null;
      highlightQuery = null;
      highlightLine = null;
      if (activeFileId) {
        const idx = treeFiles.findIndex((f) => f.id === activeFileId);
        if (idx >= 0) treeCursor = idx;
      }
    }
  }

  function openExplorer(fileId?: string) {
    view = "explorer";
    finderOpen = false;
    helpOpen = false;
    treeDrawerOpen = false;
    clearPending();
    const target = fileId ?? projects[0]?.id ?? about?.id ?? null;
    openFile(target, { focus: "editor" });
    render();
  }

  function openAbout() {
    view = "explorer";
    finderOpen = false;
    helpOpen = false;
    clearPending();
    openFile(about?.id, { focus: "editor" });
    render();
  }

  function goDashboard() {
    view = "dashboard";
    finderOpen = false;
    helpOpen = false;
    treeDrawerOpen = false;
    clearPending();
    highlightQuery = null;
    highlightLine = null;
    render();
  }

  function toggleTreeDrawer() {
    treeDrawerOpen = !treeDrawerOpen;
    if (treeDrawerOpen) focusPane = "tree";
    render();
  }

  function closeTreeDrawer() {
    if (!treeDrawerOpen) return;
    treeDrawerOpen = false;
    render();
  }

  function openFinder() {
    finderOpen = true;
    helpOpen = false;
    treeDrawerOpen = false;
    clearPending();
    finderQuery = "";
    finderSelected = 0;
    render();
  }

  function closeFinder() {
    finderOpen = false;
    render();
  }

  function toggleHelp() {
    helpOpen = !helpOpen;
    clearPending();
    render();
  }

  function clearPending() {
    pendingKey = null;
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function armPending(key: string) {
    pendingKey = key;
    if (pendingTimer !== null) window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => {
      pendingKey = null;
      pendingTimer = null;
    }, 1000);
  }

  function syncFocusChrome() {
    root.querySelector(".tree")?.classList.toggle("is-focused", focusPane === "tree");
    root.querySelector(".editor")?.classList.toggle("is-focused", focusPane === "editor");
  }

  function getEditorLineEls(): HTMLElement[] {
    const md = root.querySelector(".md");
    if (!md) return [];
    return [
      ...md.querySelectorAll<HTMLElement>(
        ":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > blockquote, :scope > pre, :scope > iframe, :scope > video, :scope > img, :scope li",
      ),
    ];
  }

  function lineHasAction(el: HTMLElement) {
    return Boolean(
      el.matches("video, iframe.yt, img") ||
        el.querySelector("a[href], video, iframe.yt, iframe[src*='youtube'], iframe[src*='youtu.be'], img"),
    );
  }

  function syncEditorLine() {
    const lines = getEditorLineEls();
    const body = root.querySelector<HTMLElement>(".editor-body");
    for (const el of lines) {
      el.classList.remove("is-line-active", "has-link");
      el.style.removeProperty("--hl-inset-left");
      el.style.removeProperty("--hl-width");
    }

    let bar = body?.querySelector<HTMLElement>(".line-highlight-bar");
    if (!body) return;
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "line-highlight-bar";
      bar.setAttribute("aria-hidden", "true");
      body.prepend(bar);
    }

    if (focusPane !== "editor" || !lines.length) {
      bar.hidden = true;
      return;
    }

    editorLineIndex = Math.max(0, Math.min(editorLineIndex, lines.length - 1));
    const active = lines[editorLineIndex]!;
    active.classList.add("is-line-active");
    const actionable = lineHasAction(active);
    if (actionable) active.classList.add("has-link");

    const bodyRect = body.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    bar.hidden = false;
    bar.classList.toggle("has-link", actionable);
    bar.style.top = `${activeRect.top - bodyRect.top + body.scrollTop}px`;
    bar.style.height = `${Math.max(activeRect.height, 1)}px`;

    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    requestAnimationFrame(() => {
      const latestBody = root.querySelector<HTMLElement>(".editor-body");
      const latestBar = latestBody?.querySelector<HTMLElement>(".line-highlight-bar");
      const latestActive = getEditorLineEls()[editorLineIndex];
      if (!latestBody || !latestBar || !latestActive || focusPane !== "editor") return;
      const b = latestBody.getBoundingClientRect();
      const a = latestActive.getBoundingClientRect();
      latestBar.style.top = `${a.top - b.top + latestBody.scrollTop}px`;
      latestBar.style.height = `${Math.max(a.height, 1)}px`;
    });
  }

  function moveEditorLine(delta: number) {
    focusPane = "editor";
    const lines = getEditorLineEls();
    if (!lines.length) {
      scrollEditor("line", delta > 0 ? 1 : -1);
      syncFocusChrome();
      return;
    }
    editorLineIndex = Math.max(0, Math.min(lines.length - 1, editorLineIndex + delta));
    syncFocusChrome();
    syncEditorLine();
  }

  function toggleHtmlVideo(video: HTMLVideoElement) {
    if (video.paused) void video.play();
    else video.pause();
    return true;
  }

  function toggleYoutubeEmbed(iframe: HTMLIFrameElement) {
    try {
      const url = new URL(iframe.src, window.location.href);
      if (!url.searchParams.has("enablejsapi")) {
        url.searchParams.set("enablejsapi", "1");
        iframe.src = url.toString();
      }
    } catch {
      /* ignore */
    }
    const playing = iframe.dataset.playing === "1";
    const func = playing ? "pauseVideo" : "playVideo";
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
    iframe.dataset.playing = playing ? "0" : "1";
    return true;
  }

  function activateEditorLineLink() {
    const lines = getEditorLineEls();
    const active = lines[editorLineIndex];
    if (!active) return false;

    const video =
      (active.matches("video") ? active : null) || active.querySelector("video");
    if (video instanceof HTMLVideoElement) return toggleHtmlVideo(video);

    const yt =
      (active.matches("iframe.yt, iframe[src*='youtube'], iframe[src*='youtu.be']")
        ? active
        : null) ||
      active.querySelector<HTMLIFrameElement>("iframe.yt, iframe[src*='youtube'], iframe[src*='youtu.be']");
    if (yt instanceof HTMLIFrameElement) return toggleYoutubeEmbed(yt);

    const link = active.querySelector<HTMLAnchorElement>("a[href]");
    if (link) {
      const href = link.getAttribute("href")?.trim() ?? "";
      if (!href || href === "#") return false;
      if (href.startsWith("#")) {
        root.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      if (/^https?:\/\//i.test(link.href) || link.host !== window.location.host) {
        window.open(link.href, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(link.href);
      }
      return true;
    }

    const img = (active.matches("img") ? active : null) || active.querySelector("img");
    if (img instanceof HTMLImageElement && img.src) {
      window.open(img.currentSrc || img.src, "_blank", "noopener,noreferrer");
      return true;
    }

    return false;
  }

  function scrollEditor(mode: "line" | "half" | "page" | "top" | "bottom", dir: 1 | -1 = 1) {
    const body = root.querySelector<HTMLElement>(".editor-body");
    if (!body) return;
    if (mode === "top") {
      body.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (mode === "bottom") {
      body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
      return;
    }
    const amount =
      mode === "line" ? LINE_SCROLL : mode === "half" ? body.clientHeight * 0.45 : body.clientHeight * 0.9;
    body.scrollBy({ top: amount * dir, behavior: "smooth" });
  }

  function moveTreeCursor(delta: number) {
    if (!treeFiles.length) return;
    treeCursor = (treeCursor + delta + treeFiles.length) % treeFiles.length;
    focusPane = "tree";
    render();
    root.querySelector<HTMLElement>(".tree-file.is-cursor")?.scrollIntoView({ block: "nearest" });
  }

  function openTreeCursor() {
    const file = treeFiles[treeCursor];
    if (!file) return;
    treeDrawerOpen = false;
    openFile(file.id, { focus: "editor" });
    render();
  }

  function cycleTab(dir: 1 | -1) {
    if (!openTabs.length) return;
    const current = Math.max(0, openTabs.indexOf(activeFileId ?? ""));
    const next = openTabs[(current + dir + openTabs.length) % openTabs.length];
    openFile(next, { focus: "editor" });
    render();
  }

  function getFinderResults() {
    const q = finderQuery.trim();
    if (!q) {
      return data.searchIndex.slice(0, 40).map((item) => ({
        item,
        matches: undefined as readonly FuseResultMatch[] | undefined,
      }));
    }
    return fuse.search(q, { limit: 60 });
  }

  function markSearchMedia(body: HTMLElement, row: SearchRow, query: string | null) {
    const mdImage = row.text.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
    const needle = mdImage?.[1]?.split("/").pop()?.toLowerCase() ?? null;
    const q = query && query.length > 1 ? query.toLowerCase() : null;

    for (const img of body.querySelectorAll<HTMLImageElement>("img")) {
      const src = (img.getAttribute("src") || "").toLowerCase();
      const alt = (img.getAttribute("alt") || "").toLowerCase();
      const byLine = needle ? src.includes(needle) : false;
      const byQuery = q ? src.includes(q) || alt.includes(q) : false;
      if (byLine || byQuery) img.classList.add("search-hit");
    }
  }

  function openSearchHit(row: SearchRow) {
    view = "explorer";
    helpOpen = false;
    openFile(row.fileId, { highlight: true, focus: "editor" });
    highlightLine = row.line;
    highlightQuery = finderQuery.trim() || null;
    finderOpen = false;
    render();
    requestAnimationFrame(() => {
      const body = root.querySelector<HTMLElement>(".editor-body");
      if (body) markSearchMedia(body, row, highlightQuery);
      const hit =
        root.querySelector<HTMLElement>(".search-hit") ||
        root.querySelector<HTMLElement>("[data-line]");
      hit?.scrollIntoView({ block: "center", behavior: "smooth" });
      body?.focus({ preventScroll: true });
    });
  }

  function runMenu(id: (typeof menu)[number]["id"]) {
    if (id === "browse") openExplorer();
    else if (id === "fuzzy") openFinder();
    else if (id === "about") openAbout();
    else if (id === "theme") toggleTheme();
  }

  function highlightInHtml(html: string, query: string) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    // Only highlight text nodes — never inside tags/attributes (keeps img src intact)
    return html.replace(/(<[^>]*>)|([^<]+)/g, (match, tag, text) => {
      if (tag) return tag;
      return text.replace(re, `<mark class="search-hit">$1</mark>`);
    });
  }

  function renderMarkdown(file: ContentFile) {
    const hasLeadingTitle = /^\s*#\s+/.test(file.body);
    const source = hasLeadingTitle ? file.body : `# ${file.title}\n\n${file.body}`;
    let html = marked.parse(source) as string;
    if (highlightQuery && highlightQuery.length > 1) {
      html = highlightInHtml(html, highlightQuery);
    }
    if (highlightLine) {
      html = `<div class="line-jump" data-line="${highlightLine}"></div>${html}`;
    }
    return html;
  }

  function logoArt() {
    return [
      "██████╗  ██████╗ ███╗   ███╗██╗   ██╗██╗      ██████╗",
      "██╔══██╗██╔═══██╗████╗ ████║██║   ██║██║     ██╔═══██╗",
      "██████╔╝██║   ██║██╔████╔██║██║   ██║██║     ██║   ██║",
      "██╔══██╗██║   ██║██║╚██╔╝██║██║   ██║██║     ██║   ██║",
      "██║  ██║╚██████╔╝██║ ╚═╝ ██║╚██████╔╝███████╗╚██████╔╝",
      "╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝",
    ].join("\n");
  }

  function renderDashboard() {
    return `
      <section id="dashboard" class="screen is-active" aria-label="Dashboard">
        <div class="logo">
          <pre class="logo-art">${logoArt()}</pre>
          <p class="logo-word">ROMULO</p>
          <p class="logo-sub">Rómulo García — software engineer</p>
        </div>
        <nav class="menu" role="menu" aria-label="Main menu">
          ${menu
            .map((item, i) => {
              const isDark = getTheme() === "dark";
              const label =
                item.id === "theme" ? (isDark ? "Theme (Light)" : "Theme (Dark)") : item.label;
              const icon = item.id === "theme" ? (isDark ? ICONS.sun : ICONS.moon) : item.icon;
              return `
                <button
                  class="menu-item ${i === selectedMenu ? "is-selected" : ""}"
                  data-menu="${item.id}"
                  data-index="${i}"
                  role="menuitem"
                >
                  <span class="menu-icon" aria-hidden="true">${icon}</span>
                  <span class="menu-label">${escapeHtml(label)}</span>
                  <span class="menu-key">${item.key}</span>
                </button>`;
            })
            .join("")}
        </nav>
        <p class="statusline"><span class="bolt">${ICONS.bolt}</span> portfolio loaded in ${formatMs()}</p>
        <p class="keymap-hint"><kbd>j</kbd>/<kbd>k</kbd> move · <kbd>↵</kbd> open · <kbd>f</kbd> find · <kbd>?</kbd> keys</p>
      </section>
    `;
  }

  function renderExplorer() {
    const file = activeFileId ? filesById.get(activeFileId) : undefined;
    const tabs = openTabs
      .map((id) => filesById.get(id))
      .filter((f): f is ContentFile => Boolean(f));
    const cursorId = treeFiles[treeCursor]?.id;

    return `
      <section id="explorer" class="screen is-active" aria-label="File explorer">
        <div class="topbar">
          <button class="topbar-btn" data-action="home" title="Back to menu (Esc / q)">${ICONS.back} menu</button>
          <button class="topbar-btn topbar-files" data-action="files" title="Files" aria-expanded="${treeDrawerOpen}">${ICONS.folder} files</button>
          <button class="topbar-btn" data-action="fuzzy" title="Fuzzy find (f)">${ICONS.search} find</button>
          <div class="topbar-path">${
            file
              ? `~/${file.kind === "about" ? "about" : "projects"}/<strong>${escapeHtml(file.filename)}</strong>`
              : "~/"
          }</div>
          <button class="topbar-btn topbar-help" data-action="help" title="Keybindings (?)">?</button>
        </div>
        <div class="workspace ${treeDrawerOpen ? "is-drawer-open" : ""}">
          <div class="tree-backdrop" data-action="close-drawer"${treeDrawerOpen ? "" : " hidden"}></div>
          <aside class="tree ${focusPane === "tree" ? "is-focused" : ""} ${treeDrawerOpen ? "is-open" : ""}" aria-label="File tree" data-pane="tree">
            <div class="tree-title"><span>FILES</span></div>
            <div class="tree-group">
              <div class="tree-folder"><span class="icon">${ICONS.folder}</span><span>projects</span></div>
              ${projects
                .map(
                  (p) => `
                <button class="tree-file ${activeFileId === p.id ? "is-active" : ""} ${cursorId === p.id ? "is-cursor" : ""}" data-file="${p.id}">
                  <span class="icon">${ICONS.file}</span>
                  <span>${escapeHtml(p.filename)}</span>
                </button>`,
                )
                .join("")}
            </div>
            ${
              about
                ? `<div class="tree-group">
              <div class="tree-folder"><span class="icon">${ICONS.folder}</span><span>about</span></div>
              <button class="tree-file ${activeFileId === about.id ? "is-active" : ""} ${cursorId === about.id ? "is-cursor" : ""}" data-file="${about.id}">
                <span class="icon">${ICONS.file}</span>
                <span>${escapeHtml(about.filename)}</span>
              </button>
            </div>`
                : ""
            }
          </aside>
          <div class="editor ${focusPane === "editor" ? "is-focused" : ""}" data-pane="editor">
            <div class="tabs" role="tablist" aria-label="Open files">
              ${tabs
                .map(
                  (tab) => `
                <div class="tab ${activeFileId === tab.id ? "is-active" : ""}" role="presentation">
                  <button
                    class="tab-main"
                    data-tab="${tab.id}"
                    role="tab"
                    aria-selected="${activeFileId === tab.id}"
                    title="${escapeAttr(tab.filename)}"
                  >
                    ${ICONS.file}<span>${escapeHtml(tab.filename)}</span>
                  </button>
                  <button
                    class="tab-close"
                    data-close-tab="${tab.id}"
                    aria-label="Close ${escapeAttr(tab.filename)}"
                    title="Close"
                  >${ICONS.close}</button>
                </div>`,
                )
                .join("")}
            </div>
            <div class="editor-body" tabindex="0">
              ${
                file
                  ? `<article class="md">${renderMarkdown(file)}</article>`
                  : `<div class="editor-empty">Open a file from the file explorer</div>`
              }
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderFinder() {
    if (!finderOpen) return "";
    const results = getFinderResults();
    const count = results.length;
    return `
      <div id="finder-overlay" class="is-open" role="dialog" aria-modal="true" aria-label="Fuzzy finder">
        <div class="finder">
          <div class="finder-input-wrap">
            <span class="finder-prompt">${ICONS.search}</span>
            <input id="finder-input" class="finder-input" type="text" placeholder="Search across projects…" value="${escapeAttr(finderQuery)}" autocomplete="off" spellcheck="false" />
            <span class="finder-meta">${count} matches</span>
          </div>
          <div class="finder-results" id="finder-results">
            ${
              count === 0
                ? `<div class="finder-empty">No matches</div>`
                : results
                    .map((result, i) => {
                      const row = result.item;
                      const text = highlightFuse(row.text, result.matches);
                      return `
                        <button class="finder-item ${i === finderSelected ? "is-selected" : ""}" data-hit="${i}">
                          <span class="finder-item-file">${escapeHtml(row.filename)}  ·  ${escapeHtml(row.title)}</span>
                          <span class="finder-item-line">${row.line}</span>
                          <span class="finder-item-text">${text}</span>
                        </button>`;
                    })
                    .join("")
            }
          </div>
          <div class="finder-footer">
            <span><kbd>↵</kbd> open</span>
            <span><kbd>ctrl-j/k</kbd> move</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderHelp() {
    if (!helpOpen) return "";
    return `
      <div id="help-overlay" class="is-open" role="dialog" aria-modal="true" aria-label="Vim keybindings">
        <div class="help-card">
          <div class="help-title">vim motions <span>press ? or esc to close</span></div>
          <div class="help-grid">
            <div>
              <h3>Dashboard</h3>
              <ul>
                <li><kbd>j</kbd>/<kbd>k</kbd> move menu</li>
                <li><kbd>↵</kbd> select</li>
                <li><kbd>b</kbd> browse · <kbd>f</kbd> find</li>
                <li><kbd>a</kbd> about · <kbd>t</kbd> theme</li>
              </ul>
            </div>
            <div>
              <h3>Explorer</h3>
              <ul>
                <li><kbd>h</kbd>/<kbd>l</kbd> files ↔ editor</li>
                <li><kbd>j</kbd>/<kbd>k</kbd> move lines / files</li>
                <li><kbd>↵</kbd> open file / link / image, play video</li>
                <li><kbd>f</kbd> or <kbd>/</kbd> fuzzy find</li>
                <li><kbd>gt</kbd>/<kbd>gT</kbd> next / prev tab</li>
                <li><kbd>gg</kbd>/<kbd>G</kbd> first / last line</li>
                <li><kbd>ctrl-d</kbd>/<kbd>ctrl-u</kbd> page</li>
                <li><kbd>x</kbd> close tab · <kbd>q</kbd> menu</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const main = view === "dashboard" ? renderDashboard() : renderExplorer();
    root.innerHTML = main + renderFinder() + renderHelp();
    bind();
    if (view === "explorer" && focusPane === "editor") {
      requestAnimationFrame(() => syncEditorLine());
    }
  }

  function updateFinderResultsOnly() {
    const panel = root.querySelector("#finder-results");
    const meta = root.querySelector(".finder-meta");
    if (!panel || !meta) {
      render();
      return;
    }
    const results = getFinderResults();
    meta.textContent = `${results.length} matches`;
    panel.innerHTML =
      results.length === 0
        ? `<div class="finder-empty">No matches</div>`
        : results
            .map((result, i) => {
              const row = result.item;
              const text = highlightFuse(row.text, result.matches);
              return `
                <button class="finder-item ${i === finderSelected ? "is-selected" : ""}" data-hit="${i}">
                  <span class="finder-item-file">${escapeHtml(row.filename)}  ·  ${escapeHtml(row.title)}</span>
                  <span class="finder-item-line">${row.line}</span>
                  <span class="finder-item-text">${text}</span>
                </button>`;
            })
            .join("");

    panel.querySelectorAll<HTMLButtonElement>("[data-hit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.hit ?? 0);
        const row = getFinderResults()[idx]?.item;
        if (row) openSearchHit(row);
      });
    });
  }

  function bind() {
    root.querySelectorAll<HTMLButtonElement>("[data-menu]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedMenu = Number(btn.dataset.index ?? 0);
        runMenu(btn.dataset.menu as (typeof menu)[number]["id"]);
      });
      btn.addEventListener("mouseenter", () => {
        setSelectedMenu(Number(btn.dataset.index ?? 0));
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-file]").forEach((btn) => {
      btn.addEventListener("click", () => {
        focusPane = "tree";
        treeDrawerOpen = false;
        openFile(btn.dataset.file, { focus: "editor" });
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openFile(btn.dataset.tab, { focus: "editor" });
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-close-tab]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTab(btn.dataset.closeTab ?? "");
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-action="home"]').forEach((btn) => {
      btn.addEventListener("click", goDashboard);
    });

    root.querySelectorAll<HTMLButtonElement>('[data-action="fuzzy"]').forEach((btn) => {
      btn.addEventListener("click", openFinder);
    });

    root.querySelectorAll<HTMLButtonElement>('[data-action="help"]').forEach((btn) => {
      btn.addEventListener("click", toggleHelp);
    });

    root.querySelectorAll<HTMLButtonElement>('[data-action="files"]').forEach((btn) => {
      btn.addEventListener("click", toggleTreeDrawer);
    });

    root.querySelectorAll('[data-action="close-drawer"]').forEach((el) => {
      el.addEventListener("click", closeTreeDrawer);
    });

    root.querySelector("[data-pane='tree']")?.addEventListener("mousedown", () => {
      focusPane = "tree";
      for (const el of getEditorLineEls()) el.classList.remove("is-line-active", "has-link");
      const bar = root.querySelector<HTMLElement>(".line-highlight-bar");
      if (bar) bar.hidden = true;
      syncFocusChrome();
    });

    root.querySelector("[data-pane='editor']")?.addEventListener("mousedown", () => {
      focusPane = "editor";
      syncFocusChrome();
      syncEditorLine();
    });

    const overlay = root.querySelector("#finder-overlay");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeFinder();
    });

    const helpOverlay = root.querySelector("#help-overlay");
    helpOverlay?.addEventListener("click", (e) => {
      if (e.target === helpOverlay) {
        helpOpen = false;
        render();
      }
    });

    const input = root.querySelector<HTMLInputElement>("#finder-input");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener("input", () => {
        finderQuery = input.value;
        finderSelected = 0;
        updateFinderResultsOnly();
      });
    }

    root.querySelectorAll<HTMLButtonElement>("[data-hit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.hit ?? 0);
        const row = getFinderResults()[idx]?.item;
        if (row) openSearchHit(row);
      });
    });
  }

  function moveFinder(delta: number) {
    const results = getFinderResults();
    if (!results.length) return;
    finderSelected = (finderSelected + delta + results.length) % results.length;
    updateFinderResultsOnly();
    root.querySelector<HTMLElement>(".finder-item.is-selected")?.scrollIntoView({ block: "nearest" });
  }

  function setSelectedMenu(index: number) {
    selectedMenu = index;
    root.querySelectorAll(".menu-item").forEach((el, i) => {
      el.classList.toggle("is-selected", i === selectedMenu);
    });
  }

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    const key = e.key;

    if (helpOpen) {
      if (key === "Escape" || key === "?" || key === "q") {
        e.preventDefault();
        helpOpen = false;
        render();
      }
      return;
    }

    if (finderOpen) {
      if (key === "Escape") {
        e.preventDefault();
        closeFinder();
        return;
      }
      if (key === "ArrowDown" || ((key === "j" || key === "n") && e.ctrlKey)) {
        e.preventDefault();
        moveFinder(1);
        return;
      }
      if (key === "ArrowUp" || ((key === "k" || key === "p") && e.ctrlKey)) {
        e.preventDefault();
        moveFinder(-1);
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        const row = getFinderResults()[finderSelected]?.item;
        if (row) openSearchHit(row);
        return;
      }
      return;
    }

    if (typing) return;

    if (view === "dashboard") {
      if (key === "?" ) {
        e.preventDefault();
        toggleHelp();
        return;
      }
      if (key === "ArrowDown" || key === "j") {
        e.preventDefault();
        setSelectedMenu((selectedMenu + 1) % menu.length);
        return;
      }
      if (key === "ArrowUp" || key === "k") {
        e.preventDefault();
        setSelectedMenu((selectedMenu - 1 + menu.length) % menu.length);
        return;
      }
      if (key === "Enter" || key === "l") {
        e.preventDefault();
        runMenu(menu[selectedMenu]!.id);
        return;
      }
      const hot = menu.find((m) => m.key === key.toLowerCase());
      if (hot && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        selectedMenu = menu.indexOf(hot);
        runMenu(hot.id);
      }
      return;
    }

    if (view !== "explorer") return;

    // Pending "g" leader
    if (pendingKey === "g") {
      if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
        return;
      }
      e.preventDefault();
      const second = key;
      clearPending();
      if (second === "g") {
        focusPane = "editor";
        editorLineIndex = 0;
        syncFocusChrome();
        syncEditorLine();
        scrollEditor("top");
      } else if (second.toLowerCase() === "t") {
        cycleTab(second === "T" || e.shiftKey ? -1 : 1);
      } else {
        syncFocusChrome();
      }
      return;
    }

    if (key === "Escape") {
      e.preventDefault();
      if (treeDrawerOpen) {
        closeTreeDrawer();
        return;
      }
      goDashboard();
      return;
    }

    if (key === "q") {
      e.preventDefault();
      goDashboard();
      return;
    }

    if (key === "?") {
      e.preventDefault();
      toggleHelp();
      return;
    }

    if (key === "f" || key === "/") {
      e.preventDefault();
      openFinder();
      return;
    }

    if (key === "g" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      armPending("g");
      return;
    }

    if (key === "G") {
      e.preventDefault();
      focusPane = "editor";
      const lines = getEditorLineEls();
      editorLineIndex = Math.max(0, lines.length - 1);
      syncFocusChrome();
      syncEditorLine();
      return;
    }

    if (key === "x") {
      e.preventDefault();
      if (activeFileId) {
        closeTab(activeFileId);
        render();
      }
      return;
    }

    if (e.ctrlKey && (key === "d" || key === "u" || key === "f" || key === "b")) {
      e.preventDefault();
      focusPane = "editor";
      if (key === "d" || key === "f") scrollEditor(key === "d" ? "half" : "page", 1);
      else scrollEditor(key === "u" ? "half" : "page", -1);
      syncFocusChrome();
      return;
    }

    if (key === "Tab") {
      e.preventDefault();
      cycleTab(e.shiftKey ? -1 : 1);
      return;
    }

    if (key === "h" || key === "ArrowLeft") {
      e.preventDefault();
      focusPane = "tree";
      for (const el of getEditorLineEls()) el.classList.remove("is-line-active", "has-link");
      const bar = root.querySelector<HTMLElement>(".line-highlight-bar");
      if (bar) bar.hidden = true;
      if (window.matchMedia("(max-width: 760px)").matches) {
        treeDrawerOpen = true;
        render();
      } else {
        syncFocusChrome();
      }
      return;
    }

    if (key === "l" || key === "ArrowRight") {
      e.preventDefault();
      if (focusPane === "tree") openTreeCursor();
      else {
        focusPane = "editor";
        if (treeDrawerOpen) closeTreeDrawer();
        else {
          syncFocusChrome();
          syncEditorLine();
        }
      }
      return;
    }

    if (key === "Enter") {
      e.preventDefault();
      if (focusPane === "tree") openTreeCursor();
      else activateEditorLineLink();
      return;
    }

    if (key === "j" || key === "ArrowDown") {
      e.preventDefault();
      if (focusPane === "tree") moveTreeCursor(1);
      else moveEditorLine(1);
      return;
    }

    if (key === "k" || key === "ArrowUp") {
      e.preventDefault();
      if (focusPane === "tree") moveTreeCursor(-1);
      else moveEditorLine(-1);
      return;
    }

    if (key === " ") {
      e.preventDefault();
      focusPane = "editor";
      scrollEditor("half", e.shiftKey ? -1 : 1);
      syncFocusChrome();
    }
  }

  const saved = localStorage.getItem(THEME_KEY) as "dark" | "light" | null;
  if (saved === "light" || saved === "dark") setTheme(saved, true);
  else setTheme(preferredTheme(), false);

  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSchemeChange = () => {
    if (localStorage.getItem(THEME_KEY) === "light" || localStorage.getItem(THEME_KEY) === "dark") return;
    setTheme(preferredTheme(), false);
    if (view === "dashboard") render();
    else syncFocusChrome();
  };
  media.addEventListener("change", onSchemeChange);

  window.addEventListener("keydown", onKeydown);
  render();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function highlightFuse(text: string, matches?: readonly FuseResultMatch[]) {
  const match = matches?.find((m) => m.key === "text");
  if (!match?.indices?.length) return escapeHtml(text);
  let out = "";
  let cursor = 0;
  for (const [start, end] of match.indices) {
    out += escapeHtml(text.slice(cursor, start));
    out += `<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`;
    cursor = end + 1;
  }
  out += escapeHtml(text.slice(cursor));
  return out;
}

function formatMs() {
  return `${(0.008 + Math.random() * 0.012).toFixed(3)}s`;
}

declare global {
  interface Window {
    __PORTFOLIO__: AppData;
  }
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mediaProjects = path.join(root, "content/media/projects");
const mediaExperience = path.join(root, "content/media/experience");
const publicProjects = path.join(root, "public/projects");
const publicExperience = path.join(root, "public/experience");
const publicAbout = path.join(root, "public/about");

function syncMediaDir(srcRoot, destRoot) {
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });
  if (!fs.existsSync(srcRoot)) return;
  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcDir = path.join(srcRoot, entry.name);
    const destDir = path.join(destRoot, entry.name);
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
  }
}

syncMediaDir(mediaProjects, publicProjects);
syncMediaDir(mediaExperience, publicExperience);

fs.mkdirSync(publicAbout, { recursive: true });
const aboutDir = path.join(root, "content/about");
if (fs.existsSync(aboutDir)) {
  for (const file of fs.readdirSync(aboutDir)) {
    if (file.endsWith(".md")) continue;
    fs.copyFileSync(path.join(aboutDir, file), path.join(publicAbout, file));
  }
}

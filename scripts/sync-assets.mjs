import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const projectsDir = path.join(root, "content/projects");
const publicProjects = path.join(root, "public/projects");
const publicAbout = path.join(root, "public/about");

fs.mkdirSync(publicProjects, { recursive: true });
fs.mkdirSync(publicAbout, { recursive: true });

if (fs.existsSync(projectsDir)) {
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcDir = path.join(projectsDir, entry.name);
    const destDir = path.join(publicProjects, entry.name);
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
      if (file.endsWith(".md")) continue;
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
  }
}

const aboutDir = path.join(root, "content/about");
if (fs.existsSync(aboutDir)) {
  for (const file of fs.readdirSync(aboutDir)) {
    if (file.endsWith(".md")) continue;
    fs.copyFileSync(path.join(aboutDir, file), path.join(publicAbout, file));
  }
}

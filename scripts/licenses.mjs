import fs from "node:fs";
import path from "node:path";

const target = "public/licenses";
fs.mkdirSync(target, { recursive: true });
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location || pkg.dev || !fs.existsSync(location)) continue;
  const name = location.split("node_modules/").at(-1).replaceAll("/", "__");
  for (const entry of fs.readdirSync(location)) {
    if (!/^(licen[sc]e|copying|notice|thirdpartylicenses)/i.test(entry))
      continue;
    const file = path.join(location, entry);
    if (fs.statSync(file).isFile())
      fs.copyFileSync(file, path.join(target, `${name}--${entry}`));
  }
}
const agpl = "node_modules/@imgly/background-removal/LICENSE.md";
if (!fs.existsSync(agpl)) throw new Error("Missing IMG.LY AGPL license");
fs.copyFileSync(agpl, path.join(target, "AGPL-3.0.txt"));
fs.copyFileSync("LICENSE", path.join(target, "APPLICATION-MIT.txt"));
fs.copyFileSync("THIRD_PARTY_NOTICES.md", path.join(target, "NOTICES.md"));

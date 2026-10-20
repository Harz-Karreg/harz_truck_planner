const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const directories = [path.join(root, "harz-karreg-webapp", "js")];
let checked = 0;

for (const directory of directories) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".js") continue;

    const filename = path.join(directory, entry.name);
    const source = fs.readFileSync(filename, "utf8");
    new vm.Script(source, { filename });
    checked += 1;
  }
}

console.log(`${checked} fichiers JavaScript verifies.`);

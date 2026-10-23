const fs = require("node:fs");
const ejs = require("ejs");

for (const filename of fs.globSync("templates/**/*.ejs")) {
  ejs.compile(fs.readFileSync(filename, "utf8"), { filename });
  console.log(`Checked ${filename}`);
}

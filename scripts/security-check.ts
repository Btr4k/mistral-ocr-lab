import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function run(name: string, command: string, args: string[]) {
  console.log(`security: ${name}`);
  execFileSync(command, args, { stdio: "inherit", cwd: root });
}

run("npm audit production high+", "npm", ["audit", "--omit=dev", "--audit-level=high"]);

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.startsWith("package-lock.json"));

let failed = false;
const forbidden = [
  /NEXT_PUBLIC_MISTRAL_API_KEY/,
  /MISTRAL_API_KEY\s*=\s*['"][^'"]+['"]/,
  /sk-[A-Za-z0-9_-]{12,}/,
  /Authorization:\s*Bearer/i,
  /dangerouslySetInnerHTML(?![\s\S]{0,120}table\.html)/
];

for (const file of tracked) {
  if (/\.(png|jpg|jpeg|webp|pdf|ico)$/i.test(file)) continue;
  const text = readFileSync(join(root, file), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`security: forbidden pattern ${pattern} in ${file}`);
      failed = true;
    }
  }
}

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
for (const required of [".env", ".env.production", "node_modules/"]) {
  if (!gitignore.includes(required)) {
    console.error(`security: .gitignore missing ${required}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("security: local checks completed; npm audit is not a proof of security.");

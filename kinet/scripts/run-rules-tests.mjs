import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const configHome = resolve(".cache/firebase-config");
mkdirSync(configHome, { recursive: true });
const firebaseCli = resolve("node_modules/firebase-tools/lib/bin/firebase.js");
const testCommand = "npm run test:rules:execute";
const result = spawnSync(process.execPath, [firebaseCli, "emulators:exec", "--only", "firestore", "--project", "demo-kinet", testCommand], {
  stdio: "inherit",
  env: { ...process.env, XDG_CONFIG_HOME: configHome, FIREBASE_EMULATORS_PATH: resolve(".cache/firebase-emulators"), FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true" },
  shell: false,
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);

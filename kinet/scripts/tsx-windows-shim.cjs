// Node 26 on some managed Windows environments can throw from os.userInfo().
// tsx only needs a stable username to select its temporary directory.
const os = require("node:os");
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({ uid: -1, gid: -1, username: process.env.USERNAME || "kinet", homedir: process.env.USERPROFILE || process.cwd(), shell: null });
}

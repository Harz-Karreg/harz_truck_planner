const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const installer = fs.readFileSync(
  path.join(root, "deployment", "raspberry-pi", "install-harzos.sh"),
  "utf8"
);

test("l'installateur HarzOS est strict, ARM64 et idempotent", () => {
  assert.match(installer, /^#!\/usr\/bin\/env bash/);
  assert.match(installer, /set -Eeuo pipefail/);
  assert.match(installer, /ARCH.*dpkg --print-architecture/);
  assert.match(installer, /if \[\[ -d "\$SOURCE_DIR\/\.git" \]\]/);
  assert.match(installer, /merge --ff-only/);
  assert.match(installer, /Configuration existante conservée/);
});

test("l'installateur démarre un service contrôlé sans effacer les données", () => {
  assert.match(installer, /docker compose/);
  assert.match(installer, /systemctl enable --now docker/);
  assert.match(installer, /healthz/);
  assert.doesNotMatch(installer, /docker system prune/);
  assert.doesNotMatch(installer, /rm -rf.*harzkarreg/);
  assert.doesNotMatch(installer, /chmod 777/);
});

test("Electron reste une option soumise à un contrôle d'espace", () => {
  assert.match(installer, /--with-electron/);
  assert.match(installer, /REQUIRED_KB=\$\(\(6 \* 1024 \* 1024\)\)/);
  assert.match(installer, /npm --prefix "\$SOURCE_DIR" run dist:pi/);
});

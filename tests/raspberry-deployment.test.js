const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("le déploiement Raspberry expose Companion avec un conteneur non privilégié", () => {
  const compose = read("deployment/raspberry-pi/compose.yaml");
  const dockerfile = read("deployment/raspberry-pi/Dockerfile.companion");

  assert.match(compose, /restart: unless-stopped/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.match(compose, /HK_PUBLIC_PORT:-8080/);
  assert.match(compose, /healthz/);
  assert.match(dockerfile, /nginxinc\/nginx-unprivileged:1\.27-alpine/);
  assert.match(dockerfile, /COPY src\/renderer\//);
});

test("la configuration Nginx ouvre Companion et fournit un endpoint de santé", () => {
  const nginx = read("deployment/raspberry-pi/nginx.conf");

  assert.match(nginx, /return 302 \/companion\//);
  assert.match(nginx, /location = \/healthz/);
  assert.match(nginx, /X-Content-Type-Options "nosniff"/);
  assert.doesNotMatch(nginx, /autoindex\s+on/);
});

test("l'exemple d'environnement ne contient aucun secret", () => {
  const environment = read("deployment/raspberry-pi/.env.example");

  assert.match(environment, /HK_BIND_ADDRESS=0\.0\.0\.0/);
  assert.match(environment, /HK_PUBLIC_PORT=8080/);
  assert.doesNotMatch(environment, /(PASSWORD|TOKEN|SECRET|PRIVATE_KEY)=\S+/);
});

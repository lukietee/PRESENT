#!/usr/bin/env node
/**
 * Reads ngrok's local API (http://127.0.0.1:4040) and sets SERVER_URL in repo-root .env
 * to the https tunnel hostname forwarding to localhost:3001.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const data = await httpGetJson("http://127.0.0.1:4040/api/tunnels");
  const tunnel = data.tunnels?.find(
    (t) =>
      t.proto === "https" &&
      String(t.config?.addr ?? "").includes("3001"),
  );
  if (!tunnel?.public_url) {
    console.error(
      "No ngrok https tunnel to port 3001. Start one with: npm run tunnel:server",
    );
    process.exit(1);
  }
  const host = new URL(tunnel.public_url).host;

  let text = fs.readFileSync(ENV_PATH, "utf8");
  if (!/^SERVER_URL=/m.test(text)) {
    text = text.replace(/\n?$/, `\nSERVER_URL=${host}\n`);
  } else {
    text = text.replace(/^SERVER_URL=.*$/m, `SERVER_URL=${host}`);
  }
  fs.writeFileSync(ENV_PATH, text);
  console.log(`Updated ${path.basename(ENV_PATH)} SERVER_URL=${host}`);
  console.log(
    "Twilio Voice webhook (POST): https://" + host + "/api/twilio/voice",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

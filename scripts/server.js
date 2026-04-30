const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 3000;
const paths = {
  input: path.join(root, "data", "input.txt"),
  output: path.join(root, "data", "output.txt"),
  exe: path.join(root, "logic.exe")
};
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8` });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function runLogic() {
  return new Promise((resolve, reject) => {
    execFile(paths.exe, { cwd: root, timeout: 5000 }, (error) => {
      error ? reject(error.killed ? new Error("logic.exe timed out.") : error) : resolve();
    });
  });
}

async function reduce(req, res) {
  try {
    const { input } = JSON.parse(await readBody(req) || "{}");
    if (typeof input !== "string" || !input.trim()) return send(res, 400, "Missing DFA input.");

    await fs.writeFile(paths.input, `${input.trimEnd()}\n`, "utf8");
    await runLogic();
    send(res, 200, JSON.stringify({ output: await fs.readFile(paths.output, "utf8") }), "application/json");
  } catch (error) {
    send(res, 500, error.message || "Unable to run logic.exe.");
  }
}

async function serve(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = path.normalize(path.join(root, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(root)) return send(res, 403, "Forbidden");

  try {
    send(res, 200, await fs.readFile(file), types[path.extname(file)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found");
  }
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/reduce") return reduce(req, res);
  if (req.method === "GET") return serve(req, res);
  send(res, 405, "Method not allowed");
}).listen(port, () => {
  console.log(`Reduce DFA board: http://localhost:${port}`);
});
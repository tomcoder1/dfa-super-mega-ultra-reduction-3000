const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");

const scriptsDir = __dirname;
const rootDir = path.resolve(scriptsDir, "..");
const publicDir = rootDir;
const inputPath = path.join(rootDir, "data", "input.txt");
const outputPath = path.join(rootDir, "data", "output.txt");
const executablePath = path.join(rootDir, "logic.exe");
const port = Number(process.env.PORT) || 3000;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
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
    execFile(executablePath, { cwd: rootDir, timeout: 5000 }, (error) => {
      if (error && error.killed) {
        reject(new Error("logic.exe timed out."));
        return;
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function handleReduce(req, res) {
  try {
    const rawBody = await readBody(req);
    const body = JSON.parse(rawBody || "{}");

    if (typeof body.input !== "string" || body.input.trim().length === 0) {
      send(res, 400, "Missing DFA input.");
      return;
    }

    await fs.writeFile(inputPath, body.input.trimEnd() + "\n", "utf8");
    await runLogic();

    const output = await fs.readFile(outputPath, "utf8");
    send(res, 200, JSON.stringify({ output }), "application/json; charset=utf-8");
  } catch (error) {
    send(res, 500, error.message || "Unable to run logic.exe.");
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
    send(res, 200, data, contentType);
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/reduce") {
    handleReduce(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  send(res, 405, "Method not allowed");
});

server.listen(port, () => {
  console.log(`Reduce DFA board: http://localhost:${port}`);
});

const canvas = document.getElementById("graphCanvas");
const ctx = canvas.getContext("2d");

const nodeCountInput = document.getElementById("nodeCount");
const edgesInput = document.getElementById("edgesInput");
const finalNodesInput = document.getElementById("finalNodesInput");
const renderBtn = document.getElementById("renderBtn");

const NODE_RADIUS = 22;
const FINAL_INNER_RADIUS = 16;

let graph = {
  nodeCount: 0,
  edges: [],
  finalNodes: new Set(),
  positions: []
};

let dragNode = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height
  };
}

function buildInitialPositions(nodeCount) {
  const { width, height } = getCanvasSize();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;

  if (nodeCount <= 0) return [];
  if (nodeCount === 1) return [{ x: cx, y: cy }];

  const positions = [];
  for (let i = 0; i < nodeCount; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / nodeCount;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }
  return positions;
}

function parseEdges(text, nodeCount) {
  const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
  const edges = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const from = Number(parts[0]);
    const to = Number(parts[1]);
    const label = parts.slice(2).join(" ");

    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    if (from < 0 || from >= nodeCount || to < 0 || to >= nodeCount) continue;

    edges.push({ from, to, label });
  }

  return edges;
}

function parseFinalNodes(text, nodeCount) {
  const tokens = text.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  const result = new Set();

  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isInteger(value)) continue;
    if (value < 0 || value >= nodeCount) continue;
    result.add(value);
  }

  return result;
}

function loadGraph(resetPositions = false) {
  const nodeCount = Math.max(1, Number(nodeCountInput.value) || 1);
  const edges = parseEdges(edgesInput.value, nodeCount);
  const finalNodes = parseFinalNodes(finalNodesInput.value, nodeCount);

  let positions = graph.positions;

  if (resetPositions || positions.length !== nodeCount) {
    positions = buildInitialPositions(nodeCount);
  }

  graph = {
    nodeCount,
    edges,
    finalNodes,
    positions
  };

  draw();
}

function drawArrowHead(fromX, fromY, toX, toY) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const arrowLength = 12;
  const arrowWidth = 6;

  const tipX = toX;
  const tipY = toY;

  const leftX = tipX - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle);
  const leftY = tipY - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle);

  const rightX = tipX - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle);
  const rightY = tipY - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fillStyle = "#000";
  ctx.fill();
}

function draw() {
  resizeCanvasToDisplaySize();

  const { width, height } = getCanvasSize();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = 2;
  ctx.font = "18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const edge of graph.edges) {
    const a = graph.positions[edge.from];
    const b = graph.positions[edge.to];
    if (!a || !b) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;

    const ux = dx / len;
    const uy = dy / len;

    const startX = a.x + ux * NODE_RADIUS;
    const startY = a.y + uy * NODE_RADIUS;

    const endX = b.x - ux * NODE_RADIUS;
    const endY = b.y - uy * NODE_RADIUS;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    drawArrowHead(startX, startY, endX, endY);

    if (edge.label) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const nx = -uy;
      const ny = ux;
      const lx = midX + nx * 12;
      const ly = midY + ny * 12;

      ctx.fillStyle = "#fff";
      const padX = 6;
      const padY = 4;
      const metrics = ctx.measureText(edge.label);
      const textWidth = metrics.width;
      const textHeight = 18;

      ctx.fillRect(
        lx - textWidth / 2 - padX,
        ly - textHeight / 2 - padY,
        textWidth + padX * 2,
        textHeight + padY * 2
      );

      ctx.fillStyle = "#000";
      ctx.fillText(edge.label, lx, ly);
    }
  }

  for (let i = 0; i < graph.nodeCount; i++) {
    const p = graph.positions[i];
    if (!p) continue;

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (graph.finalNodes.has(i)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, FINAL_INNER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#000";
    ctx.fillText(String(i), p.x, p.y);
  }
}

function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function findNodeAt(x, y) {
  for (let i = graph.positions.length - 1; i >= 0; i--) {
    const p = graph.positions[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.hypot(dx, dy) <= NODE_RADIUS) return i;
  }
  return null;
}

canvas.addEventListener("mousedown", (event) => {
  const pos = getMousePos(event);
  dragNode = findNodeAt(pos.x, pos.y);
});

window.addEventListener("mousemove", (event) => {
  if (dragNode === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, NODE_RADIUS, rect.width - NODE_RADIUS);
  const y = clamp(event.clientY - rect.top, NODE_RADIUS, rect.height - NODE_RADIUS);

  graph.positions[dragNode] = { x, y };
  draw();
});

window.addEventListener("mouseup", () => {
  dragNode = null;
});

renderBtn.addEventListener("click", () => loadGraph(false));
nodeCountInput.addEventListener("change", () => loadGraph(true));
edgesInput.addEventListener("input", () => loadGraph(false));
finalNodesInput.addEventListener("input", () => loadGraph(false));
window.addEventListener("resize", draw);

loadGraph(true);
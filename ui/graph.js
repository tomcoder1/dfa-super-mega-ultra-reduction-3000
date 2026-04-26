const DFAGraph = (() => {
  const NODE_RADIUS = 22;
  const FINAL_INNER_RADIUS = 16;
  const GRAPH_COLOR = "#000";
  const EDGE_LABEL_COLOR = "#c1121f";
  const PHYSICS = {
    damping: 0.86,
    spring: 0.004,
    repulsion: 12000,
    centerPull: 0.0008,
    boundaryDistance: 56,
    boundaryPush: 0.035,
    maxSpeed: 12
  };

  const qLabel = (index) => `q${index}`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function create(canvas) {
    const state = {
      positions: [],
      velocities: [],
      dragIndex: null,
      activeDFA: null,
      labelForState: qLabel,
      frame: null
    };

    function size() {
      const rect = canvas.getBoundingClientRect();
      return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    }

    function prepare() {
      const ctx = canvas.getContext("2d");
      const { width, height } = size();
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      return { ctx, width, height };
    }

    function reset() {
      state.positions = [];
      state.velocities = [];
      state.dragIndex = null;
      state.activeDFA = null;
      state.labelForState = qLabel;
      if (state.frame !== null) {
        cancelAnimationFrame(state.frame);
        state.frame = null;
      }
      drawEmpty("-");
    }

    function drawEmpty(label) {
      const { ctx, width, height } = prepare();
      ctx.fillStyle = "#777";
      ctx.font = "600 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, width / 2, height / 2);
    }

    function layout(count, width, height) {
      if (count <= 0) return [];
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(70, Math.min(width, height) * 0.32);

      if (count === 1) return [{ x: cx, y: cy }];

      return Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
        return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });
    }

    function ensureVelocities(count) {
      if (state.velocities.length !== count) {
        state.velocities = Array.from({ length: count }, () => ({ x: 0, y: 0 }));
      }
    }

    function groupEdges(transitions, alphabet) {
      const grouped = new Map();
      transitions.forEach((row, from) => {
        row.forEach((to, symbolIndex) => {
          const key = `${from}-${to}`;
          if (!grouped.has(key)) grouped.set(key, { from, to, labels: [] });
          grouped.get(key).labels.push(alphabet[symbolIndex]);
        });
      });
      return [...grouped.values()];
    }

    function hasReverseEdge(edges, edge) {
      return edges.some((candidate) => (
        candidate.from === edge.to &&
        candidate.to === edge.from &&
        candidate.from !== candidate.to
      ));
    }

    function springPairs(transitions) {
      const keys = new Set();
      transitions.forEach((row, from) => {
        row.forEach((to) => {
          if (from === to) return;
          keys.add(`${Math.min(from, to)}-${Math.max(from, to)}`);
        });
      });
      return [...keys].map((key) => key.split("-").map(Number));
    }

    function clampMagnitude(vector, max) {
      const magnitude = Math.hypot(vector.x, vector.y);
      if (magnitude <= max || magnitude === 0) return vector;
      return { x: (vector.x / magnitude) * max, y: (vector.y / magnitude) * max };
    }

    function advancePhysics() {
      if (!state.activeDFA || state.positions.length === 0) return false;

      const { width, height } = size();
      const { activeDFA: dfa, positions, velocities } = state;
      ensureVelocities(dfa.stateCount);

      const desiredEdgeLength = Math.max(95, Math.min(170, Math.min(width, height) * 0.28));
      const accelerations = Array.from({ length: dfa.stateCount }, () => ({ x: 0, y: 0 }));

      for (let i = 0; i < dfa.stateCount; i++) {
        for (let j = i + 1; j < dfa.stateCount; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const distance = Math.max(18, Math.hypot(dx, dy));
          const force = PHYSICS.repulsion / (distance * distance);
          const ux = dx / distance;
          const uy = dy / distance;

          accelerations[i].x -= ux * force;
          accelerations[i].y -= uy * force;
          accelerations[j].x += ux * force;
          accelerations[j].y += uy * force;
        }
      }

      for (const [from, to] of springPairs(dfa.transitions)) {
        const dx = positions[to].x - positions[from].x;
        const dy = positions[to].y - positions[from].y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (distance - desiredEdgeLength) * PHYSICS.spring;
        const ux = dx / distance;
        const uy = dy / distance;

        accelerations[from].x += ux * force;
        accelerations[from].y += uy * force;
        accelerations[to].x -= ux * force;
        accelerations[to].y -= uy * force;
      }

      for (let i = 0; i < dfa.stateCount; i++) {
        if (state.dragIndex === i) {
          velocities[i] = { x: 0, y: 0 };
          continue;
        }

        const position = positions[i];
        accelerations[i].x += (width / 2 - position.x) * PHYSICS.centerPull;
        accelerations[i].y += (height / 2 - position.y) * PHYSICS.centerPull;

        if (position.x < PHYSICS.boundaryDistance) {
          accelerations[i].x += (PHYSICS.boundaryDistance - position.x) * PHYSICS.boundaryPush;
        } else if (width - position.x < PHYSICS.boundaryDistance) {
          accelerations[i].x -= (PHYSICS.boundaryDistance - (width - position.x)) * PHYSICS.boundaryPush;
        }

        if (position.y < PHYSICS.boundaryDistance) {
          accelerations[i].y += (PHYSICS.boundaryDistance - position.y) * PHYSICS.boundaryPush;
        } else if (height - position.y < PHYSICS.boundaryDistance) {
          accelerations[i].y -= (PHYSICS.boundaryDistance - (height - position.y)) * PHYSICS.boundaryPush;
        }

        const velocity = clampMagnitude({
          x: (velocities[i].x + accelerations[i].x) * PHYSICS.damping,
          y: (velocities[i].y + accelerations[i].y) * PHYSICS.damping
        }, PHYSICS.maxSpeed);

        velocities[i] = velocity;
        positions[i] = {
          x: clamp(position.x + velocity.x, NODE_RADIUS, width - NODE_RADIUS),
          y: clamp(position.y + velocity.y, NODE_RADIUS, height - NODE_RADIUS)
        };
      }

      return true;
    }

    function startPhysics() {
      if (state.frame !== null) return;

      const step = () => {
        state.frame = null;
        if (advancePhysics()) {
          draw(state.activeDFA, state.labelForState);
          state.frame = requestAnimationFrame(step);
        }
      };

      state.frame = requestAnimationFrame(step);
    }

    function arrowHead(ctx, x, y, angle) {
      ctx.fillStyle = GRAPH_COLOR;
      ctx.strokeStyle = GRAPH_COLOR;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 13 * Math.cos(angle) + 7 * Math.sin(angle), y - 13 * Math.sin(angle) - 7 * Math.cos(angle));
      ctx.lineTo(x - 13 * Math.cos(angle) - 7 * Math.sin(angle), y - 13 * Math.sin(angle) + 7 * Math.cos(angle));
      ctx.closePath();
      ctx.fill();
    }

    function edgeLabel(ctx, text, x, y) {
      ctx.font = "700 14px Cascadia Mono, Consolas, monospace";
      ctx.fillStyle = EDGE_LABEL_COLOR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    }

    function circlePoint(center, angle, radius = NODE_RADIUS) {
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    }

    function cubicEdge(ctx, start, end, curvature, label) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const curveSize = curvature * length;
      const c1 = { x: start.x + dx / 3 + nx * curveSize, y: start.y + dy / 3 + ny * curveSize };
      const c2 = { x: start.x + (2 * dx) / 3 + nx * curveSize, y: start.y + (2 * dy) / 3 + ny * curveSize };

      ctx.strokeStyle = GRAPH_COLOR;
      ctx.fillStyle = GRAPH_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
      ctx.stroke();

      arrowHead(ctx, end.x, end.y, Math.atan2(end.y - c2.y, end.x - c2.x));
      const labelOffset = curveSize * 0.75 + (curvature >= 0 ? 14 : -14);
      edgeLabel(ctx, label, (start.x + end.x) / 2 + nx * labelOffset, (start.y + end.y) / 2 + ny * labelOffset);
    }

    function selfLoop(ctx, center, label) {
      const start = circlePoint(center, -2.35);
      const end = circlePoint(center, -0.78);
      const c1 = { x: center.x - NODE_RADIUS * 3.2, y: center.y - NODE_RADIUS * 4.2 };
      const c2 = { x: center.x + NODE_RADIUS * 3.2, y: center.y - NODE_RADIUS * 4.2 };

      ctx.strokeStyle = GRAPH_COLOR;
      ctx.fillStyle = GRAPH_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
      ctx.stroke();

      arrowHead(ctx, end.x, end.y, Math.atan2(end.y - c2.y, end.x - c2.x));
      edgeLabel(ctx, label, center.x, center.y - NODE_RADIUS * 4.25);
    }

    function startArrow(ctx, position) {
      const startX = position.x - NODE_RADIUS * 2.35;
      const endX = position.x - NODE_RADIUS;
      ctx.strokeStyle = GRAPH_COLOR;
      ctx.fillStyle = GRAPH_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, position.y);
      ctx.lineTo(endX, position.y);
      ctx.stroke();
      arrowHead(ctx, endX, position.y, 0);
    }

    function draw(dfa, labelForState = qLabel, resetPositions = false) {
      const { ctx, width, height } = prepare();

      if (resetPositions || state.positions.length !== dfa.stateCount) {
        state.positions = layout(dfa.stateCount, width, height);
        state.velocities = Array.from({ length: dfa.stateCount }, () => ({ x: 0, y: 0 }));
      } else {
        state.positions = state.positions.map((position) => ({
          x: clamp(position.x, NODE_RADIUS, width - NODE_RADIUS),
          y: clamp(position.y, NODE_RADIUS, height - NODE_RADIUS)
        }));
      }

      state.activeDFA = dfa;
      state.labelForState = labelForState;
      ensureVelocities(dfa.stateCount);

      const edges = groupEdges(dfa.transitions, dfa.alphabet);
      ctx.strokeStyle = GRAPH_COLOR;
      ctx.fillStyle = GRAPH_COLOR;
      ctx.lineWidth = 2;

      for (const edge of edges) {
        const from = state.positions[edge.from];
        const to = state.positions[edge.to];
        const label = edge.labels.join(",");
        if (!from || !to) continue;

        if (edge.from === edge.to) {
          selfLoop(ctx, from, label);
          continue;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const start = { x: from.x + ux * NODE_RADIUS, y: from.y + uy * NODE_RADIUS };
        const end = { x: to.x - ux * NODE_RADIUS, y: to.y - uy * NODE_RADIUS };
        cubicEdge(ctx, start, end, hasReverseEdge(edges, edge) ? 0.34 : 0.08, label);
      }

      if (state.positions[0]) startArrow(ctx, state.positions[0]);

      state.positions.forEach((position, index) => {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = GRAPH_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(position.x, position.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (dfa.finalStates.includes(index)) {
          ctx.beginPath();
          ctx.arc(position.x, position.y, FINAL_INNER_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = GRAPH_COLOR;
        ctx.font = "700 15px Cascadia Mono, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelForState(index), position.x, position.y);
      });
    }

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function nodeAt(x, y) {
      for (let index = state.positions.length - 1; index >= 0; index--) {
        const position = state.positions[index];
        if (Math.hypot(position.x - x, position.y - y) <= NODE_RADIUS) return index;
      }
      return null;
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (!state.activeDFA) return;
      const position = pointerPosition(event);
      const nodeIndex = nodeAt(position.x, position.y);
      if (nodeIndex === null) return;
      state.dragIndex = nodeIndex;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (state.dragIndex === null || !state.activeDFA) return;
      const rect = canvas.getBoundingClientRect();
      const position = pointerPosition(event);
      state.positions[state.dragIndex] = {
        x: clamp(position.x, NODE_RADIUS, rect.width - NODE_RADIUS),
        y: clamp(position.y, NODE_RADIUS, rect.height - NODE_RADIUS)
      };
      state.velocities[state.dragIndex] = { x: 0, y: 0 };
      draw(state.activeDFA, state.labelForState);
    });

    canvas.addEventListener("pointerup", (event) => {
      state.dragIndex = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      startPhysics();
    });

    canvas.addEventListener("pointercancel", () => {
      state.dragIndex = null;
    });

    return { draw, reset, startPhysics };
  }

  return { create, qLabel };
})();

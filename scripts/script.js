const $ = (id) => document.getElementById(id);
const ids = [
  "dfaForm", "submitBtn", "stateCount", "alphabet", "transitionTable", "finalStates",
  "inaccessibleStates", "newStateCount", "groupsList", "distinguishabilityBoard", "newFinalStates"
];
const [
  form, submitBtn, stateCountInput, alphabetInput, transitionInput, finalStatesInput,
  inaccessibleEl, newStateCountEl, groupsListEl, distinguishabilityBoardEl, newFinalStatesEl
] = ids.map($);

const originalGraph = DFAGraph.create($("originalCanvas"));
const reducedGraph = DFAGraph.create($("reducedCanvas"));
let lastOriginalDFA = null;
let lastReducedDFA = null;

const tokens = (text) => text.trim().split(/\s+/).filter(Boolean);
const numbers = (text) => text.trim() ? tokens(text).map(Number) : [];
const assert = (condition) => { if (!condition) throw new Error(); };

function parseInputDFA() {
  const stateCount = Number(stateCountInput.value);
  const alphabet = tokens(alphabetInput.value);
  const finalStates = [...new Set(numbers(finalStatesInput.value))];
  const transitions = transitionInput.value.split(/\r?\n/)
    .map((line) => line.trim()).filter(Boolean)
    .map((line) => numbers(line));

  assert(Number.isInteger(stateCount) && stateCount > 0);
  assert(alphabet.length && alphabet.every((symbol) => symbol.length === 1) && new Set(alphabet).size === alphabet.length);
  assert(transitions.length === stateCount);
  assert(finalStates.every((state) => Number.isInteger(state) && state >= 0 && state < stateCount));
  transitions.forEach((row) => {
    assert(row.length === alphabet.length);
    assert(row.every((state) => Number.isInteger(state) && state >= 0 && state < stateCount));
  });
  return { stateCount, alphabet, transitions, finalStates };
}

function parseBoard(lines, stateCount) {
  const expectedRows = Math.max(0, stateCount - 1);
  if (lines.length < expectedRows) return [];

  const board = Array.from({ length: expectedRows }, (_, i) => {
    const row = numbers(lines[i] || "");
    return row.length === stateCount - i - 1 && row.every(Number.isInteger) ? row : null;
  });
  return board.every(Boolean) ? board : [];
}

function parseOutput(text, alphabet, originalStateCount) {
  if (text.trim() === "Invalid input") return { valid: false };

  const lines = text.split(/\r?\n/).map((line) => line.trim());
  while (lines[lines.length - 1] === "") lines.pop();
  const newStateCount = Number(lines[1]);
  const transitionStart = 2 + newStateCount;
  if (lines.length < 2 || !Number.isInteger(newStateCount) || newStateCount < 0) return { valid: false };

  const transitions = Array.from({ length: newStateCount }, (_, i) => numbers(lines[transitionStart + i] || ""));
  if (transitions.some((row) => row.length !== alphabet.length)) return { valid: false };

  return {
    valid: true,
    inaccessibleStates: lines[0] === "-1" ? [] : numbers(lines[0]),
    newStateCount,
    groups: Array.from({ length: newStateCount }, (_, i) => numbers(lines[2 + i] || "")),
    transitions,
    finalStates: numbers(lines[transitionStart + newStateCount] || ""),
    distinguishabilityBoard: parseBoard(lines.slice(transitionStart + newStateCount + 1), originalStateCount)
  };
}

function resetOutput() {
  lastOriginalDFA = lastReducedDFA = null;
  [inaccessibleEl, newStateCountEl, groupsListEl, distinguishabilityBoardEl, newFinalStatesEl].forEach((el) => {
    el.textContent = "-";
    el.classList.add("empty");
  });
  originalGraph.reset();
  reducedGraph.reset();
}

const stateHtml = (state) => `<span class="math-state">q<sub>${state}</sub></span>`;
const setHtml = (states) => states.length
  ? `<span class="math-set">{ ${states.map(stateHtml).join(", ")} }</span>`
  : `<span class="math-symbol">&empty;</span>`;

function fill(el, html) {
  el.innerHTML = html;
  el.classList.remove("empty");
}

function renderOutput(result) {
  fill(inaccessibleEl, result.inaccessibleStates.length ? setHtml(result.inaccessibleStates) : "0");
  fill(newStateCountEl, result.newStateCount);
  fill(groupsListEl, result.groups.map((group, i) => `<div>${stateHtml(i)} = ${setHtml(group)}</div>`).join(""));
  fill(newFinalStatesEl, `<span class="math-state">F</span> = ${setHtml(result.finalStates)}`);

  if (!result.distinguishabilityBoard.length) {
    distinguishabilityBoardEl.textContent = "-";
    distinguishabilityBoardEl.classList.add("empty");
    return;
  }

  fill(distinguishabilityBoardEl, result.distinguishabilityBoard.map((row, i) => `
    <div class="distinguishability-row">
      ${row.map((value, j) => `
        <div class="distinguishability-cell">
          <span class="distinguishability-pair">(${stateHtml(i)}, ${stateHtml(i + j + 1)})</span>
          <span class="distinguishability-value">${value}</span>
        </div>
      `).join("")}
    </div>
  `).join(""));
}

async function reduceDFA(dfa) {
  if (location.protocol === "file:") throw new Error("Open http://localhost:3000/ instead of opening index.html directly.");
  const input = [dfa.stateCount, dfa.alphabet.join(" "), ...dfa.transitions.map((row) => row.join(" ")), dfa.finalStates.join(" ")].join("\n");
  const response = await fetch("/api/reduce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input })
  });
  if (!response.ok) throw new Error(await response.text() || "Could not run logic.exe.");
  return response.json();
}

function invalidInput() {
  [stateCountInput, alphabetInput, transitionInput, finalStatesInput].forEach((input) => { input.value = ""; });
  resetOutput();
  alert("Input is invalid!");
}

function renderGraphs(inputDFA, output) {
  lastOriginalDFA = inputDFA;
  lastReducedDFA = { stateCount: output.newStateCount, alphabet: inputDFA.alphabet, transitions: output.transitions, finalStates: output.finalStates };
  originalGraph.draw(lastOriginalDFA, DFAGraph.qLabel);
  reducedGraph.draw(lastReducedDFA, DFAGraph.qLabel);
  originalGraph.startPhysics();
  reducedGraph.startPhysics();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Running...";

  try {
    const inputDFA = parseInputDFA();
    const output = parseOutput((await reduceDFA(inputDFA)).output, inputDFA.alphabet, inputDFA.stateCount);
    if (!output.valid) return invalidInput();
    renderOutput(output);
    renderGraphs(inputDFA, output);
  } catch (error) {
    error.message ? alert(error.message) : invalidInput();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});

addEventListener("resize", () => {
  if (lastOriginalDFA) originalGraph.draw(lastOriginalDFA, DFAGraph.qLabel);
  if (lastReducedDFA) reducedGraph.draw(lastReducedDFA, DFAGraph.qLabel);
  originalGraph.startPhysics();
  reducedGraph.startPhysics();
});

resetOutput();

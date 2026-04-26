const $ = (id) => document.getElementById(id);

const form = $("dfaForm");
const submitBtn = $("submitBtn");
const stateCountInput = $("stateCount");
const alphabetInput = $("alphabet");
const transitionInput = $("transitionTable");
const finalStatesInput = $("finalStates");

const inaccessibleEl = $("inaccessibleStates");
const newStateCountEl = $("newStateCount");
const groupsListEl = $("groupsList");
const newFinalStatesEl = $("newFinalStates");

const originalGraph = DFAGraph.create($("originalCanvas"));
const reducedGraph = DFAGraph.create($("reducedCanvas"));
const qLabel = DFAGraph.qLabel;

let lastOriginalDFA = null;
let lastReducedDFA = null;

function tokens(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function parseNumberList(text) {
  if (!text.trim()) return [];
  const values = tokens(text).map(Number);
  if (values.some((value) => !Number.isInteger(value))) throw new Error();
  return values;
}

function parseInputDFA() {
  const stateCount = Number(stateCountInput.value);
  const alphabet = tokens(alphabetInput.value);
  const finalStates = parseNumberList(finalStatesInput.value);
  const transitions = transitionInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => tokens(line).map(Number));

  if (!Number.isInteger(stateCount) || stateCount <= 0) throw new Error();
  if (alphabet.length === 0 || new Set(alphabet).size !== alphabet.length) throw new Error();
  if (transitions.length !== stateCount) throw new Error();

  for (const row of transitions) {
    if (row.length !== alphabet.length) throw new Error();
    if (row.some((state) => !Number.isInteger(state) || state < 0 || state >= stateCount)) {
      throw new Error();
    }
  }

  if (finalStates.some((state) => state < 0 || state >= stateCount)) throw new Error();
  return { stateCount, alphabet, transitions, finalStates: [...new Set(finalStates)] };
}

function buildInputText(dfa) {
  return [
    dfa.stateCount,
    dfa.alphabet.join(" "),
    ...dfa.transitions.map((row) => row.join(" ")),
    dfa.finalStates.join(" ")
  ].join("\n");
}

function parseOutput(text, alphabet) {
  if (text.trim() === "Invalid input") return { valid: false };

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const newStateCount = Number(lines[1]);
  if (lines.length < 2 || !Number.isInteger(newStateCount) || newStateCount < 0) return { valid: false };

  const groups = [];
  const transitions = [];
  const transitionStart = 2 + newStateCount;

  for (let i = 0; i < newStateCount; i++) groups.push(tokens(lines[2 + i] || "").map(Number));
  for (let i = 0; i < newStateCount; i++) {
    const row = tokens(lines[transitionStart + i] || "").map(Number);
    if (row.length !== alphabet.length) return { valid: false };
    transitions.push(row);
  }

  return {
    valid: true,
    inaccessibleStates: lines[0] === "-1" ? [] : tokens(lines[0]).map(Number),
    newStateCount,
    groups,
    transitions,
    finalStates: tokens(lines[transitionStart + newStateCount] || "").map(Number)
  };
}

function clearInputs() {
  stateCountInput.value = "";
  alphabetInput.value = "";
  transitionInput.value = "";
  finalStatesInput.value = "";
}

function resetOutput() {
  lastOriginalDFA = null;
  lastReducedDFA = null;
  inaccessibleEl.textContent = "-";
  inaccessibleEl.classList.add("empty");
  newStateCountEl.textContent = "-";
  groupsListEl.textContent = "-";
  groupsListEl.classList.add("empty");
  newFinalStatesEl.textContent = "-";
  newFinalStatesEl.classList.add("empty");
  originalGraph.reset();
  reducedGraph.reset();
}

function formatState(state) {
  return `<span class="math-state">q<sub>${state}</sub></span>`;
}

function formatStateSet(states) {
  return states.length
    ? `<span class="math-set">{ ${states.map(formatState).join(", ")} }</span>`
    : `<span class="math-symbol">&empty;</span>`;
}

function renderOutput(result) {
  inaccessibleEl.innerHTML = result.inaccessibleStates.length ? formatStateSet(result.inaccessibleStates) : "0";
  inaccessibleEl.classList.remove("empty");
  newStateCountEl.textContent = result.newStateCount;
  groupsListEl.innerHTML = result.groups
    .map((group, index) => `<div>${formatState(index)} = ${formatStateSet(group)}</div>`)
    .join("");
  groupsListEl.classList.remove("empty");
  newFinalStatesEl.innerHTML = `<span class="math-state">F</span> = ${formatStateSet(result.finalStates)}`;
  newFinalStatesEl.classList.remove("empty");
}

async function reduceDFA(dfa) {
  if (window.location.protocol === "file:") {
    throw new Error("Open http://localhost:3000/ instead of opening ui/index.html directly.");
  }

  const response = await fetch("/api/reduce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: buildInputText(dfa) })
  });

  if (!response.ok) throw new Error(await response.text() || "Could not run logic.exe.");
  return response.json();
}

function renderGraphs(inputDFA, output) {
  lastOriginalDFA = inputDFA;
  lastReducedDFA = {
    stateCount: output.newStateCount,
    alphabet: inputDFA.alphabet,
    transitions: output.transitions,
    finalStates: output.finalStates
  };

  originalGraph.draw(lastOriginalDFA, qLabel, true);
  reducedGraph.draw(lastReducedDFA, qLabel, true);
  originalGraph.startPhysics();
  reducedGraph.startPhysics();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Running...";

  try {
    let inputDFA;
    try {
      inputDFA = parseInputDFA();
    } catch {
      clearInputs();
      resetOutput();
      alert("Input is invalid!");
      return;
    }

    const output = parseOutput((await reduceDFA(inputDFA)).output, inputDFA.alphabet);
    if (!output.valid) {
      clearInputs();
      resetOutput();
      alert("Input is invalid!");
      return;
    }

    renderOutput(output);
    renderGraphs(inputDFA, output);
  } catch (error) {
    alert(error.message || "Could not run logic.exe.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});

window.addEventListener("resize", () => {
  if (lastOriginalDFA) originalGraph.draw(lastOriginalDFA, qLabel);
  if (lastReducedDFA) reducedGraph.draw(lastReducedDFA, qLabel);
  originalGraph.startPhysics();
  reducedGraph.startPhysics();
});

resetOutput();

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace std;

struct DFA {
    int stateCount = 0;
    int symbolCount = 0;
    int startState = 0;
    vector<string> alphabet;
    vector<vector<int>> transition;
    vector<bool> isFinal;
};

struct MinimizationResult {
    vector<vector<bool>> marked;
    vector<vector<int>> equivalenceClasses;
    vector<int> classOfState;
};

string formatState(int state) {
    return "q" + to_string(state);
}

string formatReducedState(int state) {
    return "r" + to_string(state);
}

string formatSet(const vector<int>& states) {
    ostringstream out;
    out << "{";
    for (size_t i = 0; i < states.size(); ++i) {
        if (i > 0) {
            out << ", ";
        }
        out << formatState(states[i]);
    }
    out << "}";
    return out.str();
}

class DisjointSetUnion {
public:
    explicit DisjointSetUnion(int size) : parent(size), rankValue(size, 0) {
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int node) {
        if (parent[node] != node) {
            parent[node] = find(parent[node]);
        }
        return parent[node];
    }

    void unite(int left, int right) {
        left = find(left);
        right = find(right);
        if (left == right) {
            return;
        }
        if (rankValue[left] < rankValue[right]) {
            swap(left, right);
        }
        parent[right] = left;
        if (rankValue[left] == rankValue[right]) {
            ++rankValue[left];
        }
    }

private:
    vector<int> parent;
    vector<int> rankValue;
};

bool readInt(istream& input, int& value, const string& prompt, bool interactive) {
    if (interactive) {
        cout << prompt;
    }
    return static_cast<bool>(input >> value);
}

void validateDFA(const DFA& dfa) {
    if (dfa.stateCount <= 0) {
        throw runtime_error("The number of states must be positive.");
    }
    if (dfa.symbolCount <= 0) {
        throw runtime_error("The number of symbols must be positive.");
    }
    if (static_cast<int>(dfa.alphabet.size()) != dfa.symbolCount) {
        throw runtime_error("The alphabet size does not match the declared number of symbols.");
    }
    if (dfa.startState < 0 || dfa.startState >= dfa.stateCount) {
        throw runtime_error("The start state is out of range.");
    }
    if (static_cast<int>(dfa.transition.size()) != dfa.stateCount) {
        throw runtime_error("The transition table does not contain the expected number of rows.");
    }
    if (static_cast<int>(dfa.isFinal.size()) != dfa.stateCount) {
        throw runtime_error("The final-state list does not match the number of states.");
    }

    set<string> seenSymbols;
    for (const string& symbol : dfa.alphabet) {
        if (!seenSymbols.insert(symbol).second) {
            throw runtime_error("Alphabet symbols must be unique.");
        }
    }

    for (int state = 0; state < dfa.stateCount; ++state) {
        if (static_cast<int>(dfa.transition[state].size()) != dfa.symbolCount) {
            throw runtime_error("Each transition row must contain exactly one destination per symbol.");
        }
        for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
            int destination = dfa.transition[state][symbol];
            if (destination < 0 || destination >= dfa.stateCount) {
                throw runtime_error(
                    "Transition from " + formatState(state) + " leads to an invalid state."
                );
            }
        }
    }
}

DFA readDFA(istream& input, bool interactive) {
    DFA dfa;

    if (interactive) {
        cout << "Input format:\n";
        cout << "1. Number of states n\n";
        cout << "2. Number of symbols m\n";
        cout << "3. m alphabet symbols\n";
        cout << "4. Start state index\n";
        cout << "5. Number of final states f\n";
        cout << "6. f final-state indices\n";
        cout << "7. Transition table with n rows and m integers per row\n\n";
    }

    if (!readInt(input, dfa.stateCount, "Enter the number of states: ", interactive)) {
        throw runtime_error("Unable to read the number of states.");
    }
    if (!readInt(input, dfa.symbolCount, "Enter the number of symbols: ", interactive)) {
        throw runtime_error("Unable to read the number of symbols.");
    }

    dfa.alphabet.resize(dfa.symbolCount);
    if (interactive) {
        cout << "Enter the alphabet symbols: ";
    }
    for (int i = 0; i < dfa.symbolCount; ++i) {
        if (!(input >> dfa.alphabet[i])) {
            throw runtime_error("Unable to read the alphabet.");
        }
    }

    if (!readInt(input, dfa.startState, "Enter the start state: ", interactive)) {
        throw runtime_error("Unable to read the start state.");
    }

    int finalStateCount = 0;
    if (!readInt(input, finalStateCount, "Enter the number of final states: ", interactive)) {
        throw runtime_error("Unable to read the number of final states.");
    }
    if (finalStateCount < 0 || finalStateCount > dfa.stateCount) {
        throw runtime_error("The number of final states is invalid.");
    }

    dfa.isFinal.assign(dfa.stateCount, false);
    if (interactive) {
        cout << "Enter the final states: ";
    }
    for (int i = 0; i < finalStateCount; ++i) {
        int finalState = 0;
        if (!(input >> finalState)) {
            throw runtime_error("Unable to read the final states.");
        }
        if (finalState < 0 || finalState >= dfa.stateCount) {
            throw runtime_error("A final state is out of range.");
        }
        dfa.isFinal[finalState] = true;
    }

    dfa.transition.assign(dfa.stateCount, vector<int>(dfa.symbolCount, 0));
    if (interactive) {
        cout << "Enter the transition table row by row:\n";
    }
    for (int state = 0; state < dfa.stateCount; ++state) {
        for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
            if (!(input >> dfa.transition[state][symbol])) {
                throw runtime_error("Unable to read the transition table.");
            }
        }
    }

    validateDFA(dfa);
    return dfa;
}

vector<int> getFinalStates(const DFA& dfa) {
    vector<int> finalStates;
    for (int state = 0; state < dfa.stateCount; ++state) {
        if (dfa.isFinal[state]) {
            finalStates.push_back(state);
        }
    }
    return finalStates;
}

vector<int> getReachableStates(const DFA& dfa) {
    vector<int> reachable;
    vector<bool> visited(dfa.stateCount, false);
    queue<int> pending;

    visited[dfa.startState] = true;
    pending.push(dfa.startState);

    while (!pending.empty()) {
        int current = pending.front();
        pending.pop();
        reachable.push_back(current);

        for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
            int next = dfa.transition[current][symbol];
            if (!visited[next]) {
                visited[next] = true;
                pending.push(next);
            }
        }
    }

    sort(reachable.begin(), reachable.end());
    return reachable;
}

MinimizationResult markEquivalentStates(const DFA& dfa) {
    vector<vector<bool>> marked(dfa.stateCount, vector<bool>(dfa.stateCount, false));

    for (int left = 0; left < dfa.stateCount; ++left) {
        for (int right = left + 1; right < dfa.stateCount; ++right) {
            if (dfa.isFinal[left] != dfa.isFinal[right]) {
                marked[left][right] = true;
            }
        }
    }

    bool changed = true;
    while (changed) {
        changed = false;
        for (int left = 0; left < dfa.stateCount; ++left) {
            for (int right = left + 1; right < dfa.stateCount; ++right) {
                if (marked[left][right]) {
                    continue;
                }

                for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
                    int nextLeft = dfa.transition[left][symbol];
                    int nextRight = dfa.transition[right][symbol];
                    if (nextLeft == nextRight) {
                        continue;
                    }

                    int low = min(nextLeft, nextRight);
                    int high = max(nextLeft, nextRight);
                    if (marked[low][high]) {
                        marked[left][right] = true;
                        changed = true;
                        break;
                    }
                }
            }
        }
    }

    DisjointSetUnion dsu(dfa.stateCount);
    for (int left = 0; left < dfa.stateCount; ++left) {
        for (int right = left + 1; right < dfa.stateCount; ++right) {
            if (!marked[left][right]) {
                dsu.unite(left, right);
            }
        }
    }

    map<int, vector<int>> classesByRoot;
    vector<int> classOfState(dfa.stateCount, -1);
    for (int state = 0; state < dfa.stateCount; ++state) {
        classesByRoot[dsu.find(state)].push_back(state);
    }

    vector<vector<int>> equivalenceClasses;
    for (auto& entry : classesByRoot) {
        vector<int>& group = entry.second;
        sort(group.begin(), group.end());
        equivalenceClasses.push_back(group);
    }

    sort(equivalenceClasses.begin(), equivalenceClasses.end(), [](const vector<int>& left,
                                                                 const vector<int>& right) {
        return left.front() < right.front();
    });

    for (size_t classIndex = 0; classIndex < equivalenceClasses.size(); ++classIndex) {
        for (int state : equivalenceClasses[classIndex]) {
            classOfState[state] = static_cast<int>(classIndex);
        }
    }

    return {marked, equivalenceClasses, classOfState};
}

DFA reduceDFA(const DFA& dfa, const MinimizationResult& result, vector<vector<int>>& reducedToOriginal) {
    DFA reduced;
    reduced.stateCount = static_cast<int>(result.equivalenceClasses.size());
    reduced.symbolCount = dfa.symbolCount;
    reduced.alphabet = dfa.alphabet;
    reduced.transition.assign(reduced.stateCount, vector<int>(reduced.symbolCount, 0));
    reduced.isFinal.assign(reduced.stateCount, false);

    reducedToOriginal = result.equivalenceClasses;
    reduced.startState = result.classOfState[dfa.startState];

    for (int reducedState = 0; reducedState < reduced.stateCount; ++reducedState) {
        const vector<int>& group = result.equivalenceClasses[reducedState];
        int representative = group.front();
        reduced.isFinal[reducedState] = dfa.isFinal[representative];

        for (int symbol = 0; symbol < reduced.symbolCount; ++symbol) {
            int destination = dfa.transition[representative][symbol];
            reduced.transition[reducedState][symbol] = result.classOfState[destination];
        }
    }

    vector<int> reachable = getReachableStates(reduced);
    if (static_cast<int>(reachable.size()) == reduced.stateCount) {
        return reduced;
    }

    vector<int> newIndex(reduced.stateCount, -1);
    for (size_t index = 0; index < reachable.size(); ++index) {
        newIndex[reachable[index]] = static_cast<int>(index);
    }

    DFA pruned;
    pruned.stateCount = static_cast<int>(reachable.size());
    pruned.symbolCount = reduced.symbolCount;
    pruned.startState = newIndex[reduced.startState];
    pruned.alphabet = reduced.alphabet;
    pruned.transition.assign(pruned.stateCount, vector<int>(pruned.symbolCount, 0));
    pruned.isFinal.assign(pruned.stateCount, false);

    vector<vector<int>> reachableClasses;
    for (int oldState : reachable) {
        int mapped = newIndex[oldState];
        pruned.isFinal[mapped] = reduced.isFinal[oldState];
        reachableClasses.push_back(reducedToOriginal[oldState]);

        for (int symbol = 0; symbol < pruned.symbolCount; ++symbol) {
            pruned.transition[mapped][symbol] = newIndex[reduced.transition[oldState][symbol]];
        }
    }

    reducedToOriginal = reachableClasses;
    return pruned;
}

void printDFA(const DFA& dfa, const string& title, const vector<vector<int>>* stateGroups = nullptr) {
    cout << title << "\n";

    cout << "States: {";
    for (int state = 0; state < dfa.stateCount; ++state) {
        if (state > 0) {
            cout << ", ";
        }
        cout << formatReducedState(state);
    }
    cout << "}\n";

    cout << "Alphabet: {";
    for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
        if (symbol > 0) {
            cout << ", ";
        }
        cout << dfa.alphabet[symbol];
    }
    cout << "}\n";

    cout << "Start state: " << formatReducedState(dfa.startState) << "\n";

    cout << "Final states: {";
    bool first = true;
    for (int state = 0; state < dfa.stateCount; ++state) {
        if (!dfa.isFinal[state]) {
            continue;
        }
        if (!first) {
            cout << ", ";
        }
        cout << formatReducedState(state);
        first = false;
    }
    cout << "}\n";

    if (stateGroups != nullptr) {
        cout << "Reduced-state mapping:\n";
        for (size_t state = 0; state < stateGroups->size(); ++state) {
            cout << "  " << formatReducedState(static_cast<int>(state)) << " = "
                 << formatSet((*stateGroups)[state]) << "\n";
        }
    }

    size_t stateWidth = 8;
    if (stateGroups != nullptr) {
        stateWidth = 10;
    }

    cout << "Transition table:\n";
    cout << left << setw(static_cast<int>(stateWidth)) << "State";
    for (const string& symbol : dfa.alphabet) {
        cout << left << setw(10) << symbol;
    }
    cout << "\n";

    for (int state = 0; state < dfa.stateCount; ++state) {
        cout << left << setw(static_cast<int>(stateWidth)) << formatReducedState(state);
        for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
            cout << left << setw(10) << formatReducedState(dfa.transition[state][symbol]);
        }
        cout << "\n";
    }
    cout << "\n";
}

void printOriginalDFA(const DFA& dfa) {
    cout << "Input DFA\n";
    cout << "States: {";
    for (int state = 0; state < dfa.stateCount; ++state) {
        if (state > 0) {
            cout << ", ";
        }
        cout << formatState(state);
    }
    cout << "}\n";

    cout << "Alphabet: {";
    for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
        if (symbol > 0) {
            cout << ", ";
        }
        cout << dfa.alphabet[symbol];
    }
    cout << "}\n";

    cout << "Start state: " << formatState(dfa.startState) << "\n";

    vector<int> finalStates = getFinalStates(dfa);
    cout << "Final states: " << formatSet(finalStates) << "\n";

    cout << "Transition table:\n";
    cout << left << setw(8) << "State";
    for (const string& symbol : dfa.alphabet) {
        cout << left << setw(10) << symbol;
    }
    cout << "\n";

    for (int state = 0; state < dfa.stateCount; ++state) {
        cout << left << setw(8) << formatState(state);
        for (int symbol = 0; symbol < dfa.symbolCount; ++symbol) {
            cout << left << setw(10) << formatState(dfa.transition[state][symbol]);
        }
        cout << "\n";
    }
    cout << "\n";
}

void printEquivalenceClasses(const MinimizationResult& result) {
    cout << "Equivalence classes from mark()\n";
    for (size_t index = 0; index < result.equivalenceClasses.size(); ++index) {
        cout << "  E" << index << " = " << formatSet(result.equivalenceClasses[index]) << "\n";
    }
    cout << "\n";
}

int main(int argc, char* argv[]) {
    try {
        DFA dfa;

        if (argc > 1) {
            ifstream file(argv[1]);
            if (!file) {
                throw runtime_error("Unable to open input file: " + string(argv[1]));
            }
            dfa = readDFA(file, false);
        } else {
            cout << "Choose input mode:\n";
            cout << "1. Console\n";
            cout << "2. File\n";
            cout << "Selection: ";

            int mode = 0;
            if (!(cin >> mode)) {
                throw runtime_error("Unable to read the input mode.");
            }

            if (mode == 1) {
                dfa = readDFA(cin, true);
            } else if (mode == 2) {
                cout << "Enter the file path: ";
                cin >> ws;
                string path;
                getline(cin, path);

                ifstream file(path);
                if (!file) {
                    throw runtime_error("Unable to open input file: " + path);
                }
                dfa = readDFA(file, false);
            } else {
                throw runtime_error("Please choose 1 for console input or 2 for file input.");
            }
        }

        printOriginalDFA(dfa);

        MinimizationResult result = markEquivalentStates(dfa);
        printEquivalenceClasses(result);

        vector<vector<int>> reducedToOriginal;
        DFA reduced = reduceDFA(dfa, result, reducedToOriginal);
        printDFA(reduced, "Reduced DFA from reduce()", &reducedToOriginal);
    } catch (const exception& error) {
        cerr << "Error: " << error.what() << "\n";
        return 1;
    }

    return 0;
}

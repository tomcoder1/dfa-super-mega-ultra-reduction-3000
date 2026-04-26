#include <iostream>
#include <vector>
#include <algorithm>
#include <sstream>
#include <limits>
#include <string>
#include <utility>
#include <cstdio>

using namespace std;

int numberOfStates;
int numberOfSymbols;

void printDFA(int const numberOfStates, 
              vector<char> alphabet, 
              vector<vector<int>> const transitionTable, 
              vector<int> const finalStates);

void returnInvalid();

void checkAccessibility(const vector<vector<int>>& transitionTable, 
                        vector<bool>& isAccessible, 
                        int index);

void addNewStateDFA (vector<bool>& grouped, 
                     const vector<bool>& isAccessible, 
                     const vector<vector<bool>>& distinguishability, 
                     vector<int>& inWhichState, 
                     vector<int>& temp, 
                     int state, 
                     int groupIndex);

int main() {
    if (!freopen("data/input.txt", "r", stdin)) return 1;
    if (!freopen("data/output.txt", "w", stdout)) return 1;
    // Input states
    cin >> numberOfStates;
    if (!cin || numberOfStates <= 0) returnInvalid();

    vector<bool> isFinal(numberOfStates, false);
    vector<bool> isAccessible(numberOfStates, false);
    vector<bool> grouped(numberOfStates, false);
    
    // Input alphabet
    vector<char> alphabet;
    string lineAlphabet;
    char ch;

    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    getline(cin, lineAlphabet);
    istringstream alphabetStream(lineAlphabet);
    while (alphabetStream >> ch) {
        if (find(alphabet.begin(), alphabet.end(), ch) != alphabet.end()) {
            returnInvalid();
        }
        alphabet.push_back(ch);
    }
    numberOfSymbols = alphabet.size();
    if (numberOfSymbols == 0) returnInvalid();

    // Input transition table
    vector<vector<int>> transitionTable(numberOfStates, vector<int>(numberOfSymbols));
    for (int i = 0; i < numberOfStates; i++) {
        for (int j = 0; j < numberOfSymbols; j++) {
            if (!(cin >> transitionTable[i][j])) returnInvalid();

            if (transitionTable[i][j] < 0 || transitionTable[i][j] >= numberOfStates) {
                returnInvalid();
            }
        }
    }
    // Input final states
    vector<int> finalStates;
    string finalLine;
    int x;

    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    getline(cin, finalLine);
    istringstream finalStream(finalLine);
    
    while (finalStream >> x) {
        if (x < 0 || x >= numberOfStates) returnInvalid();
        finalStates.push_back(x);
        isFinal[x] = true;
    }
    if (!finalStream.eof()) returnInvalid();

    // printDFA(numberOfStates, alphabet, transitionTable, finalStates);

    // 1. update accessibility
    checkAccessibility(transitionTable, isAccessible, 0);
    // 2. mark()
    vector<vector<bool>> distinguishability(numberOfStates, vector<bool>(numberOfStates, false));
    int changes = 0;
    bool flag = false;

    // cout << "pass 0..." << "\n";
    for (int i = 0; i < numberOfStates - 1; i++) {
        if (!isAccessible[i]) continue;
        for (int j = i+1; j < numberOfStates; j++) {
            if (!isAccessible[j]) continue;
            if (isFinal[i] != isFinal[j]) {
                distinguishability[i][j] = distinguishability[j][i] = true;
            }
        }
    }
    // cout << "pass >=1..." << "\n";
    while (!flag) {
        for (int i = 0; i < numberOfStates - 1; i++) {
            if (!isAccessible[i]) continue;
            for (int j = i+1; j < numberOfStates; j++) {
                if (distinguishability[i][j]) continue;
                if (!isAccessible[j]) continue;
                for (int k = 0; k < numberOfSymbols; k++) {
                    int temp1 = transitionTable[i][k];
                    int temp2 = transitionTable[j][k];
                    if (distinguishability[temp1][temp2]) {
                        distinguishability[i][j] = distinguishability[j][i] = true;
                        changes++;
                        break;
                    }
                }
                // neu ton tai 1 cap distinguishability[i][j] == true sau pass 0 va distinguishability[temp1][temp2] == true, changes luon cap nhat
                // boi vi sau khi cap nhat distinguishability[i][j] = true, may se cap nhat changes. Chay them 1 vong while nua, ke ca neu nhu la pass cuoi,
                // may van se cap nhat cap i j kia => changes van ++ => stuck
            }
        }
        if (changes == 0) {
            flag = true;
        }
        changes = 0;
    }
    // 3. new states for the new DFA
    vector<vector<int>> newDFAStates;
    vector<int> temp;
    vector<int> inWhichState(numberOfStates, -1);
    int groupIndex = 0;

    bool distinguishable = true;
    for (int i = 0; i < numberOfStates; i++) {
        if (isAccessible[i] && !grouped[i]) {
            for (int j = 0; j < numberOfStates; j++) {
                if (i != j && isAccessible[j] && !grouped[j] && !distinguishability[i][j]) {
                    distinguishable = false;
                    break;
                }
            }
            if (distinguishable) {
                grouped[i] = true;
                temp.push_back(i);
                inWhichState[i] = groupIndex;
                newDFAStates.push_back(temp);
            } else {
                addNewStateDFA(grouped, isAccessible, distinguishability, inWhichState, temp, i, groupIndex);
                sort(temp.begin(), temp.end());
                newDFAStates.push_back(temp);
            }
            temp.clear();
            groupIndex++;
            distinguishable = true;
        }
    }
    int newNumberOfStates = newDFAStates.size();
    // 4. New DFA 
    vector<vector<int>> newTransitionTable(newNumberOfStates, vector<int>(numberOfSymbols));
    vector<int> newFinalStates;
    vector<bool> isNewFinal(newNumberOfStates, false);

    // a. Generate final states
    for (int i = 0; i < newNumberOfStates; i++) {
        int currentState = newDFAStates[i][0];
        if (isFinal[currentState]) {
            isNewFinal[i] = true;
            newFinalStates.push_back(i);
        }
    }

    // b. Generate transition table
    for (int i = 0; i < newNumberOfStates; i++) {
        int a = newDFAStates[i][0];
        for (int j = 0; j < numberOfSymbols; j++) {
            if (isAccessible[a]) {
                if (inWhichState[transitionTable[a][j]] == -1) returnInvalid();
                newTransitionTable[inWhichState[a]][j] = inWhichState[transitionTable[a][j]];
            }
        }
    }

    // 5. Output
    int counter = 0;
    for (int i = 0; i < numberOfStates; i++) {
        if (!isAccessible[i]) {
            counter++;
            cout << i << " ";
        }
    }
    if (counter == 0) cout << -1;
    cout << "\n";
    cout << newNumberOfStates << "\n";
    for (int i = 0; i < newNumberOfStates; i++) {
        int row = newDFAStates[i].size();
        for (int j = 0; j < row; j++) {
            cout << newDFAStates[i][j] << " ";
        }
        cout << "\n";
    }
    for (int i = 0; i < newNumberOfStates; i++) {
        for (int j = 0; j < numberOfSymbols; j++) {
            cout << newTransitionTable[i][j] << " ";
        }
        cout << "\n";
    }
    for (int i = 0; i < newFinalStates.size(); i++) {
        cout << newFinalStates[i] << " ";
    }

    // output description:
    // first line: inaccessible states (cout -1 when no inaccessible)
    // second line: new number of states
    // next {new number of states} lines: groups of old states
    // next {new number of states} lines: new transition table, with symbols same as before
    // final line: final states
    return 0;
}

void printDFA(int const numberOfStates, 
              vector<char> alphabet, 
              vector<vector<int>> const transitionTable, 
              vector<int> const finalStates) {
    cout << "Q = { ";
    for (int i = 0; i < numberOfStates; i++) {
        cout << "q" << i << " ";
    }
    cout << "}" << "\n";
    cout << "sigma = { ";
    for (int i = 0; i < alphabet.size(); i++) {
        cout << alphabet[i] << " ";
    }
    cout << "}" << "\n";
    cout << "Transition table: " << "\n";
    for (int i = 0; i < numberOfStates; i++) {
        for (int j = 0; j < alphabet.size(); j++)
            cout << transitionTable[i][j] << "  ";
        cout << "\n";
    }
    cout << "The final states: ";
    for (auto state : finalStates) {
        cout << state << " ";
    }
    cout << "\n";
}
void returnInvalid() {
    cout << "Invalid input\n";
    exit(0);
}
void checkAccessibility(const vector<vector<int>>& transitionTable, 
                        vector<bool>& isAccessible, 
                        int index) {
    if (index < 0 || index >= numberOfStates) returnInvalid();
    isAccessible[index] = true;
    for (int i = 0; i < numberOfSymbols; i++) {
        int next = transitionTable[index][i];
        if (next < 0 || next >= numberOfStates) returnInvalid();
        if (!isAccessible[next]) {
            checkAccessibility(transitionTable, isAccessible, next);
        }
    }
}
void addNewStateDFA (vector<bool>& grouped, 
                     const vector<bool>& isAccessible, 
                     const vector<vector<bool>>& distinguishability, 
                     vector<int>& inWhichState, 
                     vector<int>& temp, 
                     int state, 
                     int groupIndex) {
    if (grouped[state] || !isAccessible[state]) {
        return;
    }
    grouped[state] = true;
    temp.push_back(state);
    inWhichState[state] = groupIndex;
    for (int i = 0; i < numberOfStates; i++) {
        if (isAccessible[i] && !grouped[i] && !distinguishability[i][state]) {
            addNewStateDFA(grouped, isAccessible, distinguishability, inWhichState, temp, i, groupIndex);
        }
    }
    // DFS
}
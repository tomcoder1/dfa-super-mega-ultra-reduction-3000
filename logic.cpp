#include <iostream>
#include <vector>
#include <stack>
#include <map>
#include <algorithm>
#include <string>
#include <sstream>
#include <limits>
#include <string>
#include <utility>

using namespace std;

int numberOfStates;
int numberOfSymbols;

void printDFA(int const numberOfStates, vector<char> alphabet, vector<vector<int>> const transitionTable, vector<int> const finalStates);

void checkAccessibility(const vector<vector<int>>& transitionTable, vector<bool>& isAccessible, int index);

void addNewStateDFA (vector<bool>& grouped, const vector<bool>& isAccessible, const vector<vector<bool>>& distinguishability, vector<int>& temp, int state);
int main() {
    // Input states
    cin >> numberOfStates;

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
        alphabet.push_back(ch);
    }
    numberOfSymbols = alphabet.size();

    // Input transition table
    vector<vector<int>> transitionTable(numberOfStates, vector<int>(numberOfSymbols));
    for (int i = 0; i < numberOfStates; i++) {
        for (int j = 0; j < numberOfSymbols; j++) {
            cin >> transitionTable[i][j];
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
        finalStates.push_back(x);
        isFinal[x] = true;
    }
    cout << "\n";

    // printDFA(numberOfStates, alphabet, transitionTable, finalStates);

    // 1. update accessibility
    cout << " checking access..." << "\n";
    checkAccessibility(transitionTable, isAccessible, 0);
    // 2. mark()
    vector<vector<bool>> distinguishability(numberOfStates, vector<bool>(numberOfStates, false));
    int changes = 0;
    bool flag = false;

    cout << "pass 0..." << "\n";
    for (int i = 0; i < numberOfStates - 1; i++) {
        if (!isAccessible[i]) continue;
        for (int j = i+1; j < numberOfStates; j++) {
            if (!isAccessible[j]) continue;
            if (isFinal[i] != isFinal[j]) {
                distinguishability[i][j] = distinguishability[j][i] = true;
            }
        }
    }
    cout << "pass >=1..." << "\n";
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
    // Test print
    // -------------------------------------------------------------------------------
    cout << "-------------------------------------------------------------------------------------\n";
    cout << "attributes: final" << "\n";
    for (int i = 0; i < numberOfStates; i++) {
        cout << isFinal[i] << " ";
    }
    cout << "\n";
    cout << "attributes: accessability" << "\n";
    for (int i = 0; i < numberOfStates; i++) {
        cout << isAccessible[i] << " ";
    }
    cout << "\n";
    cout << "distinguishability:" << "\n";
    for (int i = 0; i < numberOfStates; i++) {
        for (int j = 0; j < numberOfStates; j++) {
            cout << distinguishability[i][j] << " ";
        }
        cout << "\n";
    }
    //-------------------------------------------------------------------------------
    // 3. new states for the new DFA
    vector<vector<int>> newDFAStates;
    vector<int> temp;

    bool distinguiable = true;
    for (int i = 0; i < numberOfStates; i++) {
        if (isAccessible[i] && !grouped[i]) {
            for (int j = 0; j < numberOfStates; j++) {
                if (i != j && isAccessible[j] && !grouped[j] && !distinguishability[i][j]) {
                    distinguiable = false;
                    break;
                }
            }
            if (distinguiable) {
                grouped[i] = true;
                temp.push_back(i);
                newDFAStates.push_back(temp);
                temp.clear();
            } else {
                addNewStateDFA(grouped, isAccessible, distinguishability, temp, i);
                sort(temp.begin(), temp.end());
                newDFAStates.push_back(temp);
                temp.clear();
            }
            distinguiable = true;
        }
    }
    // Test print
    cout << "----------------------------------------------------\n";
    cout << "New DFA: " << "\n";
    for (int i = 0; i < newDFAStates.size(); i++) {
        for (int j = 0; j < newDFAStates[i].size(); j++) {
            cout << newDFAStates[i][j] << " ";
        }
        cout << "\n";
    }
    return 0;
}

void printDFA(int const numberOfStates, vector<char> alphabet, vector<vector<int>> const transitionTable, vector<int> const finalStates) {
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
void checkAccessibility(const vector<vector<int>>& transitionTable, vector<bool>& isAccessible, int index) {
    isAccessible[index] = true;
    for (int i = 0; i < numberOfSymbols; i++) {
        int next = transitionTable[index][i];
        if (!isAccessible[next]) {
            checkAccessibility(transitionTable, isAccessible, next);
        }
    }
}
void addNewStateDFA (vector<bool>& grouped, const vector<bool>& isAccessible, const vector<vector<bool>>& distinguishability, vector<int>& temp, int state) {
    if (grouped[state] || !isAccessible[state]) {
        return;
    }
    grouped[state] = true;
    temp.push_back(state);
    for (int i = state + 1; i < numberOfStates; i++) {
        if (isAccessible[i] && !grouped[i] && !distinguishability[i][state]) {
            addNewStateDFA(grouped, isAccessible, distinguishability, temp, i);
        }
    }
    // DFS
}
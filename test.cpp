#include <iostream>
#include <vector>
#include <map>
#include <algorithm>
#include <string>
#include <sstream>
#include <limits>
#include <string>

using namespace std;

string formatState(int state) {
    return "q" + to_string(state);
}

int main() {
    int numberOfStates;
    cout << "Enter the number of states: ";
    cin >> numberOfStates;



    vector<char> alphabet;
    cout << "Enter the letters: ";
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    string lineAlphabet;
    getline(cin, lineAlphabet);
    istringstream alphabetStream(lineAlphabet);
    char ch;
    while (alphabetStream >> ch) {
        alphabet.push_back(ch);
    }
    int numberOfSymbols = alphabet.size();

    cout << "Enter the transition table: " << "\n";
    vector<vector<int>> transitionTable(numberOfStates, vector<int>(numberOfSymbols));
    for (int i = 0; i < numberOfStates; i++)
        for (int j = 0; j < numberOfSymbols; j++) {
            cin >> transitionTable[i][j];
        }

    vector<int> finalStates;
    cout << "Enter final states: ";
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    string finalLine;
    getline(cin, finalLine);
    istringstream finalStream(finalLine);
    int x;
    while (finalStream >> x) {
        finalStates.push_back(x);
    }

    cout << "\n\n";



    cout << "Q = {";
    for (int i = 0; i < numberOfStates; i++) {
        (i != numberOfStates - 1) ? (cout << formatState(i) << ", ") : (cout << formatState(i));
    }
    cout << "}" << "\n";

    cout << "sigma = {";
    for (int i = 0; i < numberOfSymbols; i++) {
        (i != numberOfSymbols - 1) ? (cout << alphabet[i]) << ", " : (cout << alphabet[i]);
    }
    cout << "}" << "\n";

    cout << "Transition table: " << "\n";
    cout << "    ";
    for (int i = 0; i < numberOfSymbols; i++) {
        cout << alphabet[i] << "   ";
    }
    cout << "\n";
    for (int i = 0; i < numberOfStates; i++) {
        cout << formatState(i) << "  ";
        for (int j = 0; j < numberOfSymbols; j++)
            cout << formatState(transitionTable[i][j]) << "  ";
        cout << "\n";
    }

    cout << "The final states: ";
    for (auto state : finalStates) {
        cout << state << " ";
    }
    cout << "\n";
    return 0;
}
// the print transition table only work for state <10.
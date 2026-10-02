# Tic-Tac-Toe Learning Agent

A command-line tic-tac-toe game in Python. Before you play, an AI agent trains for 30,000 games against a player that picks random moves. You play **X** and move first; the agent plays **O**.

## Requirements

- Python 3
- No third-party packages

## Run

From this directory:

```bash
python3 tic_tac_toe.py
```

The program prints the training results, then shows the board. Enter the number of an open square to place your X:

```text
1 | 2 | 3
--+---+--
4 | 5 | 6
--+---+--
7 | 8 | 9
```

The agent responds with its move. Play continues until someone wins or the board is tied. Enter `q` to quit. Invalid or occupied square numbers are rejected so you can try again.

## How the agent learns

The agent uses a small Q-learning table. It stores an estimated value for each board position and available move. During training it sometimes explores a random move; otherwise it chooses a move with the highest estimated value. After the opponent responds, it updates that value using the outcome and the best estimated value of its next turn.

Training rewards are `+1` for a win, `-1` for a loss, and `+0.2` for a tie. The printed win/loss/tie counts describe training games against the random opponent. Training happens again each time the program starts, so the learned table is not saved between runs.

## Code structure

- `new_board()` creates the nine-square board.
- `check_winner()` checks the eight possible winning lines.
- `is_tie()` checks for a full board with no winner.
- `QLearningAgent` selects moves and updates move values.
- `train()` runs practice games against random X moves.
- `main()` runs the interactive game and is called when the file is executed directly.

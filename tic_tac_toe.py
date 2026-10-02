"""A tic-tac-toe game with a small Q-learning agent.

Run with ``python3 tic_tac_toe.py``. The human plays X and moves first.
The agent plays O, learns against a random X player, then plays the human.
"""

import random


EMPTY = " "
HUMAN = "X"
AGENT = "O"
WINNING_LINES = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
)


def new_board():
    """Define an empty 3-by-3 game board."""
    return [EMPTY] * 9


def available_moves(board):
    return [index for index, square in enumerate(board) if square == EMPTY]


def check_winner(board, player):
    """Return whether a player occupies all squares in a winning line."""
    return any(all(board[index] == player for index in line)
               for line in WINNING_LINES)


def is_tie(board):
    """Return whether the board is full without a winner."""
    return (not available_moves(board)
            and not check_winner(board, HUMAN)
            and not check_winner(board, AGENT))


def show_board(board):
    """Display marks and the numbers of still-available squares."""
    cells = [square if square != EMPTY else str(index + 1)
             for index, square in enumerate(board)]
    for row in range(0, 9, 3):
        print(" | ".join(cells[row:row + 3]))
        if row < 6:
            print("--+---+--")
    print()


class QLearningAgent:
    def __init__(self, rng):
        self.rng = rng
        self.q_values = {}
        self.learning_rate = 0.3
        self.discount = 0.9

    def value(self, board, move):
        return self.q_values.get((tuple(board), move), 0.0)

    def choose_move(self, board, exploration=0.0):
        moves = available_moves(board)
        if self.rng.random() < exploration:
            return self.rng.choice(moves)
        best_value = max(self.value(board, move) for move in moves)
        best_moves = [move for move in moves
                      if self.value(board, move) == best_value]
        return self.rng.choice(best_moves)

    def learn(self, board, move, reward, next_board=None):
        """Update the move value after the opponent responds."""
        future = 0.0
        if next_board is not None:
            future = max(self.value(next_board, next_move)
                         for next_move in available_moves(next_board))
        key = (tuple(board), move)
        old_value = self.q_values.get(key, 0.0)
        target = reward + self.discount * future
        self.q_values[key] = old_value + self.learning_rate * (target - old_value)


def train(agent, games=30_000):
    """Let O learn from games against a random X player."""
    results = {"wins": 0, "losses": 0, "ties": 0}
    for game in range(games):
        board = new_board()
        # X always goes first, including during training.
        board[agent.rng.choice(available_moves(board))] = HUMAN
        exploration = max(0.05, 0.5 * (1 - game / games))

        while True:
            state = board.copy()
            move = agent.choose_move(board, exploration)
            board[move] = AGENT

            if check_winner(board, AGENT):
                agent.learn(state, move, 1.0)
                results["wins"] += 1
                break
            if is_tie(board):
                agent.learn(state, move, 0.2)
                results["ties"] += 1
                break

            board[agent.rng.choice(available_moves(board))] = HUMAN
            if check_winner(board, HUMAN):
                agent.learn(state, move, -1.0)
                results["losses"] += 1
                break
            if is_tie(board):
                agent.learn(state, move, 0.2)
                results["ties"] += 1
                break

            agent.learn(state, move, 0.0, board)

    return results


def ask_human_move(board):
    while True:
        try:
            answer = input("Choose an open square (1-9), or q to quit: ").strip()
        except EOFError:
            return None
        if answer.lower() == "q":
            return None
        if answer.isdigit() and 1 <= int(answer) <= 9:
            move = int(answer) - 1
            if board[move] == EMPTY:
                return move
        print("Please choose an open square from 1 to 9.")


def main():
    rng = random.Random()
    agent = QLearningAgent(rng)
    results = train(agent)
    print("Training complete:", results)
    print("You are X. The learning agent is O.\n")

    # Main game loop.
    board = new_board()
    while True:
        show_board(board)
        move = ask_human_move(board)
        if move is None:
            print("Game ended.")
            break
        board[move] = HUMAN
        if check_winner(board, HUMAN):
            show_board(board)
            print("You win!")
            break
        if is_tie(board):
            show_board(board)
            print("It's a tie!")
            break

        ai_move = agent.choose_move(board)
        board[ai_move] = AGENT
        print(f"The agent chose square {ai_move + 1}.\n")
        if check_winner(board, AGENT):
            show_board(board)
            print("The agent wins!")
            break
        if is_tie(board):
            show_board(board)
            print("It's a tie!")
            break


if __name__ == "__main__":
    main()

package com.qwixx.game

class IllegalMoveException(message: String) : RuntimeException(message)

object GameRules {

    private const val MAX_PENALTIES = 4

    fun legalMoves(state: GameState, roll: DiceRoll, player: Player): List<Move> {
        val playerState = state.players.getValue(player)
        val marks = Color.entries.flatMap { color ->
            legalMarksForColor(playerState.rows.getValue(color), roll)
        }.map { (color, number) -> Move.Mark(color, number) }

        return marks + Move.Pass
    }

    fun applyMove(state: GameState, roll: DiceRoll, player: Player, move: Move): GameState {
        val legal = legalMoves(state, roll, player)
        if (move !in legal) {
            throw IllegalMoveException("Move $move is not legal for roll $roll")
        }

        val updatedState = when (move) {
            is Move.Mark -> applyMark(state, roll, player, move)
            is Move.Pass -> applyPenalty(state, roll, player)
        }
        return updatedState.checkGameEnd().switchPlayer()
    }

    private fun applyMark(state: GameState, roll: DiceRoll, player: Player, move: Move.Mark): GameState {
        val playerState = state.players.getValue(player)
        val row = playerState.rows.getValue(move.color)
        val updatedRow = row.withMark(move.number)
        val updatedPlayer = playerState.updateRow(updatedRow)
        return state
            .updatePlayer(player, updatedPlayer)
            .recordMove(MoveRecord(player, roll, move))
    }

    private fun applyPenalty(state: GameState, roll: DiceRoll, player: Player): GameState {
        val playerState = state.players.getValue(player).addPenalty()
        return state
            .updatePlayer(player, playerState)
            .recordMove(MoveRecord(player, roll, Move.Pass))
    }

    private fun GameState.checkGameEnd(): GameState {
        val penaltyEnd = players.values.any { it.penalties >= MAX_PENALTIES }
        // Future end conditions (e.g., locked rows) can be added here.
        return if (penaltyEnd) copy(gameOver = true) else this
    }

    private fun legalMarksForColor(row: RowState, roll: DiceRoll): List<Pair<Color, Int>> {
        if (row.locked) return emptyList()
        val numbers = row.color.numbers
        val lastIndex = row.lastMark()?.let { numbers.indexOf(it) } ?: if (row.color.ascending) -1 else numbers.size

        val whiteSum = roll.whiteSum
        val whitePlusColor = roll.whitePlusColor(row.color)

        val candidates = (whitePlusColor + whiteSum).distinct()

        return candidates
            .filter { numbers.contains(it) }
            .filter { isToTheRight(row.color, numbers, lastIndex, it) }
            .filterNot { row.isAlreadyMarked(it) }
            .map { row.color to it }
    }

    private fun isToTheRight(color: Color, numbers: List<Int>, lastIndex: Int, number: Int): Boolean {
        val idx = numbers.indexOf(number)
        return if (color.ascending) idx > lastIndex else idx < lastIndex
    }
}

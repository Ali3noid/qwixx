package com.qwixx.game

data class RowState(
    val color: Color,
    val marked: List<Int> = emptyList(),
    val locked: Boolean = false
) {
    fun lastMark(): Int? = if (marked.isEmpty()) null else marked.maxByOrNull { positionIndex(it) }

    fun isAlreadyMarked(number: Int): Boolean = marked.contains(number)

    fun withMark(number: Int): RowState {
        val updated = marked + number
        val shouldLock = shouldLockAfterMark(updated, number)
        return copy(marked = updated.sortedBy { positionIndex(it) }, locked = shouldLock)
    }

    private fun shouldLockAfterMark(updated: List<Int>, number: Int): Boolean {
        val isTerminal = number == color.lastNumber
        return updated.size >= 5 && isTerminal
    }

    private fun positionIndex(number: Int): Int {
        return color.numbers.indexOf(number)
    }
}

data class PlayerState(
    val rows: Map<Color, RowState> = Color.entries.associateWith { RowState(it) },
    val penalties: Int = 0
) {
    fun updateRow(row: RowState): PlayerState = copy(rows = rows + (row.color to row))
    fun addPenalty(): PlayerState = copy(penalties = penalties + 1)
}

data class GameState(
    val players: Map<Player, PlayerState> = Player.entries.associateWith { PlayerState() },
    val moveHistory: List<MoveRecord> = emptyList(),
    val currentPlayer: Player = Player.HUMAN,
    val gameOver: Boolean = false
) {
    fun updatePlayer(player: Player, playerState: PlayerState): GameState =
        copy(players = players + (player to playerState))

    fun recordMove(record: MoveRecord): GameState = copy(moveHistory = moveHistory + record)

    fun switchPlayer(): GameState = copy(currentPlayer = if (currentPlayer == Player.HUMAN) Player.AI else Player.HUMAN)
}

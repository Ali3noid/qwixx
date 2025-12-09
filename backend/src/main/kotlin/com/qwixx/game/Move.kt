package com.qwixx.game

sealed class Move {
    data class Mark(val color: Color, val number: Int) : Move()
    object Pass : Move()
}

enum class Player {
    HUMAN,
    AI
}

data class MoveRecord(
    val player: Player,
    val roll: DiceRoll,
    val move: Move
)

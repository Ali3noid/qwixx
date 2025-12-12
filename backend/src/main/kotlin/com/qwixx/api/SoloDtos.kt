package com.qwixx.api

import com.qwixx.game.Color
import com.qwixx.game.DiceRoll
import com.qwixx.game.Move
import com.qwixx.game.MoveRecord
import com.qwixx.game.Player
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class StartGameResponse(
    @SerialName("session_id") val sessionId: String,
    val roll: DiceRollResponse,
    val state: GameView
)

@Serializable
data class MoveRequest(
    val move: MovePayload
)

@Serializable
data class MovePayload(
    val type: String,
    val color: Color? = null,
    val number: Int? = null
) {
    fun toDomain(): Move = when (type.lowercase()) {
        "mark" -> Move.Mark(requireNotNull(color), requireNotNull(number))
        "pass" -> Move.Pass
        else -> error("Unsupported move type: $type")
    }
}

@Serializable
data class MoveResponse(
    val roll: DiceRollResponse?,
    val state: GameView
)

@Serializable
data class DiceRollResponse(
    val white1: Int,
    val white2: Int,
    val red: Int,
    val yellow: Int,
    val green: Int,
    val blue: Int
) {
    companion object {
        fun fromDomain(roll: DiceRoll) = DiceRollResponse(
            white1 = roll.white1,
            white2 = roll.white2,
            red = roll.red,
            yellow = roll.yellow,
            green = roll.green,
            blue = roll.blue
        )
    }
}

@Serializable
data class GameView(
    val players: Map<Player, PlayerView>,
    @SerialName("current_player") val currentPlayer: Player,
    @SerialName("game_over") val gameOver: Boolean,
    @SerialName("move_history") val moveHistory: List<MoveRecordView>
) {
    companion object {
        fun fromDomain(state: com.qwixx.game.GameState): GameView =
            GameView(
                players = state.players.mapValues { PlayerView.fromDomain(it.value) },
                currentPlayer = state.currentPlayer,
                gameOver = state.gameOver,
                moveHistory = state.moveHistory.map { MoveRecordView.fromDomain(it) }
            )
    }
}

@Serializable
data class PlayerView(
    val rows: Map<Color, RowView>,
    val penalties: Int
) {
    companion object {
        fun fromDomain(playerState: com.qwixx.game.PlayerState): PlayerView =
            PlayerView(
                rows = playerState.rows.mapValues { RowView.fromDomain(it.value) },
                penalties = playerState.penalties
            )
    }
}

@Serializable
data class RowView(
    val color: Color,
    val marked: List<Int>,
    val locked: Boolean
) {
    companion object {
        fun fromDomain(row: com.qwixx.game.RowState): RowView =
            RowView(color = row.color, marked = row.marked, locked = row.locked)
    }
}

@Serializable
data class MoveRecordView(
    val player: Player,
    val roll: DiceRollResponse,
    val move: MovePayload
) {
    companion object {
        fun fromDomain(record: MoveRecord): MoveRecordView =
            MoveRecordView(
                player = record.player,
                roll = DiceRollResponse.fromDomain(record.roll),
                move = when (record.move) {
                    is Move.Mark -> MovePayload(type = "mark", color = record.move.color, number = record.move.number)
                    Move.Pass -> MovePayload(type = "pass")
                }
            )
    }
}

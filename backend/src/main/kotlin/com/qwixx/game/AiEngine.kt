package com.qwixx.game

import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import kotlin.random.Random

class AiEngine(
    private val random: Random = Random.Default,
    private val maxThinkingTimeMs: Long = 1_000
) {
    suspend fun chooseMove(state: GameState, roll: DiceRoll): Move {
        val legal = GameRules.legalMoves(state, roll, Player.AI).filterIsInstance<Move.Mark>()
        return try {
            withTimeout(maxThinkingTimeMs) {
                legal.randomOrNull(random) ?: Move.Pass
            }
        } catch (_: TimeoutCancellationException) {
            Move.Pass
        }
    }

    private fun <T> List<T>.randomOrNull(random: Random): T? =
        if (isEmpty()) null else this[random.nextInt(size)]
}

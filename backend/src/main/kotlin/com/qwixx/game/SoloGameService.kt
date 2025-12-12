package com.qwixx.game

import kotlin.random.Random
import java.util.UUID

data class SoloSession(
    val id: String,
    val state: GameState,
    val currentRoll: DiceRoll
)

data class MoveResult(
    val state: GameState,
    val roll: DiceRoll?
)

class SoloGameService(
    private val aiEngine: AiEngine = AiEngine(),
    private val random: Random = Random.Default
) {
    private val sessions: MutableMap<String, SoloSession> = mutableMapOf()

    fun start(): SoloSession {
        val initialState = GameState()
        val roll = Dice.roll(random)
        val id = UUID.randomUUID().toString()
        val session = SoloSession(id, initialState, roll)
        sessions[id] = session
        return session
    }

    fun get(id: String): SoloSession? = sessions[id]

    suspend fun applyMove(sessionId: String, move: Move): MoveResult? {
        val session = sessions[sessionId] ?: return null
        if (session.state.gameOver) return MoveResult(session.state, null)

        val updatedState = GameRules.applyMove(session.state, session.currentRoll, Player.HUMAN, move)

        val (stateAfterAi, _) = playAiTurnIfNeeded(updatedState)

        val newRoll = if (stateAfterAi.gameOver) null else Dice.roll(random)
        val nextState = stateAfterAi.copy(currentPlayer = Player.HUMAN)
        val updatedSession = SoloSession(
            id = sessionId,
            state = nextState,
            currentRoll = newRoll ?: session.currentRoll
        )
        sessions[sessionId] = updatedSession
        return MoveResult(state = nextState, roll = newRoll)
    }

    fun restart(sessionId: String): SoloSession? {
        if (!sessions.containsKey(sessionId)) return null
        val roll = Dice.roll(random)
        val session = SoloSession(sessionId, GameState(), roll)
        sessions[sessionId] = session
        return session
    }

    private suspend fun playAiTurnIfNeeded(state: GameState): Pair<GameState, DiceRoll?> {
        if (state.gameOver) return state to null
        if (state.currentPlayer != Player.AI) return state to null

        val roll = Dice.roll(random)
        val aiMove = aiEngine.chooseMove(state, roll)
        val updated = GameRules.applyMove(state, roll, Player.AI, aiMove)
        return updated to roll
    }
}

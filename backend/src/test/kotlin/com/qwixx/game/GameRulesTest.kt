package com.qwixx.game

import com.qwixx.game.Player.HUMAN
import kotlinx.coroutines.runBlocking
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GameRulesTest {

    @Test
    fun `reject illegal move when out of order`() {
        val initialRow = RowState(Color.RED, marked = listOf(4, 6))
        val state = gameStateWith(playerState = rowsForPlayer(initialRow))
        val roll = DiceRoll(white1 = 2, white2 = 2, red = 1, yellow = 1, green = 1, blue = 1)

        val illegalMove = Move.Mark(Color.RED, 3)

        assertFailsWith<IllegalMoveException> {
            GameRules.applyMove(state, roll, HUMAN, illegalMove)
        }
    }

    @Test
    fun `lock row after fifth mark including terminal value`() {
        val marked = listOf(2, 3, 4, 5, 6)
        val row = RowState(Color.RED, marked = marked)
        val state = gameStateWith(playerState = rowsForPlayer(row))
        val roll = DiceRoll(white1 = 6, white2 = 6, red = 6, yellow = 1, green = 1, blue = 1)

        val move = Move.Mark(Color.RED, 12)
        val updated = GameRules.applyMove(state, roll, HUMAN, move)
        assertTrue(
            updated.players[HUMAN]!!.rows.getValue(Color.RED).locked,
            "Row should be locked after marking terminal with 5+ crosses"
        )
    }

    @Test
    fun `pass adds penalty`() {
        val state = GameState()
        val roll = Dice.roll(Random(0))

        val updated = GameRules.applyMove(state, roll, HUMAN, Move.Pass)
        assertEquals(1, updated.players.getValue(HUMAN).penalties)
    }

    @Test
    fun `ai returns move within time budget`() = runBlocking {
        val state = GameState()
        val roll = DiceRoll(white1 = 3, white2 = 3, red = 3, yellow = 3, green = 3, blue = 3)
        val ai = AiEngine(random = Random(1), maxThinkingTimeMs = 500)

        val move = ai.chooseMove(state, roll)
        assertTrue(move is Move.Mark || move is Move.Pass)
    }

    @Test
    fun `move history records actions`() {
        val state = GameState()
        val roll = DiceRoll(white1 = 3, white2 = 3, red = 3, yellow = 3, green = 3, blue = 3)
        val legalMove = GameRules.legalMoves(state, roll, HUMAN).first { it is Move.Mark } as Move.Mark

        val updated = GameRules.applyMove(state, roll, HUMAN, legalMove)
        assertEquals(1, updated.moveHistory.size)
        assertEquals(legalMove, updated.moveHistory.first().move)
    }

    @Test
    fun `game ends after four penalties for a player`() {
        val playerState = PlayerState(penalties = 3)
        val state = gameStateWith(playerState = playerState)
        val roll = Dice.roll(Random(1))

        val updated = GameRules.applyMove(state, roll, HUMAN, Move.Pass)
        assertEquals(4, updated.players.getValue(HUMAN).penalties)
        assertTrue(updated.gameOver, "Game should end after 4 penalties for any player")
    }
}

private fun rowsForPlayer(row: RowState): PlayerState =
    PlayerState(rows = Color.entries.associateWith { if (it == row.color) row else RowState(it) })

private fun gameStateWith(
    player: Player = HUMAN,
    playerState: PlayerState
): GameState =
    GameState(players = Player.entries.associateWith { if (it == player) playerState else PlayerState() })

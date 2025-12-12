package com.qwixx.game

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SoloGameServiceTest {

    @Test
    fun `persist state after move and retrieve`() {
        val random = QueueRandom(listOf(3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4))
        val service = SoloGameService(aiEngine = AiEngine(random, 1_000), random = random)

        val start = service.start()
        val move = Move.Mark(Color.RED, 6) // legal with roll 3+3 or 3+3 color
        val result = runBlocking { service.applyMove(start.id, move) }

        val session = service.get(start.id)
        val moveHistory = session!!.state.moveHistory

        assertNotNull(session)
        assertTrue(moveHistory.size == 2, "Each, human and ai move should be recorded in history: ${session.state.moveHistory.joinToString()}")
        assertEquals(Player.HUMAN, moveHistory.first().player)
        assertEquals(result?.state?.moveHistory?.size, moveHistory.size)
    }

    @Test
    fun `restart clears state and history`() {
        val random = QueueRandom(List(20) { 3 })
        val service = SoloGameService(aiEngine = AiEngine(random, 1_000), random = random)
        val start = service.start()
        runBlocking { service.applyMove(start.id, Move.Mark(Color.RED, 6)) }

        val restarted = service.restart(start.id)
        assertNotNull(restarted)
        assertEquals(0, restarted.state.moveHistory.size)
        assertTrue(restarted.state.players.values.all { it.penalties == 0 })
    }

    @Test
    fun `resume keeps penalties per player`() {
        val random = QueueRandom(List(20) { 2 })
        val service = SoloGameService(aiEngine = AiEngine(random, 1_000), random = random)
        val start = service.start()
        runBlocking { service.applyMove(start.id, Move.Pass) }
        runBlocking { service.applyMove(start.id, Move.Pass) }

        val session = service.get(start.id)
        assertNotNull(session)
        val penalties = session.state.players.getValue(Player.HUMAN).penalties
        assertEquals(2, penalties)
    }
}

private class QueueRandom(private val values: List<Int>) : kotlin.random.Random() {
    private var index = 0
    override fun nextBits(bitCount: Int): Int = nextInt()

    override fun nextInt(from: Int, until: Int): Int {
        if (values.isEmpty()) error("QueueRandom requires at least one value")
        val value = values[index % values.size]
        index++
        return value.coerceIn(from, until - 1)
    }

    override fun nextInt(): Int = 0 // deterministic fallback when bounds not provided
}

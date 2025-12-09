package com.qwixx.game

import kotlin.random.Random

data class DiceRoll(
    val white1: Int,
    val white2: Int,
    val red: Int,
    val yellow: Int,
    val green: Int,
    val blue: Int
) {
    val whiteSum: Int = white1 + white2

    fun colorDie(color: Color): Int = when (color) {
        Color.RED -> red
        Color.YELLOW -> yellow
        Color.GREEN -> green
        Color.BLUE -> blue
    }

    fun whitePlusColor(color: Color): List<Int> =
        listOf(white1 + colorDie(color), white2 + colorDie(color))
}

object Dice {
    fun roll(random: Random = Random.Default): DiceRoll {
        fun die() = random.nextInt(1, 7)
        return DiceRoll(
            white1 = die(),
            white2 = die(),
            red = die(),
            yellow = die(),
            green = die(),
            blue = die()
        )
    }
}

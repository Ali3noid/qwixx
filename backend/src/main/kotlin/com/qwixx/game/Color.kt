package com.qwixx.game

enum class Color(val ascending: Boolean, val numbers: List<Int>) {
    RED(true, (2..12).toList()),
    YELLOW(true, (2..12).toList()),
    GREEN(false, (12 downTo 2).toList()),
    BLUE(false, (12 downTo 2).toList());

    val lastNumber: Int = numbers.last()
}

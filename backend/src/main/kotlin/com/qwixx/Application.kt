package com.qwixx

import com.qwixx.api.soloRoutes
import com.qwixx.game.SoloGameService
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import kotlinx.serialization.json.Json

/**
 * Minimal Ktor bootstrap to satisfy the application entrypoint.
 * Core feature logic lives in domain services and can be wired into HTTP/WebSocket endpoints later.
 */
fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0") {
        module()
    }.start(wait = true)
}

fun Application.module() {
    val soloGameService = SoloGameService()

    install(ContentNegotiation) {
        json(
            Json {
                prettyPrint = false
                ignoreUnknownKeys = true
            }
        )
    }

    routing {
        soloRoutes(soloGameService)
    }
}

package com.qwixx.api

import com.qwixx.game.Move
import com.qwixx.game.SoloGameService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.soloRoutes(service: SoloGameService) {
    route("/solo") {
        post("/start") {
            val session = service.start()
            call.respond(
                HttpStatusCode.Created,
                StartGameResponse(
                    sessionId = session.id,
                    roll = DiceRollResponse.fromDomain(session.currentRoll),
                    state = GameView.fromDomain(session.state)
                )
            )
        }

        get("/{id}") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val session = service.get(id) ?: return@get call.respond(HttpStatusCode.NotFound)
            call.respond(
                MoveResponse(
                    roll = DiceRollResponse.fromDomain(session.currentRoll),
                    state = GameView.fromDomain(session.state)
                )
            )
        }

        post("/{id}/move") {
            val id = call.parameters["id"] ?: return@post call.respond(HttpStatusCode.BadRequest)
            val payload = call.receive<MoveRequest>()
            val result = service.applyMove(id, payload.toDomain())
                ?: return@post call.respond(HttpStatusCode.NotFound)
            call.respond(
                MoveResponse(
                    roll = result.roll?.let { DiceRollResponse.fromDomain(it) },
                    state = GameView.fromDomain(result.state)
                )
            )
        }

        post("/{id}/restart") {
            val id = call.parameters["id"] ?: return@post call.respond(HttpStatusCode.BadRequest)
            val session = service.restart(id) ?: return@post call.respond(HttpStatusCode.NotFound)
            call.respond(
                MoveResponse(
                    roll = DiceRollResponse.fromDomain(session.currentRoll),
                    state = GameView.fromDomain(session.state)
                )
            )
        }

        get("/{id}/health") {
            call.respondText("ok")
        }
    }
}

private fun MoveRequest.toDomain(): Move = move.toDomain()

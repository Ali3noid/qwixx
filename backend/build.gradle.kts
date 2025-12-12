import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.23"
    id("io.ktor.plugin") version "2.3.7"
    application
    kotlin("plugin.serialization") version "1.9.23"
}

group = "com.qwixx"
version = "0.1.0"

application {
    mainClass.set("com.qwixx.ApplicationKt")
}

repositories {
    mavenCentral()
}

dependencies {

    /** KTOR CORE **/
    val ktorVersion = "2.3.7"
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")

    /** KTOR FEATURES **/
    implementation("io.ktor:ktor-server-websockets:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-server-cors:$ktorVersion")
    implementation("io.ktor:ktor-server-compression:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")

    /** DATABASE: POSTGRES + EXPOSED **/
    val exposedVersion = "0.44.1"
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-dao:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-kotlin-datetime:$exposedVersion")

    implementation("org.postgresql:postgresql:42.7.1")
    implementation("com.zaxxer:HikariCP:5.1.0") // Connection pool

    /** REDIS **/
    implementation("org.redisson:redisson:3.27.0")

    /** COROUTINES **/
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

    /** AI: ONNX Runtime (CPU) **/
    implementation("com.microsoft.onnxruntime:onnxruntime:1.17.1")

    /** LOGGING **/
    implementation("ch.qos.logback:logback-classic:1.4.14")

    /** TESTING **/
    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-tests:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += "-Xjsr305=strict"
    }
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

tasks.test {
    useJUnitPlatform()
}

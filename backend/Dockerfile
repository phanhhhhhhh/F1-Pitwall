# ─── Stage 1: Build ────────────────────────────────────────────────────────
FROM maven:3.9.15-eclipse-temurin-26 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# ─── Stage 2: Run ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Run unprivileged — nothing in the app writes to the filesystem.
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=builder --chown=app:app /app/target/*.jar app.jar
USER app

# Size the heap from the container's memory limit (Render's free tier is 512 MB) and exit
# on OOM so the platform restarts the service instead of leaving it half-dead.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]

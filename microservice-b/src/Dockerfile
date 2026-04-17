# ── Stage 1: Build (Maven + Java 21) ──────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime (eclipse-temurin:21-jre-alpine) ─────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/src/main/resources/logback-spring.xml logback-spring.xml

RUN chown appuser:appgroup app.jar logback-spring.xml

USER appuser

EXPOSE 8081

ENV TUH_JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java ${TUH_JAVA_OPTS} -Dlogging.config=logback-spring.xml -jar app.jar"]

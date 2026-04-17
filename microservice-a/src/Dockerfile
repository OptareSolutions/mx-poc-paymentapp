# ── Stage 1: Build (Maven + Java 21) ──────────────────────────────────────────
# Alineado con identity-connector: Maven multi-módulo, Java 21
# En producción real ATT, sustituir por Golden Image ECR:
#   FROM 177890020059.dkr.ecr.mx-central-1.amazonaws.com/goldenimages/giattol9jdk21-slim:...
FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /app

# Cache de dependencias Maven (capa independiente del código)
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Build del código fuente
COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime (eclipse-temurin:21-jre-alpine) ─────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Usuario no-root (patrón identity-connector: usrapp)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copia solo el JAR generado por Maven
COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/src/main/resources/logback-spring.xml logback-spring.xml

RUN chown appuser:appgroup app.jar logback-spring.xml

USER appuser

EXPOSE 8080

# TUH_JAVA_OPTS: variable de tuning JVM (patrón entrypoint.sh identity-connector)
ENV TUH_JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java ${TUH_JAVA_OPTS} -Dlogging.config=logback-spring.xml -jar app.jar"]

# ---------- Etapa 1: compilar el .jar con Maven ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# Copiar primero el pom para aprovechar la caché de dependencias
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

# ---------- Etapa 2: imagen ligera solo con el JRE ----------
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/students-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

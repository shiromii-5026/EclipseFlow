# EclipseFlow 后端 Docker 镜像
# 构建：mvn clean package -DskipTests && docker build -t eclipse-flow-backend .
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 复制构建好的 JAR
COPY target/*.jar app.jar

# 默认端口
EXPOSE 8080

# JVM 参数：限制内存、使用 G1GC
ENTRYPOINT ["java", "-Xmx256m", "-XX:+UseG1GC", "-jar", "app.jar"]

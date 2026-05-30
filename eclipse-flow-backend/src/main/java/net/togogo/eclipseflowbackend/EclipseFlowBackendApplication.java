package net.togogo.eclipseflowbackend;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("net.togogo.eclipseflowbackend.mapper")
public class EclipseFlowBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(EclipseFlowBackendApplication.class, args);
    }

}
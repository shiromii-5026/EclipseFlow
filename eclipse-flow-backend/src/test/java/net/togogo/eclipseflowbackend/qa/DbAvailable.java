package net.togogo.eclipseflowbackend.qa;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * MySQL 可达性探测 —— 供集成测试门控使用。
 *
 * 集成测试要连本机真实 MySQL(root/123456 的 eclipse_flow 库),
 * 库不可达时整套 @SpringBootTest 会起不来。这里在 Spring 上下文初始化
 * 之前先快速探活:连不上就跳过测试,而不是让整套测试变红。
 */
public final class DbAvailable {

    private static final String URL =
            "jdbc:mysql://127.0.0.1:3306/eclipse_flow"
                    + "?connectTimeout=2000&socketTimeout=2000&serverTimezone=Asia/Shanghai";
    private static final String USER = "root";
    private static final String PASS = "123456";

    private DbAvailable() {
    }

    public static boolean ping() {
        try (Connection conn = DriverManager.getConnection(URL, USER, PASS);
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT 1")) {
            return rs.next();
        } catch (Exception e) {
            return false;
        }
    }
}

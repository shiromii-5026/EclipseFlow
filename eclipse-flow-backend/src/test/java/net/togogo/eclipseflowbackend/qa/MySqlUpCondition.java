package net.togogo.eclipseflowbackend.qa;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * JUnit5 条件扩展:MySQL 可达则启用测试,否则跳过。
 * 用法:@ExtendWith(MySqlUpCondition.class) 加在测试类上。
 *
 * 它会在 @SpringBootTest 上下文加载之前被求值,所以连不上库时能提前整类跳过。
 */
public class MySqlUpCondition implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        return DbAvailable.ping()
                ? ConditionEvaluationResult.enabled("本机 MySQL 可达,运行集成测试")
                : ConditionEvaluationResult.disabled(
                        "本机 MySQL(eclipse_flow)不可达,跳过需要真实数据库的集成测试");
    }
}

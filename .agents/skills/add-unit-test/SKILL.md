---
name: add-unit-test
description: 指导代理为后端 Go 代码或前端 React/TypeScript 编写单元测试。适用于需要保障核心逻辑正确性、测试边界情况的场景。
---

# 添加单元测试技能 (Add Unit Test Skill)

本技能指导代理如何在 `LangStudy` 项目中编写规范的单元测试，保证计算逻辑、算法决策及核心转换函数的正确性。

## 测试编写规则

### 1. 测试对象选取 (Priority Rules)
- **高优先级（必须测）**：
  - 核心计算与业务转换逻辑，如前端挖空分词切分 `splitToken`、后端艾宾浩斯复习曲线间隔计算等。
  - 数据模型解析或解析修正逻辑（如 JSON 反序列化 Fallback 处理）。
- **低优先级（可选择测试或不测试）**：
  - 纯数据库 CRUD 映射（由 GORM 保障，无需重复测试，除非存在复杂子查询逻辑）。
  - 简单的 HTTP 路由中转（纯参数绑定且无复杂业务时）。

### 2. 后端单元测试规范 (Go)
- **文件命名与包划分**：
  - 测试文件放置在待测文件同级目录中，以 `_test.go` 结尾。
- **编写模式：表格驱动测试 (Table-Driven Tests)**：
  - 强烈建议使用 Go 社区推荐的表格驱动测试，定义输入、期望输出与边界测试用例：
    ```go
    func TestCalculateNextInterval(t *testing.T) {
        tests := []struct {
            name     string
            input    int
            expected int
        }{
            {"first review", 1, 3},
            {"second review", 3, 7},
            {"invalid step fallback", -1, 1},
        }
        for _, tt := range tests {
            t.Run(tt.name, func(t *testing.T) {
                result := CalculateNextInterval(tt.input)
                if result != tt.expected {
                    t.Errorf("expected %d, got %d", tt.expected, result)
                }
            })
        }
    }
    ```
- **依赖隔离 (Mocking)**：
  - 涉及网络调用（如大模型调用、TTS 语音合成）时，必须通过接口定义进行 Mock 阻断，严禁在单元测试中发起真实网络请求（这会导致测试极度缓慢、消耗 Token、并具有不确定性）。

### 3. 前端单元测试规范 (TypeScript)
- 编写核心 Utility 函数的单元测试。
- 针对边界情况（如空数组、乱序字符串、带特殊符号的文本分词）编写测试用例。

### 4. 运行与验证
- 在提交测试前，必须在本地运行并成功通过：
  - 后端运行测试：`go test -v ./...`
  - 前端运行测试（如已配置相应的 jest 或 vitest 运行命令）。
- 绝不能提交会导致编译失败或执行报错的测试代码。

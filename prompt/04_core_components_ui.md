全局状态流转已跑通，现在请专注于业务原子组件的编写。
请严格拆分并依次输出以下 [填写数量，如：两个] 文件的完整代码，UI 风格要求极简现代：

[填写组件名，如：src/components/BlankInput.tsx]：

接收 props：当前片段的 segment 数据、全局状态 [填写状态名，如：currentLevel]。

核心逻辑：如果 [填写触发条件，如：currentLevel >= segment.blankLevel 且 isBlank 为 true]，渲染输入框，否则渲染纯文本。

交互要求：[填写具体交互，如：失去焦点或回车时校验输入是否匹配 segment.text，正确变绿，错误变红并清空]。

[填写组件名，如：src/components/MessageBubble.tsx]：

接收 props：单句对话的完整数据。

核心逻辑：根据角色判断气泡居左或居右（使用 Tailwind 控制布局），内部遍历渲染 segments 数组（使用上一步的 BlankInput 组件）。

辅助功能：[填写附加UI要求，如：气泡旁放置一个 Hint 图标按钮，点击后在下方展开中文翻译]。

不要使用任何代码省略符，确保这两段代码可以直接运行。
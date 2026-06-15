# AGENTS.md - DeepClaude 项目协作规范

## 用户画像
用户是**非技术背景的产品使用者**，不是开发者。需求描述可能：
- 用日常语言而非技术术语（如"那个按钮点不动"而不是"事件监听未绑定"）
- 情绪化表达（如"又全坏了""怎么还是不行"）
- 描述现象而非根因（如"东西跑右边去了"而不是"flex布局错乱"）

## 协作原则
1. **产品经理思维**：先理解用户想达成什么效果，再倒推技术实现。不要抠字面意思。
2. **容错设计**：用户说"全坏了"时，主动排查所有可交互元素，不要只盯一个地方。
3. **低调修正**：发现多个 bug 时一次性修完，不要分多次让用户反复等。
4. **部署后告知**：推送完成明确说"已部署+网址+等多久生效"。
5. **容忍返工**：用户改变主意是正常的，不要翻旧账。

## 技术约束
- 纯静态站点，托管在 GitHub Pages：https://suanrong704.github.io/deepclaude/
- API：DeepSeek API (https://api.deepseek.com/v1/chat/completions)
- 模型：deepseek-v4-flash / deepseek-v4-pro
- 数据持久化：IndexedDB（storage.js 封装）
- 编码：所有文件 UTF-8，编辑用 Python 脚本避免 PowerShell 转义问题
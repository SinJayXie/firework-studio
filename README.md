# Firework Studio

基于 Tauri 2 + Vue 3 的跨平台烟花效果设计器，内置自定义声明式脚本语言 `firework.shell`，支持可视化编辑与实时预览。

## 功能特性

- 烟花引擎：Canvas2D / WebGL 双渲染器，支持火花（glitter）、环形、花蕊、频闪、流束等丰富形态
- 星点死亡特效：十字星（crossette）、噼啪（crackle）、花簇（floral）、落叶（fallingLeaves）
- onDeath 造型动作：圆形爆发（burst）、爆闪（flash）、弧线（arc）、螺旋（spiral）、环形（ring）、波浪（wave）、心形（heart），支持渐变与粒子生成时序
- 自定义脚本语言 `firework.shell`，声明式定义烟花效果
- 可视化设计器与代码编辑器，支持实时调试
- 内置 Monaco 编辑器，支持语法高亮、智能提示、悬停说明、错误诊断与一键修复（QuickFix）
- 中英文国际化

## 技术栈

- 前端：Vue 3、TypeScript、Vite、UnoCSS、Vue Router、Vue I18n、Monaco Editor
- 桌面端：Tauri 2、Rust
- 包管理：pnpm（workspace）

## 目录结构

```
firework-studio/
├── src/                      # 前端源码
│   ├── components/           # UI 组件
│   ├── composables/          # 组合式函数
│   ├── i18n/                 # 国际化
│   ├── libs/firework-engine/ # 烟花引擎核心
│   ├── router/               # 路由
│   └── views/                # 页面视图
├── src-tauri/                # Tauri / Rust 后端
├── shell-script/             # firework.shell 示例脚本
├── firework.shell            # 默认烟花定义
└── SYNTAX.md                 # firework.shell 语法参考
```

## 环境要求

- Node.js 18+
- pnpm
- Rust 1.77.2+

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/SinJayXie/firework-studio.git
cd firework-studio

# 安装依赖
pnpm install

# 启动 Web 开发服务器
pnpm dev

# 启动 Tauri 桌面应用
pnpm tauri dev

# 构建
pnpm build
```

## firework.shell 语法

`firework.shell` 是一种自定义声明式脚本格式，用于定义烟花爆炸效果。详细语法请参阅 [SYNTAX.md](./SYNTAX.md)。

## 贡献指南

欢迎提交 Issue 与 Pull Request，共同完善本项目。

1. Fork 本仓库并克隆到本地
2. 基于 `master` 创建特性分支：`git checkout -b feature/xxx`
3. 提交修改并推送到你的 Fork
4. 提交 Pull Request，并说明改动内容与动机

提交信息建议遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，例如 `feat:`、`fix:`、`docs:` 等。

## 许可证

本项目采用 [MIT License](https://opensource.org/licenses/MIT) 开源许可。

```
MIT License

Copyright (c) 2026 SinJayXie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 仓库地址

https://github.com/SinJayXie/firework-studio.git

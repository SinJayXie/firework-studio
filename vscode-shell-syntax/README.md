# Firework Shell Syntax

VS Code 语法高亮插件，为 `firework.shell` 脚本文件提供语法支持。

## 功能

- 关键字高亮：`firework`、`onDeath`、`burst`、`flash`、`arc`
- 属性名着色：`name`、`size`、`life`、`color`、`glitter` 等
- 颜色值识别：`#ff0043`、`#fff` 等 hex 颜色
- 特殊常量：`random`、`inherit`、`true`、`false`
- glitter 类型值：`light`、`medium`、`heavy`、`thick`、`streamer`、`willow`
- 注释支持：`//` 行注释、`/* */` 块注释
- 括号配对：`{}`、`[]`、`()`、`""`
- 自动识别 `.shell` 扩展名

## 安装

```bash
# 复制到 VS Code 扩展目录
cp -r vscode-shell-syntax ~/.vscode/extensions/firework-shell-syntax
```

或在 VS Code 中按 `F5` 以开发模式启动。

## 关联文件

| 文件 | 说明 |
|------|------|
| `package.json` | 插件清单 |
| `language-configuration.json` | 语言配置（注释、括号） |
| `syntaxes/firework-shell.tmLanguage.json` | TextMate 语法定义 |

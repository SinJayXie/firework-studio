# firework.shell 脚本开发文档

`firework.shell` 是 Firework Studio 内置的声明式脚本语言，用于定义烟花爆炸效果。本文档面向脚本开发者，完整说明脚本结构、参数、动作、校验规则以及编辑器与引擎的协作机制。

> **非 TypeScript/JavaScript**。它是一种自定义格式，系统启动时解析文件中的所有 `firework` 块并注册到面板下拉框。
>
> 语法速查请参阅 [SYNTAX.md](./SYNTAX.md)；本文档在此基础上补充了开发所需的完整规则与运行机制。

---

## 目录

1. [快速开始](#快速开始)
2. [脚本结构](#脚本结构)
3. [注释](#注释)
4. [值类型](#值类型)
5. [参数参考](#参数参考)
6. [onDeath 块](#ondeath-块)
7. [星点死亡特效](#星点死亡特效)
8. [校验规则与错误](#校验规则与错误)
9. [编辑器能力](#编辑器能力)
10. [加载与运行机制](#加载与运行机制)
11. [最佳实践](#最佳实践)
12. [完整示例](#完整示例)

---

## 快速开始

一个最小可用的脚本只需声明 `name`：

```
firework {
    name = "随机色"
}
```

保存后，该名称会出现在控制面板的烟花下拉框中，其余参数全部使用默认值。

带子粒子效果的完整示例：

```
firework {
    name = "双环"
    size = 340
    life = 900
    color = random
    glitter = light
    ring = true
    pistil = true

    onDeath {
        arc 3 (6.283) { color = inherit, life = 400 }
        flash(20)
    }
}
```

---

## 脚本结构

```
firework {
    name = "名称"
    参数 = 值
    ...

    onDeath {
        动作
        ...
    }
}

firework {
    ...
}
```

- 一个文件可包含**多个** `firework` 块，每个块对应一个可选的烟花。
- 参数与 `onDeath` 块**顺序无关**，可任意排列。
- `name` 是唯一必填参数，也是面板中显示的名称。

---

## 注释

支持两种注释，注释内容不会被解析：

```
// 单行注释

/* 多行
   注释 */
```

---

## 值类型

### 数字

```
size = 340
life = 1200
density = 0.8
lifeVariation = 1.5e-3   // 支持科学计数法
```

支持整数、浮点数、科学计数法。

### 字符串

```
name = "双环"
color = "#ff0043"
glitter = "light"
```

用双引号包裹，支持转义字符 `\\`。关键词与参数名不需要引号。

### 颜色

十六进制颜色 `#rrggbb` 无需引号，解析器自动识别：

```
color = #ff0043
secondColor = #1e7fff
```

### 颜色列表

```
color = [#ff0043, #1e7fff, #14fc56]
```

方括号内逗号分隔。多色分布有两种模式（随机选取其一）：**扇形分区**（每种颜色占据一段弧度）或**交错混合**（每种颜色各生成一轮星点）。

### 布尔

```
ring = true
pistil = false
```

仅接受小写 `true` / `false`。

### 内置值

| 值 | 可用于 | 含义 |
|------|--------|------|
| `random` | `color` | 随机选取颜色 |
| `inherit` | `burst.color` / `arc.color` / `spiral.color` | 继承死亡星点自身的颜色 |

### 标识符

参数名与关键词支持中文（Unicode 汉字范围），例如 `名字 = "测试"`。

---

## 参数参考

### 必填

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 烟花名称，显示在面板下拉框 |

### 外观

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `size` | number | 300 | 50 – 800 | 爆炸扩散范围，越大越分散 |
| `life` | number | 900 | 300 – 5000 | 星点存活时间 (ms) |
| `lifeVariation` | number | 0.125 | 0 – 5 | 存活时间随机浮动比例，实际存活 = life × (1 + random × lifeVariation) |
| `density` | number | 1.0 | 0.05 – 2 | 星点密度，实际星点数 = max(6, (size/54)² × density) |
| `starCount` | number | 自动计算 | 1 – 5000 | 直接指定星点数量，设置后跳过 density 自动计算 |

### 颜色

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `color` | string / 颜色列表 / `random` | `random` | 主颜色。`random` 随机；`"#ff0043"` 固定；`[#ff0, #0f0]` 多色 |
| `secondColor` | string | — | 星点生命周期后半段渐变为该颜色（transition 从 32%~37% 开始） |

> `secondColor` 只接受单个十六进制颜色，不支持 `random` 或数组。

### 火花（glitter）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `glitter` | 见下表 | — | 火花模式，决定尾部粒子密度和轨迹 |
| `glitterColor` | string | 跟随主色 | 火花颜色（单色取自身，多色取第一个） |

`glitter` 模式对照：

| 模式 | 密度（频率） | 速度 | 存活 | 视觉效果 |
|------|-------------|------|------|----------|
| `light` | 稀疏 (400) | 慢 (0.3) | 短 (300) | 细微闪烁 |
| `medium` | 中 (200) | 中 (0.44) | 中 (700) | 标准火星 |
| `heavy` | 密集 (80) | 中 (0.8) | 长 (1400) | 华丽厚尾 |
| `thick` | 极密 (16) | 快 (1.5~1.65) | 长 (1400) | 浓密拖尾 |
| `streamer` | 稀疏 (32) | 快 (1.05) | 中 (620) | 流束线条 |
| `willow` | 中 (120) | 慢 (0.34) | 长 (1400) | 杨柳垂落 |

> 火花频率会按画质缩放：实际频率 = 表中数值 ÷ quality。

### 特殊形态

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ring` | boolean | false | 环形排列星点 |
| `horsetail` | boolean | false | 马尾轨迹（垂直上升后炸开，星点继承上升速度） |
| `strobe` | boolean | false | 频闪效果（星点生命周期 46%~54% 处开始闪动） |
| `strobeColor` | string | — | 频闪时的颜色，不设置则为随机 |

### 双层效果

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pistil` | boolean | false | 同时发射内层小花蕊（50% 大小、60% 存活、1.4 密度、light 火花） |
| `pistilColor` | string | — | 花蕊颜色 |
| `streamers` | boolean | false | 附加白色流束层（90% 大小、80% 存活、streamer 火花） |

### 物理

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `gravity` | number | 1 | 0 – 5 | 重力倍率，作用于星点下落加速度。0 为无重力，越大下落越快 |
| `fade` | number | 1 | 0 – 2 | 空气阻力倍率，越大星点减速越明显。0 为无阻力 |
| `launchHeight` | number | 随机 | 0 – 1 | 爆炸高度比例。0 为低空，1 为高空；不设置时由引擎随机决定 |

---

## onDeath 块

`onDeath` 块定义每个星点死亡时触发的子效果，可包含多个动作，按声明顺序执行。

```
onDeath {
    动作1
    动作2
    ...
}
```

> `onDeath` 块不允许为空，至少需要包含一个动作。

### 动作：burst — 圆形爆发

```
burst 数量 { color = 颜色, life = 存活, speed = 速度 }
```

生成指定数量子粒子，均匀分布在圆内。所有选项均可省略：

| 选项 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `color` | string / `inherit` | `inherit` | — | 子粒子颜色。`inherit` 继承死亡星点的颜色 |
| `life` | number | 600 | 100 – 3000 | 子粒子存活时间 (ms) |
| `speed` | number | 1.0 | 0.1 – 5 | 扩散速度倍率 |

简写：`burst 8` 等价于 `burst 8 { }`。

### 动作：flash — 爆闪光晕

```
flash
flash(半径)
```

在死亡位置生成径向渐变光晕：

| 方式 | 半径 |
|------|------|
| `flash` | 默认 46 |
| `flash(30)` | 指定 30 |

### 动作：arc — 弧线分布

```
arc 数量 (弧度) { color = 颜色, life = 存活 }
```

沿弧线均匀分布粒子，弧度默认 `6.283`（2×PI，整圆），也支持 `Math.PI`（半圆）：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `(弧度)` | number / `Math.PI` | `6.283`（整圆） | 弧跨度。写数字（如 `3.1416` = 半圆），也可写 `Math.PI`（半圆）；整圆用 `6.283` 或省略括号 |
| `color` | string / `inherit` | `inherit` | 子粒子颜色 |
| `life` | number | 600 | 子粒子存活时间 (ms) |

> `arc` 只支持 `color` 与 `life` 两个选项，不支持 `speed`。

简写：`arc 6`（全圆 6 粒子，全部默认值）。

### 动作：spiral — 螺旋分布

```
spiral 数量 (圈数) { color = 颜色, life = 存活, speed = 速度 }
```

生成螺旋排列的子粒子，从中心向外沿螺线展开：

| 选项 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `数量` | number | 必填 | 1 – 100 | 子粒子数量 |
| `(圈数)` | number | `1` | (0, 10] | 螺旋圈数，可省略 |
| `color` | string / `inherit` | `inherit` | — | 子粒子颜色 |
| `life` | number | 600 | 100 – 3000 | 子粒子存活时间 (ms) |
| `speed` | number | 1.0 | 0.1 – 5 | 扩散速度倍率 |

简写：`spiral 12`（1 圈 12 粒子，全部默认值）。

---

## 星点死亡特效

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `crossette` | boolean | false | 星点死亡时分裂为 4 颗小星（十字星） |
| `crackle` | boolean | false | 星点死亡时爆出金色火花（噼啪） |
| `floral` | boolean | false | 星点死亡时炸出密集花簇 |
| `fallingLeaves` | boolean | false | 金色火星缓缓飘落（落叶） |

> 这四种特效**可叠加**：同时启用时按 `crossette → crackle → floral → fallingLeaves` 顺序全部执行。
>
> 它们与 `onDeath` 块也可共存：内置特效先执行，`onDeath` 中自定义动作后执行，效果叠加。

---

## 校验规则与错误

脚本在解析阶段会进行完整校验，错误会阻止对应 `firework` 块注册，并在编辑器与错误对话框中提示。

| 校验项 | 规则 |
|--------|------|
| 数值范围 | `size` 50–800、`life` 300–5000、`lifeVariation` 0–5、`density` 0.05–2、`starCount` 1–5000、`gravity` 0–5、`fade` 0–2、`launchHeight` 0–1 |
| 动作数值范围 | `life` 100–3000、`speed` 0.1–5 |
| `glitter` 枚举 | 仅 `light` / `medium` / `heavy` / `thick` / `streamer` / `willow` |
| `color` | `random`、单个十六进制，或十六进制颜色数组 |
| `secondColor` 等单色参数 | 仅接受单个十六进制，不支持数组或 `random` |
| `burst` 数量 | 必须为正数，建议 ≤ 50 |
| `arc` 数量 | 必须为正数，建议 ≤ 100 |
| `arc` 弧度 | 必须在 `(0, 2π]` 区间 |
| `spiral` 数量 | 必须为正数，建议 ≤ 100 |
| `spiral` 圈数 | 必须在 `(0, 10]` 区间 |
| `flash` 半径 | 必须为正数，建议 ≤ 200 |
| 属性名 | 未知属性、重复属性会报错 |
| `onDeath` 块 | 不允许为空 |
| 字符串 / 数字 | 未闭合字符串、非法数字字面量会报错 |

---

## 编辑器能力

内置 Monaco 编辑器为 `firework.shell` 提供了完整开发支持：

- **语法高亮**：关键词、属性名、字符串、数字、颜色值、注释分别着色。
- **智能补全**：在顶层、`firework` 块、`onDeath` 块、`burst`/`arc`/`spiral` 选项块内提供上下文相关的代码片段与取值建议。
- **悬停说明**：悬停在属性名或值上显示类型与说明。
- **CodeLens**：每个 `firework` 块顶部显示 `▶ 名称`，点击即可单独运行该烟花。
- **格式化**：支持「格式化文档」，自动缩进（4 空格）、规范等号与逗号间距、折叠单行块。
- **错误诊断**：解析错误实时标红，并通过错误对话框汇总展示。

---

## 加载与运行机制

1. **解析**：`parseShellScript` 将脚本文本 token 化并解析为 `ParsedShell[]`，同时产出错误列表。
2. **编译**：`loadShellScript` 将每个 `ParsedShell` 转换为 `ShellOptions`，把 `onDeath` 动作编译为运行时回调。
3. **注册**：每个有效烟花以 `name` 为键注册到全局 `shellTypes` 与 `shellNameMap`，随后出现在面板下拉框。
4. **运行**：选中烟花后，引擎实例化 `Shell`，在 `burst()` 中根据参数生成星点、火花、双层效果与死亡特效。

因此，脚本中的 `name` 即是运行时的唯一标识，重复的 `name` 会互相覆盖。

---

## 最佳实践

- **先小后大**：先用极简脚本验证，再逐步叠加 `glitter`、`ring`、`pistil`、`onDeath` 等效果。
- **控制密度**：`size` 较大时适当调低 `density`，避免星点数量爆炸影响性能。
- **需要精确数量时用 `starCount`**：直接指定星点数，忽略 `density` 自动计算。
- **用 `inherit` 保持颜色一致**：`onDeath` 子粒子使用 `inherit` 时，会继承死亡星点的颜色，视觉更统一。
- **叠加热闹效果**：`burst` + `flash` + `arc` 可在同一 `onDeath` 内组合，营造丰富层次。
- **用 `spiral` 做旋转造型**：`spiral 16 (2)` 生成双圈螺旋，配合 `gravity` 可做回旋下落效果。
- **善用 CodeLens**：编辑器中点击 `▶` 快速预览单个烟花，无需运行整个脚本。

---

## 完整示例

### 极简：金色流星雨

```
firework {
    name = "流星雨"
    size = 200
    life = 2500
    density = 0.4
    color = #ffbf36
    glitter = willow
}
```

### 标准：带子粒子的双环

```
firework {
    name = "双环"
    size = 340
    life = 900
    color = random
    glitter = light
    glitterColor = #ffbf36
    ring = true
    pistil = true
    pistilColor = #ffffff

    onDeath {
        arc 3 (6.283) { color = inherit, life = 400 }
        flash(20)
    }
}
```

### 高级：多色 + 频闪 + 子弹

```
firework {
    name = "霓虹弹"
    size = 280
    life = 1100
    color = [#ff0043, #1e7fff, #14fc56]
    glitter = heavy
    strobe = true
    strobeColor = #ffffff

    onDeath {
        burst 6 { color = inherit, life = 450, speed = 0.7 }
        flash(35)
    }
}
```

### 内置特效与 onDeath 叠加

```
firework {
    name = "噼啪流星"
    size = 320
    life = 900
    color = #ffbf36
    crackle = true

    onDeath {
        flash(30)
    }
}
```

> 星点死亡时：先执行 `crackle` 爆出金色火花，再执行 `flash(30)` 光晕，效果叠加。

### 螺旋 + 物理参数

```
firework {
    name = "螺旋星云"
    size = 300
    life = 1400
    color = #1e7fff
    gravity = 1.2
    fade = 0.8

    onDeath {
        spiral 16 (2) { color = inherit, life = 600, speed = 1.0 }
        flash(40)
    }
}
```

> `spiral 16 (2)` 生成 2 圈 16 粒子的螺旋；`gravity = 1.2` 让星点下落更快，`fade = 0.8` 让空气阻力略弱。

### 多定义：一个文件多个烟花

```
firework {
    name = "金雨"
    size = 220
    life = 2800
    density = 0.5
    color = #ffbf36
    glitter = willow
}

firework {
    name = "蓝钻"
    size = 300
    life = 900
    color = #1e7fff
    glitter = light
    ring = true

    onDeath {
        burst 4 { color = inherit }
        flash
    }
}
```

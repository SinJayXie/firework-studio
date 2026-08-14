# firework.shell 语法参考

`firework.shell` 是自定义声明式脚本格式，用于定义烟花爆炸效果，**非 TypeScript/JavaScript**。
系统启动时自动解析文件中所有 `firework` 块并注册到面板。

---

## 整体结构

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

一个文件可包含多个 `firework` 块。

---

## 注释

支持两种注释：

```
// 单行注释

/* 多行
   注释 */
```

---

## 参数表

### 必填

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | string | 烟花名称，显示在面板下拉框 |

### 外观

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `size` | number | 300 | 50 – 800 | 爆炸扩散范围，越大越分散 |
| `life` | number | 900 | 300 – 5000 | 星点存活时间 (ms) |
| `lifeVariation` | number | 0.125 | 0 – 5 | 存活时间随机浮动比例。实际存活 = life × (1 + random × lifeVariation) |
| `density` | number | 1.0 | 0.05 – 2 | 星点密度。实际星点数 = max(6, (size/54)² × density) |
| `starCount` | number | 自动计算 | 1 – 5000 | 直接指定星点数量，设置后会跳过 density 自动计算 |

### 颜色

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `color` | `string` / `[string, ...]` / `random` | `random` | 主颜色。`random` 随机选取颜色；`"#ff0043"` 固定；`["#ff0","#0f0"]` 多色 |
| `secondColor` | string | — | 星点生命周期后半段渐变为该颜色（transition 从 32%~37% 开始） |

多色时有两种分布模式（随机选取）：
- **扇形分区**：每种颜色占据一段弧度
- **交错混合**：每种颜色各生成一轮星点

### 火花（glitter）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `glitter` | `light` / `medium` / `heavy` / `thick` / `streamer` / `willow` | — | 火花模式，决定尾部粒子密度和轨迹 |
| `glitterColor` | string | 跟随主色（单色取自身，多色取第一个） | 火花颜色 |

glitter 模式说明：

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

### 物理

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `gravity` | number | 1 | 0 – 5 | 重力倍率，作用于星点下落加速度。0 为无重力，越大下落越快 |
| `fade` | number | 1 | 0 – 2 | 空气阻力倍率，越大星点减速越明显。0 为无阻力 |
| `launchHeight` | number | 随机 | 0 – 1 | 爆炸高度比例。0 为低空，1 为高空；不设置时由引擎随机决定 |

### 双层效果

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pistil` | boolean | false | 同时发射内层小花蕊（50% 大小、60% 存活、1.4 密度、light 火花） |
| `pistilColor` | string | — | 花蕊颜色 |
| `streamers` | boolean | false | 附加白色流束层（90% 大小、80% 存活、streamer 火花） |

### 星点死亡特效

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `crossette` | boolean | false | 星点死亡时分裂为 4 颗小星（十字星） |
| `crackle` | boolean | false | 星点死亡时爆出金色火花（噼啪） |
| `floral` | boolean | false | 星点死亡时炸出密集花簇 |
| `fallingLeaves` | boolean | false | 金色火星缓缓飘落（落叶） |

> **注意：** `crossette`、`crackle`、`floral`、`fallingLeaves` **可叠加**：同时设置多个时，按 `crossette → crackle → floral → fallingLeaves` 顺序全部执行。
>
> 它们与 `onDeath` 块**可以共存**：内置特效先执行，`onDeath` 中自定义的动作后执行，两者叠加。

---

## onDeath 块

`onDeath` 块定义每个星点死亡时触发的子效果，可包含多个动作，按顺序执行。

```
onDeath {
    动作1
    动作2
    ...
}
```

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

**简写：** `burst 8`（等价于 `burst 8 { }`，全部默认值）。

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

沿弧线均匀分布粒子。弧度默认 `6.283`（2×PI，即整圆），也支持 `Math.PI`（半圆）：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `(弧度)` | number / `Math.PI` | `6.283`（整圆） | 弧跨度。写数字（如 `3.1416` = 半圆），也可写 `Math.PI`（半圆）；整圆用 `6.283` 或省略括号 |
| `color` | string / `inherit` | `inherit` | 子粒子颜色 |
| `life` | number | 600 | 子粒子存活时间 (ms) |

**简写：** `arc 6`（全圆 6 粒子，全部默认值）。

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

**简写：** `spiral 12`（1 圈 12 粒子，全部默认值）。

---

## 值类型

### 数字

```
size = 340
life = 1200
density = 0.8
```

支持整数、浮点数和科学计数法（如 `1.5e3`）。

### 字符串

```
name = "双环"
color = "#ff0043"
glitter = "light"
```

用双引号包裹，支持转义字符 `\\`。参数名、关键词（`firework`、`onDeath`、`burst`、`flash`、`arc`、`spiral`）不需要引号。

颜色十六进制值 `#rrggbb` 不用加引号，解析器自动识别为字符串。

### 颜色列表

```
color = [#ff0043, #1e7fff, #14fc56]
```

方括号内逗号分隔，每个颜色不用加引号。

### 布尔

```
ring = true
pistil = false
```

小写 `true` / `false`。

### 内置值

| 值 | 可用于 | 含义 |
|------|--------|------|
| `random` | `color` | 随机选取颜色 |
| `inherit` | `burst.color` / `arc.color` / `spiral.color` | 继承死亡星点自身的颜色 |

### 标识符

参数名和关键词支持中文（Unicode 汉字范围），如 `名字 = "测试"`。

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

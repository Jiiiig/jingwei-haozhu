# workflow_sunshine — 日照采光分析子工作流

> 「经纬上的好好住」三大维度之一：用真实地理坐标 + 太阳高度角公式计算日照采光评级。

![workflow_sunshine 画布全景](workflows/sunshine-canvas.png)

## 流程结构

```
开始（6 项参数）
   ├─→ poi_to_geocode（高德地理编码插件：地址 → 经纬度）─→ location ─┐
   └──────────────────────────────────────────────────────────────┼─→ 代码（太阳高度角与日照计算）─→ 大模型（生成日照分析报告）─→ 结束
```

## 开始节点 — 输入参数

| 变量名 | 类型 | 必填 | 含义 |
|---|---|---|---|
| city | String | ✅ | 城市名 |
| floor | String | ✅ | 楼层 |
| building_gap | String | ✅ | 楼间距（米） |
| south_build_height | String | ✅ | 南侧楼高（米） |
| orientation | String | ✅ | 朝向 |
| house_addr | String | ✅ | 房源地址 |

![开始节点](workflows/sunshine-start-node.png)

## 节点详解

### ① poi_to_geocode（高德地理编码插件）

把结构化地址转换为高德经纬度坐标，输入 `address ← house_addr`、`city`，输出区县级地理信息与坐标（`data` 数组：city / district / street / township / formatted_address 等）。

![地理编码节点](workflows/sunshine-geocode-node.png)

### ② 代码节点 — 太阳高度角计算（核心算法）

输入：`location`（来自地理编码）、`floor`、`building_gap`、`south_build_height`、`orientation`、`city`。

从截图可见的核心逻辑：

```javascript
// 3. 太阳高度角计算（冬至 / 夏至）
const deltaWinter = -23.44;   // 冬至太阳直射点纬度（南回归线）
const deltaSummer = 23.44;    // 夏至太阳直射点纬度（北回归线）

const hWinter = 90 - Math.abs(phi - deltaWinter);  // 冬至正午太阳高度角
const hSummer = 90 - Math.abs(phi - deltaSummer);  // 夏至正午太阳高度角
```

即经典公式 **h = 90° − |当地纬度 φ − 太阳直射点纬度 δ|**，取冬至（最不利工况）与夏至（最有利工况）两个极端日期分别计算。

📄 **完整源码**：[`workflows/code/sunshine-calc.js`](code/sunshine-calc.js)

算法要点：

- **遮挡判定**：`南侧楼高 ÷ 楼间距 > tan(太阳高度角)` 即判定被遮挡（几何投影关系）
- **日照时长**：被遮挡 1 小时起步，按楼层每 30 层递增约 2 小时；未遮挡 4 小时起步（冬）/ 6 小时起步（夏）
- **采光星级**：按冬至日照时长分档（≥5h 五星 / ≥3h 四星 / 其余三星）
- **西晒评分**：按朝向打 0-100 分（西/西南/西北 = 80，南/东南 = 20）
- **健壮性**：入参全部带默认值防崩溃；经纬度解析失败时默认北纬 30°；返回对象全用英文变量名（解决 Coze `ret: null` 问题）

输出变量一览：

| 输出 | 含义 |
|---|---|
| `winter_altitude` / `summer_altitude` | 冬至 / 夏至正午太阳高度角 |
| `latitude` | 当地纬度（由地址编码反查） |
| `tan_winter` | 冬至太阳高度角正切值（用于遮挡计算） |
| `blocking_ratio` | 南侧楼房的遮挡比例 |
| `is_blocked` | 是否被遮挡（Boolean） |
| `winter_hours` / `summer_hours` | 冬至 / 夏至有效日照时长 |
| `star_level` | 日照采光星级评级 |
| `west_score` | 西晒评分 |
| `orientation` / `floor` | 透传参数（供报告引用） |

![代码节点输入](workflows/sunshine-code-node.png)
![代码节点输出](workflows/sunshine-code-output.png)

### ③ 大模型节点

完整提示词见 [`workflows/prompts/sunshine-report-prompt.md`](prompts/sunshine-report-prompt.md)；节点输入为代码节点的 12 个变量（截图：[sunshine-llm-node.png](../workflows/sunshine-llm-node.png)）。

输入 `winter_altitude`、`summer_altitude`、`sunshine_report` 等，模型 豆包 2.0 pro，把计算结果翻译成人人能懂的日照采光分析报告。

## 设计亮点

1. **真实地理计算，不是拍脑袋**：地址 → 经纬度 → 纬度代入天文公式，结论有物理依据
2. **选对极端工况**：冬至日照最差（买房最该关心的场景）、夏至最旺，两端夹逼出全年区间
3. **量化到可解释指标**：遮挡比例、日照小时数、星级、西晒分——每个结论都能追溯到数字
4. **LSP 原则**：代码节点负责确定性计算，大模型只负责"把数字讲成人话"

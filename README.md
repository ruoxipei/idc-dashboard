# IDC PRC 智能手机出货量 数据看板

## 📁 文件结构
```
dashboard/
├── dashboard.html       # 看板主页面
├── dashboard.js         # 主逻辑（不需要改）
├── data/
│   ├── latest.json      # 当前显示的数据（自动指向最新）
│   ├── data_2026-Apr.json   # 历史快照
│   ├── data_2026-Mar.json
│   └── ...
└── README.md            # 本文档
```

## 🚀 月度刷新流程（你只需 2 步）

### Step 1：把新 Excel 给我
```
我收到 IDC PRC 2026 May-Preliminary 0524.xlsx，请帮我刷新看板
```

我会自动：
- 用 `build_data.js` 把 Excel 转成 `data_2026-May.json`
- 同步覆盖 `data/latest.json`（看板默认加载的）
- 把上一期的 `data_2026-Apr.json` 保留作历史快照

### Step 2：刷新浏览器
打开 `http://localhost:8888/dashboard.html` → 数据自动更新 ✅

## 🎮 交互功能清单

### 全局筛选器（顶栏）
| 控件 | 作用 |
|---|---|
| 厂商气泡 | 多选/取消，所有图表联动 |
| 时间范围 | 近 3/6/12/24 月、全部、仅 Q1 |
| 基准对比 | YoY / MoM / QoQ |
| 重置按钮 | 一键回到默认 |

### 5 个 Tab
1. **总览** — 8 张 KPI 卡 + 月度堆叠图 + 当期份额饼图 + TOP10 机型条形 + 数据明细表
2. **厂商深钻** — 月度趋势对比 / $500+ 高端段份额演变 / 每个厂商 TOP10 / 价格段堆叠
3. **机型分析** — 机型搜索 + 勾选 ≤6 个机型对比 M0~M11 生命周期 / HMOVR 旗舰代际对比
4. **价格段 & 高端化** — 全市场 / 按厂商切换 / $500+ 演变 / 价格段份额变化明细
5. **鸿蒙专题** — KPI 三卡 + Next 单/双框/Android 月度堆叠 + 单框占比折线 + 系列累计排行

### 通用功能
- 📷 任何图表右上角"PNG"按钮 → 下载 1400×700 高清图
- 📊 表格右上角"Excel"按钮 → 导出当前期数据
- 📂 顶部"加载本地数据"按钮 → 读取本地 JSON（离线分发场景）
- 拖拽 .json 文件到任意位置 → 自动加载

## 🛠️ 本地启动

```powershell
cd dashboard
npx http-server . -p 8888 -c-1
```
浏览器打开：`http://localhost:8888/dashboard.html`

## 📊 数据口径
- 数据源：`总出货量` sheet（权威口径，含华为子品牌合并）
- 华为：含 Wiko / China Telecom / Hi nova / China Mobile / U-Magic / TD-Tech
- OPPO：含 OnePlus / realme
- vivo：含 iQOO
- HMOVR = 华为 + 小米 + OPPO + vivo + 荣耀

## 🐛 已知限制
1. 浏览器需联网加载 plotly.js（首次加载约 2~3 秒）
2. 数据 ~290 KB，加载延迟 < 1 秒
3. 切换厂商筛选会重新渲染所有图（无动画过渡）
4. 单页面 SPA，刷新会重置筛选状态（除厂商默认配置外）

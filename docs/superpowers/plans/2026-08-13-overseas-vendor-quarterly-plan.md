# 海外厂商季度出货 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用公开全球出货量减去项目内准确中国出货量，交付 25Q1–26Q2 八家厂商海外出货量与 YoY，并同步网页和 Excel。

**Architecture:** `data/overseas_2026Q2.json` 作为网页与工作簿共同事实源，逐季度记录全球量、国内量、来源 URL 和来源等级；海外量与 YoY 均由公式计算。网页新增固定六季度明细表，工作簿保留全球、国内、海外和来源四层审计信息。

**Tech Stack:** HTML、原生 JavaScript、JSON、Plotly、SheetJS（网页下载）、`@oai/artifact-tool`（最终 Excel）。

## Global Constraints

- 海外 = 公开全球出货量 - 用户确认准确的中国出货量。
- 期间固定为 25Q1、25Q2、25Q3、25Q4、26Q1、26Q2。
- IDC 官方公开表优先；非 Top 5 公开新闻引用需标明来源等级。
- 估算值不得标成 IDC 官方直接海外数据。
- 页面与最终 Excel 必须从同一数据文件生成并通过逐项核对。

---

### Task 1: 公开来源台账与口径统一

**Files:**
- Modify: `data/overseas_2026Q2.json`

**Interfaces:**
- Consumes: IDC 官方季度新闻稿、公开新闻引用、`brandChinaQuarterly`
- Produces: `brandQuarterly`、`brandQuarterlySource`、`globalQuarterly`

- [ ] **Step 1:** 收集六个季度全球 Top 5 官方表及其修订状态。
- [ ] **Step 2:** 对 Honor、Huawei、Transsion 查找可追溯公开绝对值；仅有增速时保留估算标识。
- [ ] **Step 3:** 统一 OPPO/realme、Huawei/Wiko 等厂商归属，避免同期口径错配。
- [ ] **Step 4:** 写入来源 URL、发布日期、官方/媒体引用/估算等级。
- [ ] **Step 5:** 运行 JSON 解析和季度完整性检查，预期六季度八厂商均有值或明确缺失理由。

### Task 2: 海外计算与回归校验

**Files:**
- Create: `scripts/check_overseas_data.mjs`
- Modify: `data/overseas_2026Q2.json`

**Interfaces:**
- Consumes: `brandQuarterly[brand][quarter]`、`brandChinaQuarterly[brand][quarter]`
- Produces: 逐季度海外量和 YoY 校验报告

- [ ] **Step 1:** 编写断言：海外量等于全球量减国内量，误差不超过 0.01M。
- [ ] **Step 2:** 编写断言：25Q1–26Q2 每个 YoY 使用前一年同季度基数。
- [ ] **Step 3:** 编写断言：厂商全球量、国内量、海外量均非负，且国内量不大于全球量。
- [ ] **Step 4:** 运行校验脚本并修正所有失败项。
- [ ] **Step 5:** 提交数据与校验脚本。

### Task 3: 网页六季度厂商明细

**Files:**
- Modify: `dashboard.html`
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: Task 1 的统一 JSON
- Produces: `overseasVendorQuarterlyTbl` 六季度宽表及网页 Excel 下载入口

- [ ] **Step 1:** 在海外拆分章节加入八厂商六季度“出货量/YoY”明细表容器。
- [ ] **Step 2:** 实现 `renderOverseasVendorQuarterlyTable()`，每季度两列，正负 YoY 着色。
- [ ] **Step 3:** 增加来源等级与计算口径脚注，避免“IDC官方直接海外”误读。
- [ ] **Step 4:** 保持移动端横向滚动、表头冻结和现有视觉语言。
- [ ] **Step 5:** 运行本地服务并检查控制台、表格行列数和关键数值。

### Task 4: 最终 Excel

**Files:**
- Create: `scripts/build_overseas_workbook.mjs`
- Create: `outputs/019ffa1b-3225-7383-9cb3-2dc07858f029/IDC海外手机出货_25Q1-26Q2.xlsx`

**Interfaces:**
- Consumes: Task 1 的统一 JSON
- Produces: 三张表 `海外出货明细`、`计算底稿`、`来源说明`

- [ ] **Step 1:** 用 `@oai/artifact-tool` 创建公式驱动工作簿。
- [ ] **Step 2:** 在底稿表写全球和国内输入，海外与 YoY 使用公式。
- [ ] **Step 3:** 在明细表按厂商横向展示六季度出货量与 YoY，并冻结表头与厂商列。
- [ ] **Step 4:** 在来源表记录 URL、来源层级、日期和口径备注。
- [ ] **Step 5:** 检查关键区域、扫描公式错误、渲染所有工作表并修复裁切。
- [ ] **Step 6:** 导出唯一最终工作簿。

### Task 5: 发布验证

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–4 的网页与工作簿
- Produces: 已验证的 GitHub Pages 更新

- [ ] **Step 1:** 运行 JSON、JavaScript 语法和数据断言。
- [ ] **Step 2:** 检查 Git diff 仅包含本次任务文件。
- [ ] **Step 3:** 提交并推送现有 `main`，触发 GitHub Pages。
- [ ] **Step 4:** 重新读取线上页面确认新表和数据口径已发布。

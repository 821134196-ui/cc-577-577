# 冷链保温箱清洗批次与门店交接系统

配送中心回收各门店保温箱 → 登记箱况 → 清洗消毒批次 → 质检放行 → 跨店调拨出库 → 门店签收/拒收，
全流程一箱一码可追溯。技术栈：**TypeScript + NestJS + Prisma + SQLite**（后端）、**React + Vite**（前端）。

## 一条命令启动

```bash
npm install        # 首次：安装依赖并自动创建 SQLite 数据库
npm start          # 同时启动后端(:3000)和前端(:5173)
```

- 前端界面：http://localhost:5173
- 后端 API：http://localhost:3000/api
- 首次启动自动写入演示数据（3 家门店、4 名员工、BX-1001~1005 五只箱）
- 界面右上角「♻️ 重置演示数据」可随时回到初始状态

### 命令行演示（另开一个终端）

```bash
npm run demo       # 自动跑完整业务规则剧本并打印 ✓/✗ 结果
```

## 业务规则（均已在后端事务 + 数据库唯一约束中实现）

| 规则 | 实现位置 |
|---|---|
| 一箱一码，重复扫描/建档不会多出一只箱 | `Box.code @unique`；建档、入批 `@@unique([batchId, boxId])` |
| 同一箱号调拨签收期间只能有一个有效交接 | `Handover.activeBoxId @unique`，签收/拒收后置空 |
| 未通过质检不得出库 | 出库仅允许 `AVAILABLE` 状态，否则 409 拦截并产生 ERROR 通知 |
| 清洗员不能质检自己的批次 | 质检员 ≠ 批次清洗员，否则 403（岗位回避） |
| 箱体破裂 → 报废去向，不进清洗 | 回收登记 `DAMAGED` 直接 SCRAP，报废箱禁止入批 |
| 清洗剂残留/未干燥 → 隔离 + 返洗去向 | 质检不合格记 `Disposition(REWASH)`，状态 QUARANTINED |
| 门店拒收 → 退回 DC 去向留痕 | 交接关闭、箱子回 RETURNED，可重新清洗质检 |
| 位置唯一：在途箱不能被重复回收 | 有 `activeHandoverId` 时拒绝回收登记 |
| 箱子详情可追溯 | 上次使用门店、最近清洗批次与质检结论、本次交接、位置轨迹、异常去向 |

## 箱子状态机

```
IN_USE(门店) ──回收──▶ RETURNED(DC) ──入批──▶ WASHING ──质检──▶ AVAILABLE ──出库──▶ IN_TRANSIT
                          ▲                       └─不合格─▶ QUARANTINED ──返洗──┘      │
                          │                     破裂──▶ SCRAPPED                         ├─签收─▶ AT_STORE
                          └──────────────── 拒收退回 DC ◀───────────────────────────────┘
```

## 页面说明

- **总览**：合格/在途/隔离箱数、在途交接、各店箱量、最新通知、异常台账
- **箱号档案**：扫箱号查询箱子详情（上次使用门店、清洗质检结果、本次交接、位置轨迹、处理去向）
- **门店回收**：扫箱号 + 门店 + 箱况（完好/污渍/破裂）
- **清洗质检**：建消毒批次 → 扫码入批（显示当前扫码批次）→ 质检员勾选「无残留 / 已干燥 / 箱体完好」
- **配送交接**：扫合格箱出库、门店签收或填原因拒收
- **异常去向**：破裂报废、残留返洗、拒收退回 DC 的统一台账
- **通知中心（🔔）**：本地模拟通知，出库被拦截为红色 ERROR，质检不合格/拒收为 WARN

扫码与通知均为本地模拟：界面中带绿色脉冲点的输入框即扫码器（回车或点「扫码」触发）。

## 接口一览

```
POST /api/boxes                    新箱建档（重复箱号 409）
GET  /api/boxes?code=&status=      箱号查询
GET  /api/boxes/:id                箱子详情（清洗质检/交接/轨迹/去向）
POST /api/returns                  门店回收登记
POST /api/wash-batches             建清洗批次
POST /api/wash-batches/:id/scan    扫箱入批（重复扫描 409）
POST /api/wash-batches/:id/finish  封批
POST /api/inspections              质检（自检 403，不合格隔离）
POST /api/handovers                出库（不合格/在途 409 拦截）
POST /api/handovers/:id/sign       门店签收
POST /api/handovers/:id/reject     门店拒收（原因必填）
GET  /api/dispositions             异常处理去向台账
GET  /api/notifications            通知列表
POST /api/admin/reset              重置演示数据
```

## 目录结构

```
backend/   NestJS（flow.service.ts 为全部业务规则，prisma/schema.prisma 为数据模型）
frontend/  React（src/pages 各业务页面，src/api.ts 接口封装）
scripts/   demo.mjs 端到端演示剧本
```

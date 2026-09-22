# GitHub 企业客户课程 — 知识概览与备课速查

> 客户需求来源：TW 客户 GitHub 课程安排（Migration Project 配套培训）  
> 目标：帮助讲师快速掌握授课要点，匹配客户三层需求。

---

## 一、客户需求总览

| 课程模块 | 目标学员 | 核心诉求 | 关键交付形式 |
|---|---|---|---|
| 1. GitHub 搬迁实战工作坊 | GitHub Enterprise 管理员、开发团队 | GitLab → GitHub 数据迁移 + 权限架构映射 | Hands-on Labs，倾向脚本化/一键完成 |
| 2. 开发全员：GitHub 平台操作 | 开发团队 | 术语对照、PR 审查、分支保护、Projects 看板 | 观念转换 + 日常操作实务 |
| 3. 进阶功能：GitHub Actions 与企业级资安 | DevOps、资安团队 | CI/CD、Self-hosted Runners、Dependabot / Secret Scanning / CodeQL | 企业级部署与安全合规 |

---

## 二、模块一：GitHub 搬迁实战工作坊

### 2.1 授课目标
让学员能够规划并执行一次从 GitLab 到 GitHub 的仓库迁移，重点保留历史记录、Issue/PR/MR 数据、标签与权限关系。

### 2.2 核心知识点

#### A. 迁移范围与数据映射

| GitLab 概念 | GitHub 对应 | 备注 |
|---|---|---|
| Group | Organization | 顶层组织单元 |
| Subgroup | — | GitHub 无 Subgroup，需用 Teams 或 Org 层级重构 |
| Project | Repository | 仓库 |
| Merge Request (MR) | Pull Request (PR) | 概念一致，术语不同 |
| Issue | Issue | 概念一致 |
| Milestone | Milestone | 概念一致 |
| Label | Label | 概念一致，颜色可保留 |
| Member / Access Level | Member / Role + Team membership | GitHub 用 Organization roles + Repository roles |
| GitLab CI/CD | GitHub Actions | 需迁移或重建 |
| Wiki | Wiki | 可迁移 |
| Snippets | Gist / Repository files | 无直接对应 |

#### B. 迁移工具选择

| 场景 | 推荐工具 | 说明 |
|---|---|---|
| 单个/少量仓库 + 完整 Git 历史 | `git clone --mirror` + `git push --mirror` | 最稳妥，保留 commit、branch、tag |
| 大量仓库批量迁移 | GitHub Enterprise Importer (GEI) | 官方推荐，支持仓库、Issue、PR、label、wiki、milestones |
| GitLab CI → GitHub Actions | 手动重写 + `actions-importer`（预览/CLI） | 语法不能直接复制，需概念映射 |
| Issue/PR/MR 元数据迁移 | GEI / 第三方脚本（GitHub API + GitLab API） | MR 会转成 PR，评论与标签可保留 |

#### C. 权限架构映射：GitLab → GitHub

**GitLab 权限模型**
- Group / Subgroup / Project 三级
- Access Level：Guest → Reporter → Developer → Maintainer → Owner
- 可通过 Group 继承，也可在 Project 单独设权

**GitHub 权限模型**
- Organization → Teams → Repository
- Organization roles：Owner / Member / Moderator / Billing manager / Outside collaborator
- Team permissions：Read / Triage / Write / Maintain / Admin
- Repository access：通过 Team 或 Direct member 分配
- **Base permissions**：Org 级别可设默认私有仓库权限（Read / Write / Admin / None）

**映射建议**
| GitLab | GitHub 建议 |
|---|---|
| Group Owner | Organization Owner |
| Group Maintainer | Organization Owner / 特定 Team Maintainer |
| Project Maintainer | Team Admin on repo |
| Developer | Team Write / Maintain |
| Reporter | Team Triage / Read |
| Guest | Outside collaborator / Triage |
| Subgroup | 拆分为独立 Team 或利用 Team 嵌套（GitHub Teams 支持嵌套） |

### 2.3 Hands-on Lab 设计建议

**Lab 1：镜像迁移一个仓库**
1. 在 GitLab 准备示例仓库（含分支、tag、issue、label）
2. `git clone --mirror <gitlab-url>`
3. 在 GitHub 创建空仓库
4. `git push --mirror <github-url>`
5. 验证 branch、tag、commit 历史完整

**Lab 2：使用 GitHub Enterprise Importer 迁移**
1. 配置 GEI CLI / PAT（`repo`、`read:org`、`workflow` 等 scope）
2. 安装 GitLab 专用扩展 `gh extension install github/gh-gl2gh`，执行 `gh gl2gh migrate-repo` 或先用 `gh gl2gh generate-script` 生成迁移脚本。
3. 验证仓库、Issue、PR、label、wiki 迁移结果
4. 讨论迁移后的 URL 重定向策略

**Lab 3：权限架构重构**
1. 在 GitHub Org 下创建 Teams（映射原 GitLab Group/Subgroup）
2. 配置 Team 权限层级
3. 将仓库分配给 Team
4. 邀请成员并验证访问控制

### 2.4 授课重点提醒
- **MR 与 PR 的对应关系**：MR 在 GitHub 里叫 PR，但工作流细节不同（如 GitHub 没有 MR 的 "Draft" 状态，用 Draft PR）
- **Subgroup 是最大重构点**：GitHub 没有 Subgroup，必须提前设计 Team 结构
- **CI/CD 不自动迁移**：GitHub Actions 需重写，提前告知客户这是独立工作
- **重定向策略**：迁移后旧 GitLab URL 如何处理？DNS？GitLab 只读归档？

---

## 三、模块二：开发全员 — GitHub 平台操作

### 3.1 授课目标
让开发团队从 GitLab 工作流平滑切换到 GitHub 工作流，掌握日常协作、代码审查与项目管理。

### 3.2 核心知识点

#### A. 术语与观念对照

| GitLab | GitHub | 差异说明 |
|---|---|---|
| Merge Request (MR) | Pull Request (PR) | 功能等价，UI/流程不同 |
| Fork | Fork | 概念一致 |
| CI/CD Pipelines | GitHub Actions / Workflows | YAML 语法完全不同 |
| Runner | Runner | GitHub 有 GitHub-hosted 与 Self-hosted |
| Epic | — | GitHub 无 Epic，可用 Milestone / Project / Issue 层级替代 |
| Subgroup | — | GitHub 用 Team / Org 架构 |
| Code Review | Code Review | GitHub 的 PR Review 更强调 "Request changes" / "Approve" |
| Protected Branch | Branch Protection Rules | GitHub 规则更细（status check、signed commits、conversation resolution） |
| Issue Board | GitHub Projects | GitHub Projects 是通用看板，可跨仓库 |
| Snippets | Gist | 使用场景不同 |
| Wiki | Wiki | 均可作为仓库使用 |

#### B. Pull Request 代码审查机制

**GitHub PR 工作流**
1. 从主分支切出 feature branch
2. 提交 commit（建议遵循 conventional commits）
3. Push branch 并创建 PR
4. 指定 Reviewers
5. Reviewer 可：Comment / Approve / Request changes
6. 满足分支保护规则后 Merge（可配置 squash / rebase / merge commit）

**关键功能**
- **Draft PR**：未完成的工作，避免误合并
- **Suggested changes**：Reviewer 可直接建议代码修改，作者一键接受
- **Required reviewers**：可设置最少审查人数
- **CODEOWNERS**：按路径自动指定审查人
- **Status checks**：合并前必须通过 CI / 自动化检查
- **Merge queue**（Enterprise）：批量、安全合并

#### C. 分支保护规则（Branch Protection Rules）

常见规则配置：
- Require a pull request before merging
- Require approvals（如 1-2 人）
- Dismiss stale PR approvals when new commits are pushed
- Require status checks to pass（如 CI build、lint、test）
- Require conversation resolution before merging
- Require signed commits
- Include administrators（规则也适用于管理员）
- Restrict pushes that create files（限制文件推送）

#### D. GitHub Projects 专案看板管理

**Projects (new)**
- 基于表格/看板/时间线视图
- 可跨仓库聚合 Issue 和 PR
- 支持自定义字段（状态、优先级、负责人、迭代等）
- 可设置自动工作流（如 PR merged → 状态改为 Done）
- 与 Issues / PR 双向关联

**与 GitLab Issue Board 的差异**
- GitHub Projects 更像一个独立的项目管理工具
- Issue label 可直接映射到看板列，也可使用自定义字段
- 支持 Iteration 字段进行 Sprint 管理

### 3.3 Hands-on Lab 设计建议

**Lab 1：创建 PR 并完成审查**
1. Fork 或 clone 练习仓库
2. 创建 feature branch
3. 修改代码并提交 PR
4. 学员互相 Review：Comment + Request changes + Approve
5. 配置分支保护规则，尝试直接 push 到 main，观察被阻止

**Lab 2：配置分支保护 + CODEOWNERS**
1. 在仓库根目录创建 `CODEOWNERS`
2. 设置 `*.js @frontend-team`
3. 开启分支保护：require 1 approval + status checks
4. 验证非 CODEOWNERS 成员无法单独批准

**Lab 3：GitHub Projects 看板实战**
1. 创建 Org-level Project
2. 添加来自多个仓库的 Issue/PR
3. 设置自定义字段：优先级、状态、迭代
4. 创建自动化规则：PR merged → Done

### 3.4 授课重点提醒
- **观念转换**：GitLab 用户习惯在 MR 里完成所有讨论；GitHub 更强调 Issue + PR 分离
- **Review 文化**：Request changes 是常用状态，不要害怕使用
- **分支保护是强制合规入口**：企业客户通常最关注这一点
- **Projects 新版 vs 旧版**：确认客户使用的是新版 Projects（表格视图），旧版已逐步淘汰

---

## 四、模块三：GitHub Actions 与企业级资安

### 4.1 授课目标
让 DevOps 与资安团队掌握 GitHub Actions CI/CD 设计、Runner 部署以及 GitHub 原生安全能力。

### 4.2 核心知识点

#### A. GitHub Actions CI/CD Pipeline 设计

**核心概念**
- **Workflow**：YAML 文件，位于 `.github/workflows/`
- **Event**：触发工作流的事件（push、pull_request、schedule、workflow_dispatch 等）
- **Job**：一组 steps，默认并行运行
- **Step**：单个命令或 action
- **Action**：可复用的任务单元，来自 Marketplace 或内部仓库
- **Runner**：执行 job 的计算环境
- **Artifact**：工作流产出的文件
- **Matrix**：多版本/多环境并行测试

**典型 Pipeline 结构**
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run build
```

**进阶特性**
- Reusable workflows（可复用工作流）
- Composite actions（组合 action）
- Environments + deployment protection rules（人工审批、timer）
- OIDC 云登录（无需长期密钥）
- Caching（actions/cache）
- Concurrency 控制

#### B. Self-hosted Runners 部署

**何时使用 Self-hosted**
- 需要访问内网资源
- 需要特定硬件/许可证
- 需要超大计算资源
- 安全合规要求代码不能离开企业网络

**部署要点**
- 支持 Linux、Windows、macOS、容器（如 Kubernetes）
- 注册 Runner：下载 GitHub Actions Runner → `./config.sh` → `./run.sh`
- Runner groups：按仓库/组织分组管理
- **安全隔离**：一个 Runner 只服务一个 job（`--ephemeral`）可降低横向移动风险
- 网络策略：Runner 只需出网访问 GitHub（api.github.com、github.com、*.actions.githubusercontent.com）
- 更新与维护：Runner 版本需定期更新

#### C. 企业级资安防护

**Dependabot**
- Dependabot alerts：检测依赖中的已知漏洞
- Dependabot security updates：自动发起修复 PR
- Dependabot version updates：自动更新依赖版本
- 配置 `.github/dependabot.yml`

**Secret Scanning**
- 自动扫描仓库中的敏感信息（token、密钥、密码模式）
- GitHub 默认启用 secret scanning alerts
- **Push protection**：阻止包含 secrets 的 push（付费/Enterprise 功能）
- 可配置自定义 patterns

**CodeQL 静态分析**
- 基于语义分析的代码安全扫描
- 支持多种语言（JavaScript、Python、Java、Go、C/C++、C#、Ruby 等）
- 通过 `github/codeql-action` 集成到 Actions
- 可识别 SQL 注入、XSS、不安全的反序列化等

**其他安全能力**
- **Dependency review**：在 PR 中提示依赖变化带来的漏洞
- **Security advisories**：仓库级别的安全公告
- **Security policy**：`SECURITY.md`
- **Audit log**：组织/企业级操作审计
- **SAML SSO + SCIM**：企业身份集成

### 4.3 Hands-on Lab 设计建议

**Lab 1：设计一个完整 CI/CD Workflow**
1. 创建 `.github/workflows/ci.yml`
2. 配置：PR 触发 → checkout → setup node → lint → test → build
3. 添加 matrix 策略测试多个 Node 版本
4. 上传 artifact

**Lab 2：部署 Self-hosted Runner**
1. 在 Org 设置中创建 Runner group
2. 在 Linux VM 上安装 runner
3. 注册并启动 ephemeral runner
4. 运行一个 workflow 验证使用 self-hosted runner

**Lab 3：启用 Dependabot + Secret Scanning + CodeQL**
1. 开启仓库的 Dependabot alerts 和 security updates
2. 创建 `.github/dependabot.yml`
3. 开启 secret scanning + push protection
4. 创建 `.github/workflows/codeql.yml`
5. 提交一个含 mock secret 的 commit，验证 push protection 拦截

### 4.4 授课重点提醒
- **Actions 的权限最小化**：默认 `GITHUB_TOKEN` 权限可配置，建议开启 `permissions` 显式声明
- **第三方 Action 风险**：建议 pinned to commit SHA，避免 tag 被篡改
- **Self-hosted Runner 是安全敏感组件**：必须隔离、 ephemeral、最小化网络暴露
- **CodeQL 首次扫描较慢**：提前告知客户需要完整 build
- **Secret Scanning 的 push protection 是付费功能**：确认客户授权（GitHub Advanced Security 或 Enterprise）

---

## 五、快速备课清单

### 5.1 课前必须掌握
- [ ] 熟悉 GitHub Enterprise Cloud / Enterprise Server 的 Org 设置界面
- [ ] 能演示 `git clone --mirror` + `git push --mirror`
- [ ] 能演示 GitHub Enterprise Importer 基本命令
- [ ] 能解释 GitLab Subgroup 到 GitHub Team 的映射策略
- [ ] 能配置并演示 Branch Protection Rules + CODEOWNERS
- [ ] 能写一段完整的 GitHub Actions workflow
- [ ] 能解释 Self-hosted Runner 的安全部署要点
- [ ] 能启用并演示 Dependabot、Secret Scanning、CodeQL

### 5.2 课前 Demo 环境准备
- [ ] 准备一个示例 GitLab 项目（含 Issue、MR、Label、Milestone、CI）
- [ ] 准备一个目标 GitHub Organization（可沙盒）
- [ ] 准备 1-2 个练习仓库供学员操作 PR / Branch Protection
- [ ] 准备一个 Org-level Project 看板模板
- [ ] 准备一个 Self-hosted Runner 演示机（或虚拟机）
- [ ] 确认 GitHub Advanced Security 功能已授权（用于 secret scanning push protection / CodeQL）

### 5.3 常见客户问题与应对

| 客户问题 | 应对要点 |
|---|---|
| "我们的 GitLab CI 很多，能不能直接搬过去？" | 不能直接搬，GitHub Actions YAML 语法不同。可用 `actions-importer` 辅助转换，但需人工复核。 |
| "GitHub 能不能做到 GitLab Subgroup 的效果？" | GitHub 没有 Subgroup，可用 Team 嵌套 + Org 权限分层实现类似效果。 |
| "迁移后旧链接怎么办？" | 建议 GitLab 设为只读归档，内部文档更新链接；如需无缝，可用反向代理或 DNS 重定向。 |
| "GitHub Actions 安全吗？用第三方 action 会不会有风险？" | 建议 pin SHA、审查 action 源码、使用 GitHub 官方或受信任发布者、限制 `GITHUB_TOKEN` 权限。 |
| "Self-hosted Runner 要开放哪些端口？" | Runner 是出网访问 GitHub，入网不需要开放。关键是隔离 job、使用 ephemeral runner。 |
| "CodeQL 能不能替代我们现有的 SAST 工具？" | CodeQL 是强补充，但企业通常不会完全替换现有 SAST。建议作为 GitHub 原生能力集成到 PR 流程。 |

---

## 六、推荐学习资源

- GitHub Docs：Migrating from GitLab to GitHub
- GitHub Enterprise Importer 官方文档
- GitHub Actions 官方文档
- GitHub Advanced Security 白皮书
- Pro Git（第 2 版）—— 迁移与权限基础

---

*整理时间：2026-09-01*  
*用途：TW 客户 GitHub 课程售前与授课准备*

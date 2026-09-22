# GitLab → GitHub 迁移课程 Lab

本目录包含可直接用于课程演练的完整操作手册和练习项目资产。迁移主路径已改为 GitHub Codespaces，避免在 Windows PowerShell 中因路径、隐藏文件和环境变量作用域产生差异。

- `LAB-GitLab-to-GitHub-Migration.md`：Codespaces 中从 GitLab 创建项目、盘点、冻结、`gh gl2gh` 元数据迁移、CI/CD 重写、权限/Ruleset、Projects、安全能力到切换验收的逐步手册。
- `.devcontainer/devcontainer.json`：提供 GitHub CLI、Node.js、Docker-in-Docker 和 `jq`，用于 Codespaces 及可选的 Actions Importer Lab。
- `lab-assets\migration-demo-orders\`：包含源码、测试、依赖、锁定文件、Dockerfile、GitLab CI、CODEOWNERS、贡献规范、安全策略、Runbook 和 changelog 的练习项目。
- `lab-assets\github-workflows\`：迁移后的 CI 和 CodeQL 工作流模板。
- `lab-assets\dependabot.yml`：Dependabot 配置模板。

本地预演：

```powershell
Set-Location .\lab-assets\migration-demo-orders
npm ci
npm run lint
npm test
npm run build
```

真实 GitLab/GitHub 端到端迁移需要 GitHub Enterprise Cloud 组织、GitLab 项目和授权 token；手册中所有 token、组织名和项目 URL 都必须替换为现场值，严禁提交真实凭据。GitLab 迁移使用 `gh gl2gh`，`gh gei` 不用于本 Lab。

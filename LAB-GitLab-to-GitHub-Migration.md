# GitLab → GitHub 迁移实战 Lab（GitHub Codespaces 版）

> **版本**：2026-09  
> **主路径**：GitHub Codespaces + `gh gl2gh` + GitHub Enterprise Cloud  
> **辅助路径**：`gh actions-importer` 将 GitLab CI 生成 GitHub Actions 初稿  
> **目标**：学员在一个 Codespace 中完成 GitLab 项目准备、迁移前盘点、Git 历史和 GitLab 元数据迁移、CI/CD 重写、权限重构、PR/Projects/安全能力配置及最终验收。

本手册只使用 Bash、Git、GitHub CLI 和 GitLab REST API；不要求在本地 Windows PowerShell 中执行命令。每个关键阶段都有 `PASS` 检查，未通过时必须停在该阶段，不要继续迁移。

---

## 1. 先确认迁移边界

### 1.1 工具名称不要混淆

`github/gh-gei` 是 GitHub Enterprise Importer CLI 的源码仓库，发布多个 GitHub CLI 扩展：

| 来源 | 扩展 | 用途 |
|---|---|---|
| GitHub → GitHub | `gh gei` | GitHub 产品之间迁移 |
| GitLab → GitHub | `gh gl2gh` | 本 Lab 使用 |
| Azure DevOps → GitHub | `gh ado2gh` | 不在本 Lab 使用 |

GitLab 迁移安装命令：

```bash
gh extension install github/gh-gl2gh
gh extension upgrade github/gh-gl2gh
gh gl2gh --help
```

不要执行：

```bash
gh extension install github/gh-gei
gh gei migrate-repo ...
```

`gh gei` 不是本 Lab 的 GitLab 命令。

### 1.2 目标平台要求

`gh gl2gh` 的目标是 **GitHub Enterprise Cloud**（包括有数据驻留的 `ghe.com` 租户），不是 GitHub Enterprise Server，也不是普通 GitHub Free 个人仓库。

目标组织必须提前准备：

- GitHub Enterprise Cloud 组织。
- 迁移执行者的组织 Owner 或 Migrator 权限。
- GitHub classic PAT，按组织角色授予 GEI 所需 scope；通常包括 `repo`、`workflow`，Owner 场景还需要 `admin:org`，Migrator 场景需要 `read:org`。
- GitLab PAT：`api`、`read_repository`。
- GitLab 项目可以导出，且 GitLab 版本属于 GEI 支持范围。

### 1.3 GEI 与镜像迁移的职责

| 方式 | 负责 | 不负责 |
|---|---|---|
| `git clone --mirror` + `git push --mirror` | commit、branch、tag、Git refs | Issue、MR、评论、Label、Wiki、成员、CI |
| `gh gl2gh` | GEI 支持范围内的仓库和项目元数据 | GitLab Group 权限、成员、CI/CD 变量、Webhooks、Runner |
| `gh actions-importer` | 将 GitLab CI 转成 Actions 初稿 | 自动保证语义、安全和部署正确 |

GitLab CI、成员权限、Secrets、Environments、Rulesets、Projects 和安全策略都必须在 GitHub 侧重新配置。

---

## 2. 创建 Codespace

### 2.1 推荐方式

在培训用 GitHub Repository 中打开：

`Code → Codespaces → Create codespace on main`

建议选择：

- Region：距离学员最近的区域。
- Machine：2 core / 8 GB 起步。
- Repository：课程 Lab 仓库。

Codespace 终端默认是 Linux Bash。所有命令都在终端中执行，不要把 Markdown 中的命令复制到 PowerShell。

### 2.2 Codespace 基础检查

```bash
set -euo pipefail

printf 'user=%s\n' "$USER"
printf 'workspace=%s\n' "$PWD"
git --version
gh --version
node --version || true
docker --version || true
```

预期：

- `git` 可用。
- `gh` 可用且版本为当前 Codespaces 镜像提供的版本。
- Docker 只有在执行 Actions Importer 分支时才是必需的。

如果 `gh` 不存在：

```bash
type -a gh || true
```

重新创建 Codespace 时选择 GitHub 默认开发容器；不要在迁移窗口中随意从第三方脚本安装 CLI。

### 2.3 安装 GitLab API 辅助工具

本 Lab 使用 `curl` 和 `jq`。Codespaces 默认通常已有它们，先检查：

```bash
command -v curl
command -v jq
```

如果缺失：

```bash
sudo apt-get update
sudo apt-get install -y curl jq
```

---

## 3. 安全注入凭据

不要把 PAT 写入仓库、`.env`、Git remote URL、命令行参数、Issue、PR、日志或 shell 配置文件。推荐使用 **GitHub Codespaces Secrets** 持久保存密钥；密钥只会在 Codespace 运行时作为环境变量注入，不会写入仓库。临时演练也可以使用 `read -s`，但终端进程结束后必须重新注入。

### 3.1 GitHub 登录

普通 GitHub CLI 操作用 Codespace 的 device login：

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh auth setup-git
```

`gh auth status` 必须显示正确的 GitHub 用户和 `github.com`。

### 3.2 持久保存 Codespace 环境变量（推荐）

在浏览器打开 `https://github.com/settings/codespaces`，进入 **Secrets → New secret**，分别创建以下两个 Codespaces secret：

| Secret 名称 | 值 | 用途 |
|---|---|---|
| `GH_PAT` | GitHub GEI 所需的 classic PAT | `gh gl2gh` 身份验证 |
| `GITLAB_PAT` | GitLab PAT（`api` 或 `write_repository`，以及读取所需权限） | GitLab API、Git push、mirror clone |

创建 Secret 时，将 **Repository access** 限制为本实验仓库。不要选择把值写入仓库文件，也不要把值填写到 `devcontainer.json`。

也可以在当前 Codespace 中通过 GitHub CLI 保存，输入值不会出现在命令历史中：

```bash
read -rsp "GitHub GEI classic PAT: " GH_PAT
printf '\n'
printf '%s' "$GH_PAT" | gh secret set GH_PAT --app codespaces

read -rsp "GitLab PAT (api or write_repository): " GITLAB_PAT
printf '\n'
printf '%s' "$GITLAB_PAT" | gh secret set GITLAB_PAT --app codespaces
```

保存后必须 **重建或重新创建 Codespace**（VS Code 命令面板执行 `Codespaces: Rebuild Container`，或关闭后重新打开），新终端才会自动获得这两个环境变量。验证时只检查是否存在，不要输出值：

```bash
test -n "${GH_PAT:-}" && echo "PASS GH_PAT is set" || echo "FAIL GH_PAT is missing"
test -n "${GITLAB_PAT:-}" && echo "PASS GITLAB_PAT is set" || echo "FAIL GITLAB_PAT is missing"
```

> Codespaces Secret 只解决“终端重启后环境变量消失”；它不会修复权限不足、过期 PAT 或错误的 GitLab URL。若本手册代码块输出 `ERROR`，先修复错误，再重新执行该代码块。

### 3.3 当前终端临时注入（备用）

GEI 单独需要环境变量 `GH_PAT`。它必须是符合 GEI 要求的 GitHub classic PAT：

```bash
read -rsp "GitHub GEI classic PAT: " GH_PAT
printf '\n'
export GH_PAT
```

GitLab PAT：

```bash
read -rsp "GitLab PAT (api + read_repository): " GITLAB_PAT
printf '\n'
export GITLAB_PAT
```

检查变量是否存在但不输出值：

```bash
test -n "${GH_PAT:-}" && echo "PASS GH_PAT is set"
test -n "${GITLAB_PAT:-}" && echo "PASS GITLAB_PAT is set"
```

迁移完成后清理：

```bash
unset GH_PAT GITLAB_PAT
```

> 如果 PAT 曾经出现在截图、聊天、终端记录或 Git remote URL 中，必须先撤销再继续。

---

## 4. 设置本次 Lab 参数

只修改右侧值，不要删除引号。`GITLAB_GROUP` 是路径，**不是数字 Group ID**；`gh gl2gh` 会按路径处理它。

```bash
export GITLAB_SERVER_URL="https://gitlab.com"
export GITLAB_GROUP="training/migration"
export GITLAB_PROJECT="migration-demo-orders"
export GITHUB_ORG="contoso-training"
export GITHUB_REPO="migration-demo-orders"
export WORK="$HOME/migration-demo-orders"
export COURSE_ROOT="$(git rev-parse --show-toplevel)"

mkdir -p "$WORK"
cat > "$WORK/lab.env" <<'EOF'
# This file intentionally contains no token.
EOF
```

验证值：

```bash
case "$GITLAB_SERVER_URL" in
  https://gitlab.com|https://*.gitlab.*) ;;
  *) echo "FAIL: GITLAB_SERVER_URL must be an HTTPS URL"; exit 1 ;;
esac
test "$GITLAB_GROUP" != "training/migration" || echo "INFO: replace example group path if needed"
gh api "orgs/$GITHUB_ORG" --jq '.login + " " + (.id|tostring)'
```

`gh api` 成功且输出目标组织后，GitHub 组织名和权限可用。

---

## 5. 在 GitLab 创建练习项目

推荐先在 GitLab UI 创建 Group/Subgroup，避免把 Group ID 当作 Project ID：

1. 创建或选择 Group，例如 `training`。
2. 可选创建 Subgroup，例如 `migration`。
3. 复制页面上的完整路径，例如 `training/migration`。
4. 创建空的 Private Project，名称为 `migration-demo-orders`。
5. 不要初始化 README；本 Lab 稍后从 Codespace 推送。

### 5.1 用 API 确认 Group

先确认 PAT 可以读取 Group：

```bash
set -euo pipefail

GROUP_JSON="$WORK/group.json"
curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/groups/$(jq -rn --arg p "$GITLAB_GROUP" '$p|@uri')" \
  | tee "$GROUP_JSON" \
  | jq '{id, name, full_path, web_url}'
```

保存真实 Group ID，但创建项目时使用它，不要猜测：

```bash
export GITLAB_GROUP_ID="$(jq -er '.id|tostring' "$WORK/group.json")"
test "$(jq -er '.full_path' "$WORK/group.json")" = "$GITLAB_GROUP"
echo "PASS group id=$GITLAB_GROUP_ID path=$GITLAB_GROUP"
```

如果这里失败：

| 错误 | 原因 |
|---|---|
| `401` | PAT 无效或已撤销 |
| `403` | PAT 用户没有 Group 读取权限 |
| `404` | Group 路径错误，或 URL 编码不正确 |
| `full_path` 不一致 | 你使用了错误的顶层 Group/Subgroup 路径 |

不要进入下一步，直到这个检查通过。

### 5.2 用 API 创建空 Project

如果项目已经在 UI 创建，跳过本小节，改为查询项目：

```bash
PROJECT_JSON="$WORK/project.json"
curl --fail-with-body --silent --show-error \
  --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  --header "Content-Type: application/json" \
  --data "$(jq -n \
    --arg name "$GITLAB_PROJECT" \
    --arg path "$GITLAB_PROJECT" \
    --argjson namespace_id "$GITLAB_GROUP_ID" \
    '{name:$name,path:$path,namespace_id:$namespace_id,visibility:"private",initialize_with_readme:false}')" \
  "$GITLAB_SERVER_URL/api/v4/projects" \
  | tee "$PROJECT_JSON" \
  | jq '{id, path_with_namespace, http_url_to_repo, web_url}'
```

保存 Project ID 和 clone URL：

```bash
export GITLAB_PROJECT_ID="$(jq -er '.id|tostring' "$WORK/project.json")"
export GITLAB_REPO_URL="$(jq -er '.http_url_to_repo' "$WORK/project.json")"
echo "PASS project id=$GITLAB_PROJECT_ID"
```

如果 API 返回 `namespace is not valid`，不要重试同一个数字 ID；重新执行 5.1，并确认 `GITLAB_GROUP_ID` 来自当前 API 响应。

---

## 6. 准备包含日常开发信息的 GitLab 项目

### 6.1 从 Lab 资产复制到 Codespace

在课程 Lab 仓库根目录执行：

```bash
rm -rf "$WORK/source"
mkdir -p "$WORK/source"
cp -a lab-assets/migration-demo-orders/. "$WORK/source/"
cd "$WORK/source"
```

确认隐藏文件没有丢失：

```bash
test -f .gitlab-ci.yml
test -f .env.example
test -f Dockerfile
find . -maxdepth 3 -type f | sort
echo "PASS fixture files are present"
```

### 6.2 创建分支、Tag 和历史

```bash
git init -b main
git config user.name "Migration Lab Bot"
git config user.email "migration-lab@example.invalid"
git add .
git commit -m "chore: initialize migration lab project"
git tag -a v0.1.0 -m "Initial lab release"

git switch -c develop
printf '\n## Unreleased\n- Prepare GitLab to GitHub migration lab.\n' >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: prepare unreleased changelog"

git switch -c feature/order-discount
cat >> src/orders.js <<'EOF'

export function discountForOrder(total) {
  return total >= 100 ? 0.1 : 0;
}
EOF
git add src/orders.js
git commit -m "feat: calculate order discount"
git tag -a v0.2.0 -m "Discount calculation"
git switch main
```

推送到 GitLab：

```bash
git remote add gitlab "$GITLAB_REPO_URL"
test -n "${GITLAB_PAT:-}" || {
  echo "ERROR: GITLAB_PAT is not set. Return to section 3.3 and inject the GitLab PAT."
  exit 1
}

# GitLab HTTPS push 使用 PAT，不使用 GitLab 账户密码。
# 临时 askpass 文件只读取当前 shell 的 GITLAB_PAT，不会把 Token 写入 URL 或 .git/config。
cat > "$WORK/gitlab-askpass.sh" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "oauth2" ;;
  *) printf '%s\n' "${GITLAB_PAT:?GITLAB_PAT is not set}" ;;
esac
EOF
chmod 700 "$WORK/gitlab-askpass.sh"

export GIT_ASKPASS="$WORK/gitlab-askpass.sh"
export GIT_TERMINAL_PROMPT=0
push_status=0
git push gitlab main develop feature/order-discount --tags || push_status=$?
if [ "$push_status" -eq 0 ]; then
  git ls-remote --heads --tags gitlab || push_status=$?
fi
rm -f "$WORK/gitlab-askpass.sh"
unset GIT_ASKPASS GIT_TERMINAL_PROMPT
if [ "$push_status" -ne 0 ]; then
  echo "ERROR: GitLab push failed. Check the clone URL and PAT permissions, then retry this block."
  false
fi
```

这里不应再出现 `Username for ...` 或 `Password for ...` 提示。如果推送失败，先检查 `GITLAB_REPO_URL` 是否是当前项目的 HTTPS clone URL、`GITLAB_PAT` 是否仍在当前终端中，以及 PAT 是否具有 `write_repository` 或 `api` 权限；不要把 PAT 粘贴到远程 URL 中。

输出必须包含：

- `refs/heads/main`
- `refs/heads/develop`
- `refs/heads/feature/order-discount`
- `refs/tags/v0.1.0`
- `refs/tags/v0.2.0`

### 6.3 创建 GitLab 元数据

在 GitLab UI 创建以下对象：

| 对象 | 内容 |
|---|---|
| Labels | `type::feature`、`type::bug`、`priority::high`、`migration` |
| Milestone | `Migration Lab v1` |
| Issue 1 | `Add order discount validation`，标签 `type::feature` |
| Issue 2 | `Fix invalid order total`，标签 `type::bug`、`priority::high` |
| MR | `feature/order-discount` → `develop`，标题 `feat: calculate order discount`，关联 Issue 1 |
| Wiki | 页面 `Runbook`，内容包括安装、测试和回滚 |
| CI/CD Variables | `EXAMPLE_REGISTRY_URL=registry.example.invalid`、`EXAMPLE_FEATURE_FLAG=true` |

所有变量都使用无害占位值，不创建真实 Secret。

验证对象数量：

```bash
curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/issues?state=all&per_page=100" |
  jq '[.[] | {iid,title,state}]'

curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/merge_requests?state=all&per_page=100" |
  jq '[.[] | {iid,title,state,source_branch,target_branch}]'
```

---

## 7. 迁移前盘点与冻结

### 7.1 Git 盘点

```bash
cd "$WORK"
rm -rf source.git
test -n "${GITLAB_PAT:-}" || {
  echo "ERROR: GITLAB_PAT is not set. Return to section 3.3 and inject the GitLab PAT."
  exit 1
}

# mirror clone 同样通过 GitLab HTTPS 认证；禁止回退到用户名/密码交互提示。
cat > "$WORK/gitlab-askpass.sh" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "oauth2" ;;
  *) printf '%s\n' "${GITLAB_PAT:?GITLAB_PAT is not set}" ;;
esac
EOF
chmod 700 "$WORK/gitlab-askpass.sh"
export GIT_ASKPASS="$WORK/gitlab-askpass.sh"
export GIT_TERMINAL_PROMPT=0
clone_status=0
git clone --mirror "$GITLAB_REPO_URL" source.git || clone_status=$?
rm -f "$WORK/gitlab-askpass.sh"
unset GIT_ASKPASS GIT_TERMINAL_PROMPT
if [ "$clone_status" -ne 0 ]; then
  echo "ERROR: GitLab mirror clone failed. Check the clone URL and PAT permissions."
  false
fi
cd source.git

git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags \
  | tee "$WORK/source-refs.txt"
git rev-list --all --count | tee "$WORK/source-commit-count.txt"
git count-objects -v | tee "$WORK/source-object-count.txt"
git fsck --full | tee "$WORK/source-fsck.txt"
git lfs ls-files 2>/dev/null | tee "$WORK/source-lfs.txt" || true
git log --all --oneline --decorate --graph | tee "$WORK/source-history.txt"
```

检查：

```bash
grep -q 'refs/heads/main' "$WORK/source-refs.txt"
grep -q 'refs/heads/develop' "$WORK/source-refs.txt"
grep -q 'refs/tags/v0.2.0' "$WORK/source-refs.txt"
if grep -q 'missing' "$WORK/source-fsck.txt"; then
  echo "FAIL: source repository has missing objects"
  exit 1
fi
echo "PASS Git inventory"
```

### 7.2 元数据盘点

```bash
cd "$WORK"
curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/issues?state=all&per_page=100" \
  | jq '[.[] | {iid,title,state,labels,milestone}]' > issues.json

curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/merge_requests?state=all&per_page=100" \
  | jq '[.[] | {iid,title,state,draft,source_branch,target_branch}]' > merge-requests.json

curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/labels?per_page=100" \
  | jq '[.[] | {name,color,description}]' > labels.json

curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/milestones?state=all&per_page=100" \
  | jq '[.[] | {iid,title,state}]' > milestones.json

curl --fail-with-body --silent --show-error \
  --header "PRIVATE-TOKEN: $GITLAB_PAT" \
  "$GITLAB_SERVER_URL/api/v4/projects/$GITLAB_PROJECT_ID/variables?per_page=100" \
  | jq '[.[] | {key,protected,masked,environment_scope}]' > variable-names.json

printf 'issues=%s\n' "$(jq 'length' issues.json)"
printf 'merge_requests=%s\n' "$(jq 'length' merge-requests.json)"
printf 'labels=%s\n' "$(jq 'length' labels.json)"
printf 'milestones=%s\n' "$(jq 'length' milestones.json)"
```

### 7.3 冻结

迁移 GEI 前：

1. 通知项目成员冻结时间。
2. 记录 `git rev-parse refs/heads/main` 和 `git rev-parse refs/heads/develop`。
3. 合并或关闭不需要迁移的 MR。
4. GitLab 设置为只读，或至少停止新的 push、Issue、MR。
5. 冻结后不要继续在 GitLab 写入；GEI 不做增量迁移。

---

## 8. Lab 1：用 GEI 迁移 GitLab 项目

### 8.1 安装和确认当前命令

```bash
gh extension install github/gh-gl2gh 2>/dev/null || true
gh extension upgrade github/gh-gl2gh
gh gl2gh --help
gh gl2gh migrate-repo --help
```

确认帮助中存在以下选项：

- `--gitlab-server-url`
- `--gitlab-group`
- `--gitlab-project`
- `--github-org`
- `--github-repo`
- `--use-github-storage`

### 8.2 先做试迁移

GitHub 目标仓库名称必须是不存在的新名称。使用 `-trial` 后缀，避免覆盖错误目标：

```bash
export TRIAL_REPO="${GITHUB_REPO}-trial"
gh repo view "$GITHUB_ORG/$TRIAL_REPO" >/dev/null 2>&1 && {
  echo "FAIL: target repository already exists; choose another TRIAL_REPO"
  exit 1
} || true
```

执行单仓库迁移：

```bash
gh gl2gh migrate-repo \
  --gitlab-server-url "$GITLAB_SERVER_URL" \
  --gitlab-group "$GITLAB_GROUP" \
  --gitlab-project "$GITLAB_PROJECT" \
  --github-org "$GITHUB_ORG" \
  --github-repo "$TRIAL_REPO" \
  --use-github-storage
```

`migrate-repo` 默认会等待迁移完成。若需要只排队不等待，使用官方帮助中列出的 `--queue-only`，然后再使用 `wait-for-migration` 查询状态；不要自行添加不存在的 `--wait` 参数：

```bash
gh gl2gh migrate-repo --help | sed -n '1,220p'
gh gl2gh wait-for-migration --help
```

迁移完成后记录输出中的 migration URL/ID。不要把 PAT 或完整认证 URL写进证据。

### 8.3 试迁移验收

```bash
gh repo view "$GITHUB_ORG/$TRIAL_REPO" --json nameWithOwner,isPrivate,defaultBranchRef
gh api "repos/$GITHUB_ORG/$TRIAL_REPO/branches" --jq '.[].name'
gh api "repos/$GITHUB_ORG/$TRIAL_REPO/tags" --jq '.[].name'
gh issue list --repo "$GITHUB_ORG/$TRIAL_REPO" --state all --limit 100
gh pr list --repo "$GITHUB_ORG/$TRIAL_REPO" --state all --limit 100
```

对照 `$WORK/source-refs.txt`、`issues.json`、`merge-requests.json`、`labels.json` 和 `milestones.json`。

注意：目标仓库中的权限、Team、Secrets、Actions、Projects 不会因为 GEI 自动达到最终状态。

### 8.4 正式迁移

试迁移验收通过后，使用正式仓库名。正式迁移前必须确认目标名称为空：

```bash
gh repo view "$GITHUB_ORG/$GITHUB_REPO" >/dev/null 2>&1 && {
  echo "FAIL: formal target already exists; do not overwrite it"
  exit 1
} || true
```

```bash
gh gl2gh migrate-repo \
  --gitlab-server-url "$GITLAB_SERVER_URL" \
  --gitlab-group "$GITLAB_GROUP" \
  --gitlab-project "$GITLAB_PROJECT" \
  --github-org "$GITHUB_ORG" \
  --github-repo "$GITHUB_REPO" \
  --use-github-storage
```

如果要批量迁移，先生成脚本而不是手写循环：

```bash
gh gl2gh generate-script \
  --gitlab-server-url "$GITLAB_SERVER_URL" \
  --gitlab-group "$GITLAB_GROUP" \
  --gitlab-project "$GITLAB_PROJECT" \
  --github-org "$GITHUB_ORG" \
  --use-github-storage \
  --output migrate.ps1
```

查看生成脚本和 `gh gl2gh generate-script --help`，确认脚本只包含预期项目后再执行。Codespaces 的主路径使用单仓库 `migrate-repo`，避免额外引入 PowerShell 依赖。

---

## 9. Lab 2：GitLab CI → GitHub Actions

### 9.1 主路径：人工重写并验证

GEI 不会把 GitLab CI 变成可运行的 GitHub Actions。复制模板：

```bash
cd "$WORK"
git clone "https://github.com/$GITHUB_ORG/$GITHUB_REPO.git" target
mkdir -p target/.github/workflows
cp "$COURSE_ROOT/lab-assets/github-workflows/ci.yml" target/.github/workflows/ci.yml
cp "$COURSE_ROOT/lab-assets/github-workflows/codeql.yml" target/.github/workflows/codeql.yml
cp "$COURSE_ROOT/lab-assets/dependabot.yml" target/.github/dependabot.yml
```

提交工作流：

```bash
cd "$WORK/target"
git switch -c migration/github-actions
git add .github
git commit -m "ci: add GitHub Actions workflows"
git push -u origin migration/github-actions
gh pr create \
  --repo "$GITHUB_ORG/$GITHUB_REPO" \
  --base main \
  --head migration/github-actions \
  --title "ci: add GitHub Actions workflows" \
  --body "Replaces the GitLab CI validation with GitHub Actions."
```

检查：

```bash
gh run list --repo "$GITHUB_ORG/$GITHUB_REPO" --limit 10
```

### 9.2 辅助路径：Actions Importer

官方 `gh-actions-importer` 通过 Docker 运行，Codespace 必须先满足：

```bash
docker info
```

如果 `docker info` 失败，不要继续执行 Importer；使用 9.1 的人工重写路径。不要把 Docker 错误误判为 GitHub Actions 或 GEI 错误。

安装并更新：

```bash
gh extension install github/gh-actions-importer 2>/dev/null || true
gh actions-importer update
gh actions-importer --help
```

配置（交互式，不把 token 放在命令行）：

```bash
gh actions-importer configure
```

按提示配置 GitLab 和 GitHub 凭据。配置文件只保存在 Codespace，不提交到仓库。

对单个 GitLab 项目做 dry-run。先查看本版本参数；不同版本可能不提供 audit 子命令，因此不把 audit 作为本 Lab 的必需步骤：

```bash
gh actions-importer dry-run gitlab --help
```

常见命令形态：

```bash
mkdir -p "$WORK/actions-importer"
gh actions-importer dry-run gitlab \
  --gitlab-instance-url "$GITLAB_SERVER_URL" \
  --gitlab-access-token "$GITLAB_PAT" \
  --project "$GITLAB_PROJECT" \
  --source-file-path "$WORK/target/.gitlab-ci.yml" \
  --output-dir "$WORK/actions-importer"
```

Importer 输出必须人工审查：

- `permissions` 是否最小化。
- 第三方 Action 是否可信、是否应 pin 到 SHA。
- GitLab variable 是否误当成明文环境变量。
- `only/rules` 是否正确转换成 `on`/`if`。
- artifact、cache、runner tag、environment 是否有等价实现。

不要把 dry-run 输出直接视为生产工作流。

---

## 10. Lab 3：权限、CODEOWNERS 和分支规则

### 10.1 添加 CODEOWNERS

从课程仓库根目录执行：

```bash
cp "$COURSE_ROOT/lab-assets/migration-demo-orders/CODEOWNERS" "$WORK/target/.github/CODEOWNERS"
```

将其中的 Team slug 改成目标组织真实存在的 Team。CODEOWNERS 只能引用已经存在并能访问仓库的用户或 Team。

### 10.2 创建 Teams

使用 GitHub UI 或 API。API 需要目标组织权限：

```bash
for team in migration-maintainers migration-developers migration-reviewers; do
  gh api --method POST "orgs/$GITHUB_ORG/teams" \
    -f name="$team" \
    -f privacy=closed \
    >/dev/null 2>&1 || true
done
```

把仓库授予 Team：

```bash
gh api --method PUT \
  "orgs/$GITHUB_ORG/teams/migration-maintainers/repos/$GITHUB_ORG/$GITHUB_REPO" \
  -f permission=maintain
gh api --method PUT \
  "orgs/$GITHUB_ORG/teams/migration-developers/repos/$GITHUB_ORG/$GITHUB_REPO" \
  -f permission=push
gh api --method PUT \
  "orgs/$GITHUB_ORG/teams/migration-reviewers/repos/$GITHUB_ORG/$GITHUB_REPO" \
  -f permission=triage
```

验收：

```bash
gh api "orgs/$GITHUB_ORG/teams/migration-developers/repos" \
  --jq '.[] | {full_name, permissions}'
```

### 10.3 配置 Ruleset

优先使用 UI：

`Repository → Settings → Rules → Rulesets → New branch ruleset`

配置 `main`：

- Require a pull request before merging。
- Required approvals：1。
- Require status checks：选择真实成功 run 产生的 check。
- Require conversation resolution。
- Require code owner review。
- 禁止 force push 和 branch deletion。
- 先使用 Evaluate 模式验证，再切换 Active。

不要盲目复制状态检查名称；Matrix job 的真实 check 名称必须从一次成功的 Actions run 页面取得。

负向验证：

1. 创建分支后直接向 `main` push，必须被拒绝。
2. 创建 PR 但不通过 CI，Merge 必须不可用。
3. Reviewer Request changes，Merge 必须不可用。
4. 完成 CI、approval、conversation resolution 后才允许合并。

---

## 11. Lab 4：Projects、Dependabot、Secret Scanning、CodeQL

### 11.1 Projects

在目标组织创建新版 Project，添加迁移仓库的 Issue/PR，并创建：

- Status：Todo、In progress、In review、Done。
- Priority：P0、P1、P2、P3。
- Iteration：Sprint 1。
- Owner：人员字段。

至少验证：

- Issue closed 后进入 Done。
- PR opened 后进入 In review。
- PR merged 后进入 Done。

### 11.2 Dependabot

提交 `.github/dependabot.yml`：

```bash
cd "$WORK/target"
git add .github/dependabot.yml
git commit -m "security: configure dependency updates"
git push
```

在 `Settings → Advanced Security` 确认 Dependabot alerts 和 security updates 是否受组织 plan 支持。

### 11.3 Secret Scanning

在 `Settings → Advanced Security` 确认功能状态。只用 GitHub 官方测试流程演示 Push Protection；不要自行提交看起来像真实密钥的字符串，也不要在课程仓库存放真实 PAT。

如果功能不可用，记录为 license/plan 限制，不要伪造成功结果。

### 11.4 CodeQL

确认 `.github/workflows/codeql.yml` 的语言与项目匹配，然后：

```bash
gh workflow list --repo "$GITHUB_ORG/$GITHUB_REPO"
gh workflow run codeql.yml --repo "$GITHUB_ORG/$GITHUB_REPO" || true
gh run list --repo "$GITHUB_ORG/$GITHUB_REPO" --workflow codeql.yml --limit 5
```

CodeQL 首次运行可能较慢。记录 run URL、分析结果和 alert 数量；不要为了通过课程而关闭安全检查。

---

## 12. 最终验收

### 12.1 Git 验收

```bash
cd "$WORK"
rm -rf verify
git clone "https://github.com/$GITHUB_ORG/$GITHUB_REPO.git" verify
cd verify
git fetch --all --tags
git branch -a
git tag --list
git log --all --oneline --decorate --graph
git fsck --full
```

比较迁移前 refs：

```bash
git for-each-ref --format='%(refname) %(objectname)' refs/remotes refs/tags \
  | sed 's#refs/remotes/origin/##' | sort > "$WORK/target-refs.txt"
diff -u "$WORK/source-refs.txt" "$WORK/target-refs.txt" || true
```

目标仓库使用默认分支名 `main` 时，注意把源和目标的 `refs/remotes/origin/` 前缀统一后再比较。任何 commit/tag 缺失都必须先调查。

### 12.2 元数据验收

```bash
gh issue list --repo "$GITHUB_ORG/$GITHUB_REPO" --state all --limit 100
gh pr list --repo "$GITHUB_ORG/$GITHUB_REPO" --state all --limit 100
gh label list --repo "$GITHUB_ORG/$GITHUB_REPO" --limit 100
gh api "repos/$GITHUB_ORG/$GITHUB_REPO/milestones?state=all" \
  --jq '.[] | {number,title,state}'
gh api "repos/$GITHUB_ORG/$GITHUB_REPO/branches" --jq '.[].name'
```

### 12.3 交付清单

| 验收域 | 必须有的证据 | 结果 |
|---|---|---|
| Codespace | `gh auth status`、版本、Docker 检查 |  |
| GitLab 源 | Group、Project、冻结 SHA |  |
| Git refs | 源/目标 branch、tag、commit 对照 |  |
| GEI | migration ID/URL、状态 |  |
| Issue/MR | Issue/PR 数量和链接 |  |
| Label/Milestone/Wiki | 对照结果和未迁移项 |  |
| CI/CD | Actions run URL、artifact、失败说明 |  |
| RBAC | Team 和 repo permission 输出 |  |
| CODEOWNERS/Ruleset | 正向和负向 PR 验证 |  |
| Projects | Issue/PR 和自动化状态 |  |
| 安全 | Dependabot、Secret Scanning、CodeQL 状态 |  |
| 切换 | GitLab 只读、URL 通知、回滚条件 |  |

### 12.4 清理凭据

```bash
unset GH_PAT GITLAB_PAT
git config --global --unset-all credential.helper 2>/dev/null || true
history -c 2>/dev/null || true
```

关闭 Codespace 前撤销只为 Lab 创建的 PAT，并删除试迁移仓库和临时 GitLab 项目。

---

## 13. 常见故障的停机规则

| 现象 | 停在哪里 | 正确处理 |
|---|---|---|
| `namespace is not valid` | GitLab 创建项目 | 用 `/groups/<encoded path>` 查询真实 Group ID；不要猜数字 |
| `401/403` | 凭据预检 | 撤销旧 token，按最小 scope 重新生成 |
| `gh gei` 不存在 | GEI 安装 | GitLab 使用 `gh gl2gh`，不是 `gh gei` |
| `gh gl2gh` 无选项 | CLI 版本/扩展错误 | `gh extension upgrade github/gh-gl2gh`，再看 `--help` |
| 目标仓库已存在 | 正式迁移前 | 停止，不使用 mirror 覆盖，不删除证据 |
| Docker unavailable | Actions Importer | 跳过 Importer，采用人工 CI 重写；这不影响 GEI |
| GEI 迁移中 | 等待阶段 | 通过 migration ID/URL 查状态，不重复提交同一迁移 |
| Actions check 名称不匹配 | Ruleset 配置 | 先跑一次 CI，再选择真实 check 名称 |
| Secret Scanning 不可用 | 安全验收 | 记录 plan/license 限制，不提交真实或伪造 secret |

---

## 14. 官方参考

- `gh-gei`（包含 `gh gl2gh`）：<https://github.com/github/gh-gei>
- GitLab CLI 扩展：<https://github.com/github/gh-gl2gh>
- GitHub Actions Importer：<https://github.com/github/gh-actions-importer>
- GitLab → GitHub Enterprise Cloud 迁移：<https://docs.github.com/en/enterprise-cloud@latest/admin/github/importer/import-source/about-migrations-from-gitlab-to-github>
- GEI 安装与授权：<https://docs.github.com/en/enterprise-cloud@latest/admin/github/importer/import-source/install-and-configure-github-enterprise-importer>
- Actions Importer 文档：<https://docs.github.com/en/actions/migrating-to-github-actions/automating-migration-with-github-actions-importer>

官方 CLI 会持续更新。每次授课前必须重新执行：

```bash
gh gl2gh --help
gh gl2gh migrate-repo --help
gh actions-importer --help
```

以当前 Codespace 中的帮助输出为准，不要使用过期博客或旧截图中的参数。

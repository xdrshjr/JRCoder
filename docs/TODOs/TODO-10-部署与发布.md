# TODO-10: 部署与发布

## 目标
完成项目打包、CI/CD配置、npm发布、Docker容器化和生产环境部署，确保项目可以顺利交付使用。

## 内部TODO列表

### TODO 10.1: 项目打包和构建优化
**优先级**: P0
**预期产出**: 优化的构建配置和打包产物

**构建配置优化**:
```typescript
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "importHelpers": true
  },
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "tests/**/*",
    "examples/**/*"
  ]
}
```

**Webpack配置（CLI打包）**:
```javascript
// webpack.config.js
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/cli/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cli.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: [nodeExternals()],
  optimization: {
    minimize: true
  }
}
```

**package.json配置**:
```json
{
  "name": "openjragent",
  "version": "1.0.0",
  "description": "Automated Programming Agent",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "openjragent": "dist/cli.js"
  },
  "files": [
    "dist",
    "config",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:cli": "webpack --config webpack.config.js",
    "build:all": "npm run build && npm run build:cli",
    "prepublishOnly": "npm run build:all && npm test"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "agent",
    "automation",
    "llm",
    "typescript",
    "cli"
  ]
}
```

**构建脚本**:
```bash
#!/bin/bash
# scripts/build.sh

set -e

echo "🔨 Building OpenJRAgent..."

# 清理
rm -rf dist

# TypeScript编译
echo "📦 Compiling TypeScript..."
npm run build

# CLI打包
echo "📦 Bundling CLI..."
npm run build:cli

# 复制资源文件
echo "📋 Copying assets..."
cp -r config dist/
cp README.md dist/
cp LICENSE dist/

# 验证构建
echo "✅ Verifying build..."
node dist/cli.js --version

echo "✨ Build completed!"
```

**验收标准**:
- [ ] 构建产物体积合理
- [ ] 类型定义完整
- [ ] CLI可执行
- [ ] 依赖正确打包

---

### TODO 10.2: CI/CD流水线配置
**优先级**: P0
**预期产出**: 完整的CI/CD配置

**GitHub Actions配置**:
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build:all

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  e2e:
    runs-on: ubuntu-latest
    needs: build

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x

      - name: Install dependencies
        run: npm ci

      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**发布流水线**:
```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build:all

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false

      - name: Build Docker image
        run: docker build -t openjragent:${{ github.ref_name }} .

      - name: Push to Docker Hub
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push openjragent:${{ github.ref_name }}
```

**验收标准**:
- [ ] CI流水线正常运行
- [ ] 测试自动执行
- [ ] 构建产物正确
- [ ] 发布流程自动化

---

### TODO 10.3: npm包发布配置
**优先级**: P0
**预期产出**: npm包发布和版本管理

**版本管理脚本**:
```bash
#!/bin/bash
# scripts/release.sh

set -e

# 检查工作目录是否干净
if [[ -n $(git status -s) ]]; then
  echo "❌ Working directory is not clean"
  exit 1
fi

# 获取版本类型
VERSION_TYPE=$1

if [[ -z "$VERSION_TYPE" ]]; then
  echo "Usage: ./scripts/release.sh [major|minor|patch]"
  exit 1
fi

# 运行测试
echo "🧪 Running tests..."
npm test

# 更新版本
echo "📝 Updating version..."
npm version $VERSION_TYPE

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")

# 更新CHANGELOG
echo "📋 Updating CHANGELOG..."
echo "## [$NEW_VERSION] - $(date +%Y-%m-%d)" >> CHANGELOG.md
git log --pretty=format:"- %s" $(git describe --tags --abbrev=0 @^)..@ >> CHANGELOG.md
echo "" >> CHANGELOG.md

# 提交变更
git add CHANGELOG.md
git commit --amend --no-edit

# 推送
echo "🚀 Pushing to remote..."
git push origin main
git push origin v$NEW_VERSION

echo "✅ Release v$NEW_VERSION completed!"
```

**.npmignore配置**:
```
# 源代码
src/
tests/
examples/

# 配置文件
tsconfig.json
tsconfig.build.json
webpack.config.js
jest.config.js
.eslintrc.js
.prettierrc

# CI/CD
.github/
.gitlab-ci.yml

# 文档
docs/
*.md
!README.md

# 其他
.env
.env.*
coverage/
node_modules/
*.log
```

**发布检查清单**:
```markdown
# 发布检查清单

## 发布前

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档已更新
- [ ] CHANGELOG已更新
- [ ] 版本号已更新
- [ ] 无breaking changes（或已说明）

## 发布

- [ ] 运行 `npm run build:all`
- [ ] 运行 `npm publish --dry-run` 检查
- [ ] 运行 `npm publish`
- [ ] 创建GitHub Release
- [ ] 推送Docker镜像

## 发布后

- [ ] 验证npm包可安装
- [ ] 验证CLI可运行
- [ ] 更新文档网站
- [ ] 发布公告
```

**验收标准**:
- [ ] npm包可正常安装
- [ ] 版本管理规范
- [ ] 发布流程自动化
- [ ] 包体积合理

---

### TODO 10.4: Docker容器化
**优先级**: P1
**预期产出**: Docker镜像和部署配置

**Dockerfile**:
```dockerfile
# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY tsconfig*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY src ./src
COPY config ./config

# 构建
RUN npm run build:all

# 生产镜像
FROM node:18-alpine

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# 创建工作目录
RUN mkdir -p /workspace /logs

# 设置环境变量
ENV NODE_ENV=production
ENV WORKSPACE_DIR=/workspace
ENV LOG_DIR=/logs

# 暴露端口（如果有API服务）
# EXPOSE 3000

# 设置入口点
ENTRYPOINT ["node", "dist/cli.js"]

# 默认命令
CMD ["--help"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  openjragent:
    build: .
    image: openjragent:latest
    container_name: openjragent
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AGENT_MAX_ITERATIONS=10
      - LOG_LEVEL=info
    volumes:
      - ./workspace:/workspace
      - ./logs:/logs
      - ./config:/app/config
    command: run "Your task here"

  # Ollama本地模型（可选）
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  ollama_data:
```

**.dockerignore**:
```
node_modules/
dist/
coverage/
.git/
.github/
tests/
examples/
*.log
.env
.env.*
```

**部署脚本**:
```bash
#!/bin/bash
# scripts/docker-deploy.sh

set -e

VERSION=$1

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/docker-deploy.sh <version>"
  exit 1
fi

# 构建镜像
echo "🐳 Building Docker image..."
docker build -t openjragent:$VERSION .
docker tag openjragent:$VERSION openjragent:latest

# 推送到Docker Hub
echo "📤 Pushing to Docker Hub..."
docker push openjragent:$VERSION
docker push openjragent:latest

# 部署到服务器（示例）
echo "🚀 Deploying to server..."
ssh user@server << EOF
  docker pull openjragent:$VERSION
  docker-compose down
  docker-compose up -d
EOF

echo "✅ Deployment completed!"
```

**验收标准**:
- [ ] Docker镜像构建成功
- [ ] 镜像体积合理(<500MB)
- [ ] 容器可正常运行
- [ ] docker-compose配置正确

---

### TODO 10.5: 生产环境部署和监控
**优先级**: P1
**预期产出**: 生产部署方案和监控配置

**Kubernetes部署配置**:
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openjragent
  labels:
    app: openjragent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openjragent
  template:
    metadata:
      labels:
        app: openjragent
    spec:
      containers:
      - name: openjragent
        image: openjragent:latest
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openjragent-secrets
              key: openai-api-key
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: logs
          mountPath: /logs
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: openjragent-workspace
      - name: logs
        persistentVolumeClaim:
          claimName: openjragent-logs

---
apiVersion: v1
kind: Service
metadata:
  name: openjragent-service
spec:
  selector:
    app: openjragent
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

**Prometheus监控配置**:
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'openjragent'
    static_configs:
      - targets: ['openjragent-service:3000']
    metrics_path: '/metrics'
```

**Grafana仪表板配置**:
```json
{
  "dashboard": {
    "title": "OpenJRAgent Monitoring",
    "panels": [
      {
        "title": "Task Success Rate",
        "targets": [
          {
            "expr": "rate(agent_tasks_completed[5m]) / rate(agent_tasks_total[5m])"
          }
        ]
      },
      {
        "title": "LLM Token Usage",
        "targets": [
          {
            "expr": "rate(agent_llm_tokens_total[5m])"
          }
        ]
      },
      {
        "title": "Cost per Hour",
        "targets": [
          {
            "expr": "rate(agent_llm_cost_total[1h])"
          }
        ]
      },
      {
        "title": "Tool Call Distribution",
        "targets": [
          {
            "expr": "agent_tool_calls_total"
          }
        ]
      }
    ]
  }
}
```

**健康检查端点**:
```typescript
// src/api/health.ts
import express from 'express'

const router = express.Router()

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: process.env.npm_package_version
  })
})

router.get('/ready', async (req, res) => {
  try {
    // 检查LLM连接
    await llmClient.chat({
      messages: [{ role: 'user', content: 'ping', timestamp: Date.now() }]
    })

    res.json({ status: 'ready' })
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message })
  }
})

router.get('/metrics', (req, res) => {
  const metrics = metricsCollector.exportPrometheus()
  res.set('Content-Type', 'text/plain')
  res.send(metrics)
})

export default router
```

**部署文档 (docs/deployment/production.md)**:
```markdown
# 生产环境部署

## 环境要求

- Kubernetes 1.20+
- Docker 20.10+
- 2GB+ RAM per instance
- 1 CPU core per instance

## 部署步骤

### 1. 准备配置

\`\`\`bash
# 创建Secret
kubectl create secret generic openjragent-secrets \
  --from-literal=openai-api-key=YOUR_KEY

# 创建PVC
kubectl apply -f k8s/pvc.yaml
\`\`\`

### 2. 部署应用

\`\`\`bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
\`\`\`

### 3. 验证部署

\`\`\`bash
kubectl get pods -l app=openjragent
kubectl logs -f deployment/openjragent
\`\`\`

### 4. 配置监控

\`\`\`bash
# 部署Prometheus
kubectl apply -f prometheus/

# 部署Grafana
kubectl apply -f grafana/
\`\`\`

## 扩容

\`\`\`bash
kubectl scale deployment openjragent --replicas=5
\`\`\`

## 回滚

\`\`\`bash
kubectl rollout undo deployment/openjragent
\`\`\`

## 监控指标

- Task success rate
- LLM token usage
- Cost per hour
- Tool call distribution
- Error rate
- Response time

## 告警规则

- Task failure rate > 10%
- Cost per hour > $10
- Error rate > 5%
- Memory usage > 80%
```

**验收标准**:
- [ ] K8s部署成功
- [ ] 健康检查正常
- [ ] 监控指标可见
- [ ] 告警规则生效

---

## 依赖关系
- 依赖所有前置TODO（需要完整系统）
- TODO 10.1 是其他TODO的基础
- TODO 10.2 依赖 TODO 10.1

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 构建失败 | 高 | CI中提前验证 |
| 发布错误 | 高 | 发布前充分测试 |
| 容器镜像过大 | 中 | 多阶段构建优化 |
| 生产环境问题 | 高 | 灰度发布+监控 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] npm包成功发布
- [ ] Docker镜像可用
- [ ] 生产环境稳定运行
- [ ] 监控和告警正常

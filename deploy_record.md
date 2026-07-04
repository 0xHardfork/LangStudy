# LangStudy 远程生产环境部署记录报告

**项目名称**：LangStudy  
**部署服务器**：`root@178.105.223.xxx` (Ubuntu 26.04 LTS @ Hetzner)  
**密钥路径**：`~/.ssh/hetzner_main_key`  
**部署状态**：**SUCCESS (已于 2026-07-02 成功运行上线)**  
**外网访问**：`http://178.105.223.xxx/` (已通过 Nginx 反向代理)

---

## 🛡️ 一、安全防线与账号隔离机制

为了在生产环境中消除特权安全隐患（不给应用 root 权限，数据库不使用管理员），本次部署建立了多层级隔离：

### 1. 系统级别：低特权账户隔离
- **运行账户**：在服务器上创建了独立的系统账户 `langstudy` (无 shell 登录权限，仅用于守护进程执行)：
  ```bash
  useradd -r -s /bin/false langstudy
  ```
- **工作目录与权属分配**：
  * 后端主目录 `/opt/langstudy/backend`（所有者 `langstudy:langstudy`，权限 `750`，外界用户无法读取配置）
  * 前端静态目录 `/opt/langstudy/frontend`（所有者 `langstudy:langstudy`，权限 `755`）
  * 物理日志目录 `/data/langstudy/log`（所有者 `langstudy:langstudy`，权限 `770`）
  * 音频生成静态资源 `/opt/langstudy/backend/static`（由 Go 服务在运行时实时输出，所有者为 `langstudy`）

### 2. 凭证安全：无明文文件凭证 (Password File 模式)
- **密钥存放**：在 `/etc/langstudy/secrets/` 中建立了高权限目录（权限 `700`，只允许 `langstudy` 和 `root` 访问）。
- **物理密码隔离**：数据库密码安全地写入 `/etc/langstudy/secrets/pg_pass`，对文件设置了 `400`（所有者只读）权限。
- **配置防潮**：主配置文件 `/opt/langstudy/backend/config.yaml` 内的 `postgres.password` 字段完全留空，仅配置 `password_file: "/etc/langstudy/secrets/pg_pass"`，在 Go 启动时由内存进行加载。

### 3. 数据库安全：最小数据库权限
- **去管理员化**：在 PostgreSQL 里创建了普通用户 `lang_db_user` 并授予其专门的 `langstudy` 数据库读写权，禁用超级管理员 `postgres` 的直接登录。
- **PostgreSQL 15+ 额外授权**：由于新版 Postgres 收回了普通用户默认在 `public` 模式下的建表权，为了能够让服务安全地跑 DDL 迁移，专门连接至 `langstudy` 库执行了以下最小权限授予：
  ```sql
  GRANT ALL ON SCHEMA public TO lang_db_user;
  ```

---

## 🚀 二、部署资产结构与工作流

### 1. 前后端部署资源
- **前端 SPA**：通过本地 Vite 编译成纯静态资源，解压并放置于 `/opt/langstudy/frontend`，由 Nginx 进行高性能静态托管。
- **后端二进制**：在本地使用 Golang 的交叉编译特性，一键构建出专用于 Linux amd64 的 ELF 静态二进制文件，并上传至 `/opt/langstudy/backend/bin/`：
  * 编译命令：`CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build ...`
  * 可执行程序：`server` (主 Web API) 与 `migrate` (表结构升级工具)。

### 2. 语音合成运行时环境 (edge-tts)
- 在 `/opt/langstudy/backend` 下建立了独立的 Python 虚拟环境：
  ```bash
  python3 -m venv .venv
  .venv/bin/pip install edge-tts
  ```
- 整个虚拟环境所有者递归移交给 `langstudy`，服务启动时将从 `.venv/bin/edge-tts` 调用音频合成，保证无需全局 Python 脏依赖。

---

## ⚙️ 三、服务托管与网关配置

### 1. Systemd 守护进程守护 (`langstudy.service`)
配置文件路径：`/etc/systemd/system/langstudy.service`
- **优雅自升级特性**：在每次服务拉起前，通过 `ExecStartPre=/opt/langstudy/backend/bin/migrate` 先行自动运行表结构检查和迁移升级；一旦升级成功，才运行 `ExecStart=/opt/langstudy/backend/bin/server` 启动主服务，保证数据一致性。
- **运行指令**：
  * 重启服务：`sudo systemctl restart langstudy`
  * 查看运行状态：`sudo systemctl status langstudy`

### 2. Nginx 反向代理与路由
配置文件路径：`/etc/nginx/sites-available/langstudy`
- **路由分配**：
  * `/` -> 指向前端静态托管 `/opt/langstudy/frontend` (支持 React Router 浏览器回退 fallback)
  * `/api` -> 反向代理至本地 `http://127.0.0.1:8080` (后端服务端口)，将 `proxy_read_timeout` 延长至 180 秒以保证大模型慢请求不超时。
  * `/static/` -> 通过 Nginx `alias` 直接极速物理托管至 `/data/langstudy/audio/`，极大减少 Go 后端进程承载静态文件分发的负载，且将生成音频与程序代码目录解耦，防止发版覆盖时误删已有音频资产。

---

## 💻 四、本地一键部署脚本

为了方便您在后续更新代码时快速重新发布，本次部署所使用的全自动安全构建和上传脚本已保存至您的本地代码目录中：
👉 **本地脚本路径**：[backend/scripts/deploy.sh](file:///Users/peigen/Documents/dev/0xHardfork/LangStudy/backend/scripts/deploy.sh)

在后续需要更新版本上线时，您只需在**本地代码根目录**下执行：
```bash
./backend/scripts/deploy.sh
```
该脚本会自动在本地交叉编译 Linux 版二进制、压缩前端静态资源、建立 SSH 通信密钥管道、将资产安全同步至 Hetzner 目标路径，并重启 Systemd 和 Nginx 服务。

---

## 📊 五、服务状态与日志排查

服务已成功启动，验证日志输出：
```json
{"level":"info","ts":1783001177.8168936,"caller":"migrate/main.go:52","msg":"starting database migrations..."}
{"level":"info","ts":1783001177.830985,"caller":"database/migrate.go:33","msg":"migrations: no new changes"}
{"level":"info","ts":1783001177.8311312,"caller":"migrate/main.go:57","msg":"database migrations completed successfully"}
{"level":"info","ts":1783001177.8890252,"caller":"server/main.go:55","msg":"config loaded","env":"production"}
{"level":"info","ts":1783001177.909771,"caller":"server/main.go:80","msg":"postgres connected","host":"127.0.0.1","dbname":"langstudy"}
{"level":"info","ts":1783001177.9133425,"caller":"server/main.go:95","msg":"redis connected","host":"127.0.0.1","db":0}
{"level":"info","ts":1783001177.913488,"caller":"server/main.go:107","msg":"automatic migrations disabled in production mode"}
{"level":"info","ts":1783001177.9139674,"caller":"server/main.go:210","msg":"server started","port":8080}
```

- **物理日志跟踪**：您可以直接在服务器上通过 `tail -f /data/langstudy/log/server.log` 跟踪 API 访问日志与调试信息。

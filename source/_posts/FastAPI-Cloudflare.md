---
title: FastAPI+Cloudflare
copyright: false
date: 2026-01-03 14:50:56
categories:
  - api
tags:
  - 网络
  - FastAPI
  - Cloudflare Tunnel
  - uvicorn
---


## FastAPI+Cloudflare把自己的服务放到公网

最近在一台Linux主机中使用docker部署了一个需要GPU算力的计算机视觉服务，专门给某个特定场景使用。采用这个方案的原因主要是因为租用带有显卡服务器成本太高，不如自己搭建（有显卡），并且现有的一些第三方服务的网站能够调用通用算法包含的模型较少，访问起来很慢，并且pro版本十分昂贵，比如[roboflow](https://roboflow.com/)，免费版使用的时候网站有时候会卡住显示OOM，调用接口批量测试的时候效果也有点差强人意。综合考虑还是自己搭建了一个api，在AI的帮助下也就半天时间就可以完成，这样一来模型完全可控，可微调可训练。

项目构建了一个集成 GroundingDINO（目标检测）和 Segment Anything Model（图像分割）的 API 服务。技术栈选择：

|  工具/库  |	类型   |	选择理由   |
|----------|---------|--------------|
|  FastAPI | Web 框架 |	现代、高性能（基于 Starlette 和 Pydantic）。原生支持异步编程（Async/Await），非常适合处理 IO 密集型任务，且能自动生成 Swagger 文档。|
| Uvicorn  | ASGI 服务器  |	基于 uvloop，是目前 Python 生态中最快的 ASGI 服务器之一，用于承载 FastAPI。|
|Grounded-SAM |	AI 模型组合	| 结合了 GroundingDINO 的“根据文字找物体”能力和 SAM 的“万物分割”能力，实现了强大的 Zero-Shot（零样本）检测与分割。|
| Cloudflare Tunnel |	内网穿透  |	无需公网 IP，无需配置路由器端口转发。提供免费的 DDoS 防护和自动 SSL 证书，安全性远超传统的 FRP 等穿透方案。|

由于深度学习模型的推理是 GPU 显存密集型 和 计算密集型 的操作，简单的多线程会导致显存爆炸（OOM）或计算资源争抢导致速度变慢。因此，在 FastAPI 中设计了一套基于 **信号量（Semaphore）** 的排队机制。

由于显存有限，采用的是单worker+异步队列。设计逻辑包含：

1. 全局模型加载：深度学习模型在启动时加载到 GPU 显存中。如果开启多个 Uvicorn Workers，每个进程都会加载一份模型，这会瞬间撑爆显存，因此采用 `workers=1`。

2. 异步并发控制：虽然 Python 的 async 擅长处理并发，但 GPU 推理是同步的阻塞操作，如果同时来 10 个请求，不能让它们同时抢占 GPU。

3. Semaphore 信号量：
- 定义了一个信号量池，容量为 1，当请求进入接口时，async with semaphore: 尝试获取锁。如果锁被占用（有任务在推理），新请求会进入 Pending 状态，直到前一个任务完成。利用 loop.run_in_executor 将同步的 GPU 推理放入线程池执行，避免阻塞 FastAPI 的事件循环，确保健康检查等轻量级接口依然能快速响应。

服务启动后，FastAPI 自动在 /docs 生成交互式文档。此时在同一局域网下的设备都可以访问了。最后就是把这一本地的服务暴露给外部，采用的是 Cloudflare Zero Trust，前置条件是拥有自己的域名，并且将域名的 Nameservers 修改为 Cloudflare 提供的 DNS 服务器。

操作步骤：

1. 安装 Cloudflared

- Linux
```bash
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. 创建 Tunnel

登录 [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) 进入 Networks -> Tunnels，点击 Create a Tunnel，复制生成的安装命令（包含 Token）在 Linux 终端执行：

- Linux
```bash
sudo cloudflared service install <YOUR_TOKEN>
```

3. 配置 Public Hostname

在 Tunnel 设置页面添加映射，映射到自己主机的对应端口，比如：
- Domain: api.yourdomain.com
- Service Type: HTTP (注意：这里选 HTTP，因为本地 FastAPI 也是跑在 HTTP，如果自己配置了证书再根据配置来选择)
- URL: localhost:8000

4. 开启 HTTPS 强制跳转（可选）

开启之后若用户使用http访问会直接定向到https。

最终：外部访问 https://api.yourdomain.com/api -> Cloudflare (SSL解密) -> Tunnel -> 本地 Linux localhost:8000 -> GPU 推理 -> 结果返回。全程无需暴露公网 IP，且自带 HTTPS 证书。

### 常见问题：

- Error 502 Bad Gateway: 隧道是通的，但隧道连不上 FastAPI 端口（比如重启 Python 服务时）
- Error 1033 Tunnel Error: 隧道本身断了，Cloudflare 根本联系不上主机

Error 1033是指Cloudflare 边缘节点找不到配置的Tunnel了，可能是重启了电脑但cloudflared 没有自动启动，或者网络波动导致隧道掉线（多等一会），或者进程冲突。

总之，可以先检查一下隧道服务的状态：

- Linux
```bash
sudo systemctl status cloudflared
```

或者强制重启一下隧道服务：

- Linux
```bash
sudo systemctl restart cloudflared
```

长期运行的话，给这个服务设置一下开机自启

- Linux
```bash
sudo systemctl enable cloudflared
```
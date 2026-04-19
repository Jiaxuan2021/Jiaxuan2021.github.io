---
title: 服务器配置clash代理简易流程
copyright: false
date: 2026-04-19 13:54:06
categories:
  - 网络
  - 运维
tags:
  - clash
  - claude code
---


## 学校服务器（hpc，托管私有）的代理配置

学校的服务器是基于slurm，组内服务器是基于kube，安装使用代理是很常见的需求（Hugging Face，Github，Claude Code等），并且需要随时切换不同区域的代理，或者走自己搭建的代理服务器。最近能用官方的cc，所以在hpc和组内服务器上都配置了代理，不需要sudo权限，这里简单记录一下。

> 由于原版 Clash 项目已经删库停更，目前社区的主流替代方案是 Mihomo (原 Clash Meta)，它完全兼容 Clash 的配置文件。

服务器都是x86架构，配置很方便。

### 1. 下载并安装内核 (Mihomo)

- Linux
```bash
# 1. 创建个人可用二进制文件目录，正常应该已存在
mkdir -p ~/.local/bin
# 把它加入环境变量
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 2. 直接从 Github 下载Mihomo (可以选新一点的版本)
wget https://github.com/MetaCubeX/mihomo/releases/download/v1.18.2/mihomo-linux-amd64-v1.18.2.gz

# 3. 解压并重命名为 clash
gzip -d mihomo-linux-amd64-v1.18.2.gz
mv mihomo-linux-amd64-v1.18.2 ~/.local/bin/clash

# 4. 赋予执行权限
chmod +x ~/.local/bin/clash
```

### 2. 下载配置并修改端口

不管是hpc还是组内的服务器都是多人共享的，把代理放在hpc登录节点上，运行的进程所有人都可以看到！！

> 之前朋友发现在hpc的一些众知端口上有好几个用户不小心把自己的文件共享出来了，原因在于都运行了 `python -m http.server`，因为大家都在同一台机器上，转发一下服务器的8000端口，打开`127.0.0.1:8000`就看到了其他用户共享出来的文件。我扫描了一下服务器进程，发现有大量这样的情况，其中大部分是tensorboard深度学习记录的一些参数情况，可能进程没有正常关掉，还有几个是自己开发的网页（FastAPI/Uvicorn 后端接口），以及在8000、8888、8080端口上暴露出来的一些私人文件（`python -m http.server`）。一开始很不理解为什么要运行这个命令去共享文件，后来朋友提醒才发现原来是claude code的习惯，怪不得。所有具有hpc登录权限的人都可以看到，就算服务使用了`-bind 127.0.0.1`，由于是共享的节点，也没有用。这次事件之后，在学校的hpc上更加注意了，不会让自己的服务裸奔。

- Linux
```bash
# 1. 创建配置目录并下载基础数据
mkdir -p ~/.config/clash
cd ~/.config/clash
wget https://raw.githubusercontent.com/alecthw/mmdb_china_ip_list/release/Country.mmdb

# 2. 下载你的订阅链接配置
wget -O config.yaml "你的订阅链接"
```

HPC 登录节点是多人共享的，查看了一下，默认的 7890 端口已经被其他用户占用了，很有可能运行的就是clash，在登录节点上我看到有3-4个clash相关的进程在运行。所以选一个专属端口，比如58990，修改`~/.config/clash`下的config.yaml：

- Linux
```yaml
port: 58990           # HTTP 代理端口
socks-port: 58991     # SOCKS5 代理端口
mixed-port: 58992     # 混合端口（推荐设置这个，如果文件里没有可以自己加上）
allow-lan: false      # 登录节点自己用，填 false 即可，更安全
external-controller: 127.0.0.1:59090  # 控制面板API端口
```

### 3. 编写快捷启动命令

`~/.bashrc`中添加一下内容，注意和上面的端口对应，记得刷新环境变量`source ~/.bashrc`

- Linux
```bash
# 代理快捷键
alias proxy_on='export http_proxy="http://127.0.0.1:58990"; export https_proxy="http://127.0.0.1:58990"; export all_proxy="socks5://127.0.0.1:58991"; echo -e "代理已开启 🟢"'
alias proxy_off='unset http_proxy https_proxy all_proxy; echo -e "代理已关闭 🔴"'
alias clash_start='nohup clash -d ~/.config/clash > ~/.config/clash/clash.log 2>&1 & echo "Clash 已在后台运行"'
alias clash_stop='pkill -u $USER clash; echo "Clash 已停止"'
```

现在使用代理就非常简单了

- Linux
```bash
clash_start
proxy_on
curl ipinfo.io   # 达到limit可以尝试其他的 cip.cc 或 https://api.myip.com 或 myip.ipip.net
```

### 4. 切换代理节点

在 Linux 纯命令行下，默认代理节点不是想要的地区，由于没有界面，所以需要把clash的控制面板映射到自己本地。使用 SSH 端口转发功能登录服务器。或者使用vscode转发也可以。

- macOS
```zsh
# config.yaml 里设置的 external-controller 端口
ssh -L 59090:127.0.0.1:59090 your_username@server_login_ip
```

然后在个人浏览器中打开一个在线控制面板，这里我使用的`http://yacd.haishan.me/`（一定注意是http，填成https就连不上了），弹出的页面中Host / API Base URL 填写`http://127.0.0.1:59090`，建议在之前的config.yaml中配置一个secret。连上之后就可以切换节点了。

> Clash/Mihomo 这个软件本身是没有图形界面的，它只提供了一个叫做 external-controller的 API 接口。yacd (Yet Another Clash Dashboard) 是一个写好了界面逻辑的纯前端网页，浏览器首先从开发者那下载这个网页代码（html/js），然后网页就完全跑在浏览器内存里了。配置、订阅、节点信息绝对安全，所有的网络请求都是从浏览器直接发往localhost。


### 5. 加一步验证（针对共享端口服务器）

然而，按照这个方式配置代理，服务器上的其他用户只要加一句环境变量`export http_proxy="http://127.0.0.1:58990"`就可以使用我的代理，所有流量都会从我的隧道出口，比较危险。

Clash/Mihomo 本身考虑到了这个问题，内置了 Authentication (用户名密码认证) 功能。一旦加上，别人即使知道我的端口，连上来也会报错 `407 Proxy Authentication Required`。

需要修改一下`config.yaml`，先关掉关掉正在运行的代理进程`clash_stop`

- Linux
```bash
vim ~/.config/clash/config.yaml
```

在最上面设置端口的地方，加入一行 authentication:（注意缩进，和 port 平齐）

- Linux
```yaml
port: 58990           # HTTP 代理端口
socks-port: 58991     # SOCKS5 代理端口
mixed-port: 58992     # 混合端口（推荐设置这个，如果文件里没有可以自己加上）
allow-lan: false      # 登录节点自己用，填 false 即可，更安全
external-controller: 127.0.0.1:59090  # 控制面板API端口

# 加上下面的配置，设置一个用户名和密码
authentication:
  - "your_name:your_password_123"  # 用户名：密码
```

修改之前的alias，记得刷新环境变量`source ~/.bashrc`

- Linux
```bash
alias proxy_on='export http_proxy="http://your_name:your_password_123@127.0.0.1:58990"; export https_proxy="http://your_name:your_password_123@127.0.0.1:58990"; export all_proxy="socks5://your_name:your_password_123@127.0.0.1:58991"; echo -e "代理已开启 🟢"'
```

> 注意：URL 里的用户名和密码必须和 config.yaml 里一模一样。格式是 http://用户名:密码@IP:端口

重启并测试

- Linux
```bash
clash_start
proxy_on
```

这样一来，其他用户如果输入 export http_proxy="http://127.0.0.1:58990"，运行 curl google.com，会立刻看到：Proxy Authentication Required。

同样控制面板的secret也可以在config.yaml中加一下，保证安全。


## Claude Code 卸载记录

最近用了一下朋友的原版cc，原来用的是国内中转站[gac](https://gaccode.com)，现在越来越贵了，掺水也比较明显。但是之前cc有点卸载不干净，这里记录一下：

- Linux
```bash
npm uninstall -g @anthropic-ai/claude-code

rm -rf ~/.claude*    

unset ANTHROPIC_API_KEY    # 重要，清理环境变量和刷新命令哈希缓存，即使卸载了程序，这个环境变量仍然会留在 shell 配置中
unset ANTHROPIC_BASE_URL
hash -r
```
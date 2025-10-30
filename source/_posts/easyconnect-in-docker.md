---
title: Easyconnect 放入 Docker 中避免流量劫持和监控
copyright: false
date: 2025-10-29 22:45:59
categories:
  - 网络
tags:
  - EasyConnect
  - Docker
---


## EasyConnect 放 Docker 中避免流量劫持

EasyConnect是深信服(Sangfor)开发的VPN客户端软件，常用于：

- 校园网接入：让学生/教职工通过VPN访问校内资源
- 企业远程办公：接入企业内部系统
- 网络准入控制：对接入设备进行安全检查和管控

通过EasyConnect可以使我们在校外访问校内资源，并且港科广连接HPC需要通过可信主机，而可信主机就包含了EasyConnect中的两台入口主机。因此，无论在校内还是校外，使用EasyConnect的场景都是很多的。

但是，这也带来一些麻烦，由于EasyConnect节点比较少使用人数较多，所以放在后台时会导致访问学校以外的网页速度变慢，并且也没有办法访问外网。此外，也存在一些安全问题，EasyConnect可能会监控所有流量，可能收集用户上网行为数据。还有EasyConnect软件权限过高，需要安装虚拟网卡。

针对这些问题，其实校内许多大佬也已经在各个吃喝玩乐群里提出了解决方案，刚入学时就看到他们分享了许多经验（主要是美食），但是每个人方式不一样，下面是我参考大佬们的方法。也可以直接使用[Link](https://github.com/yizhanai/hkustgz-docker/)

### 1. 安装 docker

若没有安装的话，在MacOS上使用Homebrew安装Docker

- macOS
  ```zsh
  brew install --cask docker
  ```

启动Docker

- macOS
  ```zsh
  open -a docker
  ```

可以在`Docker Engine`JSON中配置一下国内镜像源，然后`Apply & Restart`

- macOS
  ```json
  {
    "registry-mirrors": ["https://registry.docker-cn.com"]
      }
  ```

### 2. 运行容器命令

命令是一个大佬写的，我觉得很全面，直接拿来用了，参考[Link1](https://github.com/docker-easyconnect/docker-easyconnect)，[Link2](https://shawrong.github.io/posts/how-to-use-docker-easy-connect/)

`hagb/docker-easyconnect` 是一个专门为运行EasyConnect设计的Docker镜像，包含基础操作系统（通常是Alpine或Debian）、EasyConnect客户端及其依赖、VNC服务器等。

- macOS
  ```zsh
  alias easyconnect='docker run --rm --device /dev/net/tun --cap-add NET_ADMIN -ti -e PASSWORD=xxxx -e DISABLE_PKG_VERSION_XML=1 -e URLWIN=1 -v $HOME/.ecdata:/root -p 127.0.0.1:5901:5901 -p 127.0.0.1:1081:1080 -p 127.0.0.1:8889:8888 hagb/docker-easyconnect:latest'
  ```

参数解释：

> 容器权限和网络配置
> - --device /dev/net/tun：授予TUN/TAP设备权限（创建虚拟网卡）
> - --cap-add NET_ADMIN：授予网络管理权限（配置路由等）
> - --rm：容器退出后自动清理
>
> 环境变量
> - PASSWORD=xxxx：VNC连接密码，需要设置，用于远程桌面连接
> - DISABLE_PKG_VERSION_XML=1：禁用版本检查，避免隐私泄露
> - URLWIN=1：启用URL重定向功能
>
> 端口映射
> - -p 127.0.0.1:5901:5901：VNC服务，仅本地访问
> - -p 127.0.0.1:1081:1080：SOCKS5代理
> - -p 127.0.0.1:8889:8888：HTTP代理
>
> 数据持久化
> - -v $HOME/.ecdata:/root：将容器配置数据保存在本地，避免重复登录

### 3. 打开EasyConnect

运行alias命令后（或者直接写在~/.zshrc中），可以使用VNC来远程连接容器，对于Mac使用自带的 `屏幕共享` ，地址栏输入 `vnc://127.0.0.1:5901`，在EasyConnect中输入用户名密码连接。

### 4. Web使用校园VPN

容器运行起来后，若要在Web使用校园VPN可以借助SwitchyOmega浏览器插件，配置SOCKS5代理 `127.0.0.1:1081` 即可。

### 5. 终端使用校园VPN

一般只有某些命令需要走校园网，比如ssh，一般单独使用就行

- macOS
  ```zsh
  ssh -o ProxyCommand="nc -x 127.0.0.1:1081 %h %p" -p 12345 root@school_ip
  ```

> - -o ProxyCommand：SSH 的代理配置选项
> - nc -x 127.0.0.1:1081：使用 netcat 通过 SOCKS5 代理连接
> - %h %p：SSH 的占位符，会被替换为目标主机和端口

或者

- macOS
  ```zsh
  ssh -o ProxyCommand="connect -S 127.0.0.1:1081 %h %p" -p 12345 root@school_ip
  ```

> - connect -S 127.0.0.1:1081：使用 connect 工具通过 SOCKS5 代理


使用的较多可以直接写到 `~/.ssh/config`

- macOS
  ```zsh
  echo '
  Host 校内服务器
      HostName school_ip
      Port 12345
      User root
      ProxyCommand nc -x 127.0.0.1:1081 %h %p
  ' >> ~/.ssh/config
  ```

终端HTTP（临时设置，当前终端有效）

- macOS
  ```zsh
  export http_proxy=http://127.0.0.1:8889
  export https_proxy=http://127.0.0.1:8889
  ```

其他命令使用校园网，也可以自己写一个sh脚本，用函数来控制代理开关，使用 `export` 的方式（只针对http、https，ftp，一般不支持socks5）。也可以专门开一个终端只走校园网。

- macOS
  ```zsh
  curl --socks5 127.0.0.1:1081 http://校内网站
  ```

- macOS
  ```zsh
  rsync -e 'ssh -o ProxyCommand="nc -x 127.0.0.1:1081 %h %p"' 源目录 目标目录
  ```
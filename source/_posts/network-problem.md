---
title: 一些网络问题和近期信息整理
copyright: false
date: 2025-12-04 09:43:40
categories:
  - 网络
  - bugs
tags:
  - RDP
  - XRDP
  - File watching
---

## Win11 RDP

最近配了windows主机，肯定要配置一下远程桌面，这在校园网中非常丝滑。但是这次配置的时候出现了以前从没出现过的问题，因此记录一下。校园网内的主机ICMP是不响应的，可能是配置了网络层ACL（访问控制列表）。
因此可以使用其他方式先判断一下连通性：

- windows
```powershell
Test-NetConnection -ComputerName 目标IP -Port 端口号
``` 

如果是不通的，可能有多种原因导致，比如被访问的主机没有打开远程桌面功能（一些常规的设置可以去网络上搜索）。所有基本设置都完成之后，如果还是不通，需要查看一下下面这个注册表的值：

- windows
```powershell
(Get-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server').fDenyTSConnections
``` 

如果fDenyTSConnections的值为1，意味着“拒绝终端服务连接”，Remote Desktop (RDP) 服务被禁用，Windows 不会接受 RDP 连接请求，也没有监听3389端口，此时需要将该值修改为1（可能需要重启电脑）

- windows
```powershell
# 1. 修改注册表，允许远程连接 (将 1 改为 0)
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0

# 2. 重启远程桌面服务以确保生效
Restart-Service TermService -Force
``` 

然后可以查看一下是否在监听3389端口：

- windows
```powershell
netstat -an | findstr 3389
``` 

如果看到了`LISTENING`，可以再次运行`Test-NetConnection`测试，如果还是不通，可能是防火墙的原因。当时我的两台内网主机不在一个网段，一台是`10.4.x.x`，另一台是`10.30.x.x`，Windows 防火墙可能会拦截。首先可以在被访主机上查看一下网络类型和规则限制：

- windows
```powershell
# 1. 查看当前网络是 公用(Public) 还是 专用(Private)
# 如果是 Public，防火墙通常会默认拦截跨网段的 RDP
Get-NetConnectionProfile

# 2. 查看 RDP 防火墙规则的具体限制 (Scope)
# 重点看 RemoteAddress 是 Any 还是 LocalSubnet
Get-NetFirewallRule -Name "RemoteDesktop-UserMode-In-TCP" | Get-NetFirewallAddressFilter
``` 

> `RemoteAddress : Any` 所有IP地址都可以尝试连接RDP，来自任何地方的连接都会被防火墙评估，其他条件（如身份验证）仍会起作用
> `RemoteAddress : LocalSubnet` 只有同一子网内的设备可以连接RDP
> Windows 防火墙对于“公用”网络的策略非常严格。默认的远程桌面防火墙规则通常只允许在“专用”(Private) 或“域”(Domain) 网络下生效，或者在 Public 下会被阻断。有时可能认证过期重连会导致网络类型跳回Public，或者重新插拔网线、DHCP wifi ip重新分配等。

如果 Get-NetConnectionProfile 显示 Public，且上面的 RemoteAddress 显示 LocalSubnet，那么无法连接主机，如果需要的话可以将规则放开给所有IP（可信内网，强密码）：

- windows
```powershell
# 仅在需要时执行：允许任何 IP 进行 RDP 连接
Set-NetFirewallRule -Name "RemoteDesktop-UserMode-In-TCP" -RemoteAddress Any
``` 

之前在一台内网主机的12345端口上设置了一个服务，有时候网络波动（认证过期重连、重新插拔网线、DHCP wifi ip重新分配等）导致网络类型改变（变为public），可以创建一个在 Public (公用)、Private (专用)、Domain (域) 下都允许通过的规则：

- windows
```powershell
New-NetFirewallRule -DisplayName "Allow Port 12345 Always" -Direction Inbound -LocalPort 12345 -Protocol TCP -Action Allow -Profile Any
``` 

此时，连接RDP已经提示输入用户名和密码了，明显已经找到了主机。由于这台win11电脑登陆了个人的微软账号，我当时尝试输入主机名密码和微软账户名密码都无法登入，这可能也算是一个bug，下面一步步解决：

首先需要确定正确的用户名，在使用微软账号登录时，RDP 有两种用户名的填写方式，第一种是微软账户名（邮箱地址或者MicrosoftAccount\邮箱地址）和微软账户密码。第二种则是电脑`whoami`输出的用户名和主机密码。此时第二种方式连接不上，那么考虑使用微软邮箱账户和微软账户密码，若还是连接不上，确认以下配置：

1. “仅 Windows Hello”选项是否被关闭（Win11）。如果这个选项是开着的，Windows 会禁止通过“密码”验证，只允许 PIN/指纹，而 RDP 不支持 PIN。

2. 用“微软账户密码”在本地登录一次 (同步 Hash)。如果平时一直用 PIN 码或者指纹登录电脑，系统底层可能根本没缓存最新微软密码的 Hash 值。导致 RDP 验证时，系统觉得密码是错的。先将电脑锁屏，然后在登陆选项中选择微软账户登陆。

3. 关闭 NLA (网络级别身份验证，可选)，绕过预验证。有时候，即使密码对，RDP 的预验证机制（NLA）也会因为各种网络玄学报错。可以关掉它，让 RDP 先连上画面，再在画面里输密码。

- windows
```powershell
# 修改注册表关闭 NLA 要求（可选）
(Get-WmiObject -class "Win32_TSGeneralSetting" -Namespace root\cimv2\terminalservices -Filter "TerminalName='RDP-Tcp'").SetUserAuthenticationRequired(0)
``` 

到这里，已经解决了我的问题。如果上面三条已经确认后还是失败，那么先在被控电脑的PowerShell中运行下面这条命令，测试系统到底认不认你的账号密码，如果不对，需要检查微软账户密码有没有错误。

- windows
```powershell
# 这里的 user 换成邮箱
runas /user:MicrosoftAccount\邮箱@xxx.com cmd
``` 

在rdp尝试密码的时候，超过一定次数可能会导致电脑账户锁定，可以使用：

1. 在被控端的PowerShell（管理员）中运行这条命令，即告诉系统：“不管输错多少次密码，都不要锁定账户”。lockoutthreshold:0 表示将“帐户锁定阈值”设置为 0，即永不锁定。

- windows
```powershell
net accounts /lockoutthreshold:0
``` 

2. 或者想保留锁定策略，但只想清除当前的错误记录，可以尝试重启远程桌面服务。运行

- windows
```powershell
Restart-Service TermService -Force
``` 

当然，如果觉得死磕这个微软账户麻烦，完全可以新建一个账户，可以100%的解决问题。我希望使用自己的账户是因为配置了一些东西，不想重新配置一遍。

- windows
```powershell
# 1. 创建一个新用户 (用户名: rdpadmin，密码: 12345678)
net user rdpadmin 12345678 /add

# 2. 把这个用户升级为管理员 (这样远程过去才有权限操作)
net localgroup administrators rdpadmin /add

# 3. 授予远程登录权限
net localgroup "Remote Desktop Users" rdpadmin /add

# 4. 确保该用户的密码永不过期
Set-LocalUser -Name "rdpadmin" -PasswordNeverExpires $True
``` 

## ubuntu ssh以及图形化界面远程访问

### ssh

由于内网环境的便利性，给新装的Ubuntu电脑配置一个SSH服务是很简单的。先更新软件源列表（防止找不到软件包）：

- Linux
```bash
sudo apt update
```

安装OpenSSH Server：

- Linux
```bash
sudo apt install openssh-server -y
```

启动服务并设置为开机自启：

- Linux
```bash
sudo systemctl enable --now ssh
```

检查服务状态：

- Linux
```bash
sudo systemctl status ssh
```

Ubuntu 默认的防火墙 UFW 通常是关闭的。如果开启了它，需要允许 SSH 端口通过：

- Linux
```bash
sudo ufw allow ssh
```

配置了DDNS以及主机别名之后就可以通过 `ssh HostName` 访问了。

### GUI

一般ubuntu不太需要gui，如果需要完整的桌面环境（包含界面的开发或者测试），并且网络带宽还行，可以尝试使用微软的 RDP 协议（XRDP）。Ubuntu 默认使用的是 GNOME 桌面，配置 VNC 比较繁琐，XRDP更简单。但是在我这边连接的时候，总是会卡住，貌似也不是很好用，后续再探索一下。

- Linux
```bash
sudo apt install xrdp
sudo systemctl enable --now xrdp

# 开放防火墙端口 3389 (如果开启了 ufw)
sudo ufw allow 3389/tcp
```

会有一些黑屏/闪退的问题，如果连接黑屏，建议注销（Log out）物理机上的当前用户，因为同一个用户很难同时在物理机和远程登录同一个 GNOME 会话。GNOME 桌面在远程时可能会有权限冲突，建议创建一个配置文件：

- Linux
```bash
echo "gnome-session" > ~/.xsession
```

windows客户端直接使用自带的远程桌面连接就行，Mac需要下载Microsoft Remote Desktop。

####  更新：GUI连接依旧黑屏并且没有Dock的问题

1. rdp连接ubuntu依旧黑屏

Ubuntu 的 GNOME 桌面环境在通过 xrdp 登录时，经常因为环境变量冲突导致黑屏。即使你注销了本地用户，有时也会黑屏。需要修改`startwm.sh`脚本来解决这个问题。

- Linux
```bash
sudo vim /etc/xrdp/startwm.sh
```

添加配置：找到文件末尾的 `test -x /etc/X11/Xsession && exec /etc/X11/Xsession` 这几行之前，添加以下两行代码：

- Linux
```bash
unset DBUS_SESSION_BUS_ADDRESS
unset XDG_RUNTIME_DIR
```

重启xrdp服务：

- Linux
```bash
sudo systemctl restart xrdp
```

> 这两行unset是为了解决会话复用和独立会话之间的问题。本地登陆或者系统启动时，`systemd`会为用户启动一系列后台服务。这些服务会生成一些环境变量。XRDP 实际上是启动了一个全新的图形显示服务器（Xorg），它是一个独立的、隔离的“房间”。

> unset DBUS_SESSION_BUS_ADDRESS (切断通信干扰)
> DBus 是 Linux 进程间通信的渠道。例如，当点击“设置”时，GUI 进程通过 DBus 告诉后台进程修改配置。问题是，当 XRDP 脚本启动时，它往往会继承系统中已经存在的、或者 SSH 会话中的环境变量。如果 XRDP 里的 GNOME 桌面读取到了旧的 DBUS_SESSION_BUS_ADDRESS，它会试图连接到物理机上的那个会话去注册自己。结果就是，新启动的 RDP 桌面没有建立自己的通信频道，而是试图挤进物理机的频道。物理机会话（或 systemd）拒绝了这个请求，或者新桌面因为找不到自己的频道而卡死。因此unset它，强制新启动的桌面环境创建一个属于自己的、全新的 DBus 通信频道。

> unset XDG_RUNTIME_DIR (防止文件锁冲突)
> 这是一个临时目录，用来存放当前用户运行时的临时文件（Socket 文件等）。同理，如果 XRDP 继承了这个变量，它会试图去读写物理机会话正在使用的那个目录，这可能会造成权限冲突，或者文件锁死（Lock）。因此unset它，让系统为当前的 RDP 会话重新分配或管理运行时目录上下文。
> 总之，这个两个unset告诉xrdp：不要管这台电脑上之前发生了什么，也不管物理机上有没有人登录，请给我初始化一个新的桌面环境。

2. 连上gui界面后没有Dock

好不容易不黑屏了但是没有显示任何菜单栏，那怎么打开应用呢？

解决方法：创建`.xsessionrc`配置文件，终端运行以下命令，这会为用户创建一个配置文件，专门告诉 RDP 该加载什么主题。

- Linux
```bash
cat <<EOF > ~/.xsessionrc
export GNOME_SHELL_SESSION_MODE=ubuntu
export XDG_CURRENT_DESKTOP=ubuntu:GNOME
export XDG_CONFIG_DIRS=/etc/xdg/xdg-ubuntu:/etc/xdg
EOF
```

重启xrdp服务：

- Linux
```bash
sudo systemctl restart xrdp
```

这时就能看到Dock了，但是貌似有点卡，可能rdp对linux对支持不太好，一般都用ssh。不过，如果上面这招不管用，又非得要GUI的话（查看某些程序的可视化），可以安装一个轻量级的桌面环境 Xfce，它在 RDP 下极其稳定（这也是很多 Linux 运维的首选方案，我们组内的VNC连接linux容器也是使用的这种方式）。

安装`sudo apt install xfce4`
配置xrdp使用xfce：`echo xfce4-session > ~/.xsession`
重启 xrdp：`sudo systemctl restart xrdp`

> Xfce4（XForms Common Environment 4）是一个用于 Linux 和 Unix 系统的桌面环境。

> GNOME：依赖 3D 硬件加速（OpenGL）。它有很多透明、阴影、动态模糊特效。在 RDP 协议中，传输这些 3D 渲染画面非常消耗带宽和 CPU，而且如果没有物理显卡支持（或者虚拟显卡驱动不好），GNOME 直接就渲染不出来，导致黑屏或界面缺失。界面比较现代，类似 macOS/iPad。

> Xfce4：默认使用 2D 渲染。它画窗口就是画矩形和线条。这种简单的图形指令非常容易通过 RDP 协议传输，带宽占用小，延迟低，且不需要显卡 3D 加速支持。Xfce 的依赖关系简单，它不太在乎是不是通过复杂的 Session 启动的，只要能连上 X server 就能显示。界面比较复古，有点winXP的感觉。

## 进程文件句柄耗尽

某些终端工具或者前端开发的时候可能会出现报错 EMFILE: too many open files，原因是这种类型的工具通常会监视项目中的大量文件，如果项目很大，进程打开的文件句柄数就超过了系统限制。

首先可以使用下面的命令查看一下限制的文件数，如果输出1024之类的数字，则是系统限制太小，可以调大一点，但这一般只在当前终端有效。

- Linux
```bash
ulimit -n

ulimit -n 65535
```

若是没有效果可以采用轮询（polling）的方式，一般工具都有此类选项，可以查一下怎么打开。

> 此类Node.js工具，底层通常使用一个名为 chokidar 的库来监视文件变动，而chokidar 在处理大量文件时，EMFILE 错误是一个典型问题。chokidar 默认会尝试使用系统原生事件来监视文件，这会消耗大量文件句柄。但是，可以强制它使用一种叫做“轮询(polling)”的模式。轮询模式虽然CPU开销稍高，但不会消耗文件句柄，因此可以绕开 EMFILE 限制。

通常可以通过设置一个环境变量来开启轮询模式，`CHOKIDAR_USEPOLLING=1`

文件监视 (File Watching)的两种方式：

1. 系统事件 (System Events) - 默认方式

这是最高效的方式，通过操作系统来监视，在 Linux上，这个功能通常由一个叫做 inotify 的子系统来完成。

2. 轮询 (Polling)

这种方式不依赖操作系统的通知，而是自己每隔一小段时间（例如几秒钟）就主动去检查一遍所有需要监视的文件，看看它们的修改时间等信息是否发生了变化。优点在于：因为它不依赖 inotify 这样的系统功能，所以它完全不受“文件句柄数”的限制。无论项目有多大，它都不会出现 EMFILE 错误。缺点则是：由于需要周期性地主动检查大量文件，它会比“系统事件”方式消耗更多的 CPU 资源。

## 个人总结

这段时间还体验了一会WebGIS，也深刻感受到现在许多开发的工作已经被AI代替的差不多了，以前做一个网页或者app会很有成就感，现在除了对AI的震惊之外还有对自己未来研究方向的一点迷茫。不管怎么样，道阻且长，踏踏实实的干，顺其自然吧。
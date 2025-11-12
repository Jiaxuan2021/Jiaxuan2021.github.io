---
title: Scrcpy手机投屏电脑并结合Termux解析ip
copyright: false
date: 2025-11-12 20:01:54
categories:
  - 工具
tags:
  - Scrcpy
  - Termux
---

## Scrcpy手机投屏电脑

平时使用手机时需要和电脑传输一些链接或者文本，不想在Mac上登陆微信，只能打开文件传输助手，然后就要扫码确认，并且总是要去拿起手机很不方便，能够直接在电脑上操作包括打字会更加流畅舒适。还有一些时候可能需要做手机上的演示视频，分享一些Android App，一般是录像或者投屏，或者在电脑上使用Android模拟器。

需要满足所有要求一般使用投屏，我看到许多人都推荐scrcpy，自己使用之后也觉得非常好用，开源、轻量、简单。scrcpy不仅能投屏还能在电脑上控制手机，声音也可以投屏，显示很清晰，速度快，可以通过USB连接，也可以通过Wifi连接，并且不需要手机root权限，同时适用于Linux、Windows和MacOS。在有公司网络或者校园网的场景中非常舒适，延迟低，还能远程控制设备。下面是使用方式：

### 启用adb调试

不同手机品牌启用adb的方式不同，一般是进入`设置` -> `关于手机` -> `版本信息` -> `版本号` 连续点击7下，直到提示"您已处于开发者模式"，即打开`开发者模式`。然后在设置主界面可以看到`开发人员选项`，打开
- USB调试
- USB调试（安全设置）
- 无线调试

### 安装Scrcpy

可以参考[官方教程](https://github.com/Genymobile/scrcpy/tree/master)安装，Windows可以参考[Link](https://blog.csdn.net/ddj_test/article/details/120287342?ops_request_misc=elastic_search_misc&request_id=48f7e35664ffbadb263100b09a761a7d&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~top_positive~default-1-120287342-null-null.142^v102^pc_search_result_base9&utm_term=scrcpy&spm=1018.2226.3001.4187)，MacOS直接使用Homebrew安装scrcpy和Android平台工具（包含adb）。

- macOS
```zsh
# 安装scrcpy
brew install scrcpy

# 安装Android平台工具（包含adb）
brew install --cask android-platform-tools
```

### USB连接

用USB数据线连接手机和Mac，在手机上授权USB调试，首次连接时，手机会弹出"允许USB调试吗？"的对话框，勾选"一律允许使用这台计算机进行调试"并点击"确定"。在Mac终端验证连接：

- macOS
```zsh
adb devices
```
显示 List of devices attached。

这时有线连接时投屏直接终端运行scrcpy就可以了。

- macOS
```zsh
scrcpy
```

### Wifi或者局域网投屏

只要网络是通的，理论上都可以投屏，校园网和家里局域网就非常舒适。

断开有线连接，查看手机ip地址（可以在`状态信息`中查看），然后终端输入

- macOS
```zsh
# 1. 设置TCP/IP模式，端口可以自己设置，默认5555
adb tcpip 5555

# 2. 通过WiFi连接（将192.168.1.100替换为手机IP）
adb connect 192.168.1.100:5555

# 3. 验证无线连接
adb devices
```

显示设备就可以了，同样使用`scrcpy`命令打开投屏窗口，打开时可以设置一下分辨率。设备分辨率越高，延迟越大，用这个命令可以限制分辨率大小，保证性能：

- macOS
```zsh
scrcpy --max-size 1024

scrcpy -m 1024  # 简短一点，效果相同
```

> 若手机熄屏了，右键点击一下可以亮屏输入密码解锁。屏幕点亮时单击鼠标右键，可以发送一个返回键。投屏状态下可以调用电脑输入法，使用电脑键盘输入。从电脑传输文件到手机直接拖拽就可以，手机传到电脑可能需要其他方式（拖拽没用）。

scrcpy还支持录屏，参考[Link](https://zhuanlan.zhihu.com/p/660004701)，以及多设备连接（多个手机同时连接电脑），按照 `adb devices` 输出的ID号来打开scrcpy：

- macOS
```zsh
scrcpy --serial ID号

# 或者
scrcpy -s ID号
```

窗口置顶：

- macOS
```zsh
scrcpy --always-on-top

# 或者
scrcpy -T
```

若需要断开某一个连接

- macOS
```zsh
# 断开当前设备
adb disconnect

# 或断开特定设备
adb disconnect 192.168.1.100:5555
```

## 手机安装Termux动态解析ip

前面说到，scrcpy无线投屏是通过`adb connect IP:Port`来建立连接的，IP变了就要重新输入一次，如果是备用机的话一般不会带在身边，所以如果有域名的话可以配置一下动态域名解析。我配置的ddns是用的python脚本，需要安装一些依赖，一般使用conda，所以记录一下Termux中安装miniconda的过程。

> 有了python环境之后，运行一些脚本也比较方便。

### 下载Termux

听说google play里面的termux团队已经不维护了，所以还是从[官方链接](https://github.com/termux/termux-app/releases/)下载。下载完后在Termux终端中运行

- Termux
```bash
pkg update && pkg upgrade
```

Termux还有一些插件，有一些好玩的应用，比如Termux:X11，参考[Link](https://ivonblog.com/en-us/posts/termux-x11/)（好像是游戏，但一般不用手机打游戏吧）。

Termux:X11是一个独立的App，它让 Android 设备能够运行 Linux 图形界面程序。
- 作为 X11 服务器，提供图形显示功能
- 与 Termux 主应用配合使用，显示 Linux 程序的图形界面

主要原理是在Termux中运行一些Linux GUI程序，通过DISPLAY=:0 发送图形数据，再由Termux:X11 APP (接收并显示图形界面)，最后在Android屏幕显示。

### 安装debian

在 Termux 中直接安装 Miniconda 存在一些技术限制和兼容性问题，比如架构不同

Termux：

- 运行在 Android 的 ARM/AArch64 架构上
- 使用 Bionic C 库（Android 的 C 库）

Miniconda：

- 官方预编译包主要针对 x86_64 和标准 ARM64 服务器
- 依赖标准的 GNU C 库（glibc），而 Android 使用 Bionic libc

此外，Termux运行在Android的沙盒环境中，文件系统布局与标准linux不同，还会有root权限限制，可能编译失败或运行时出现奇怪的问题。安装了debian之后就可以随意的安装miniconda和各种python包了。

那为什么不装Ubuntu呢，可以参考这篇博客[Link](https://ivonblog.com/en-us/posts/termux-proot-distro-debian/)中的解释，具体来说，这是一个在Linux社区，尤其是Ubuntu用户中非常热门且有争议的话题。在 Ubuntu 20.04 及更高版本中，当使用 `apt install` 安装一些常用软件（如 chromium、firefox、vlc 等）时，Ubuntu 会静默地转而安装其 Snap 版本，而不是传统的 deb 包。用户感觉失去了选择权。

> Snap 是一种软件打包和分发格式，由 Canonical 公司（Ubuntu 背后的公司）开发。它的核心目标是解决 Linux 上软件依赖复杂、跨版本安装困难的问题。一个 Snap 包将应用程序及其所有的依赖库（甚至包括特定版本的 glibc 等核心库）都打包在一起。这被称为“容器化”。可以把它想象成类似于 macOS 上的 .dmg 文件或 Windows 上的 .msi 安装包。

性能问题：由于需要建立沙盒和挂载镜像，Snap 应用的启动速度通常比原生 deb 包慢，尤其是在第一次启动时。每个 Snap 都自带依赖，导致大量重复的库文件，占用了更多磁盘空间。

兼容性问题：Snap 应用在沙盒中运行，默认无法自由访问用户主目录以外的文件。虽然可以通过权限接口授权，但很麻烦。snapd 依赖于一些较低级的系统守护进程和特性，在 Termux 提供的 proot 环境（一种模拟的 root 环境，并非真正的虚拟机）中无法正常工作。如果 Ubuntu 系统试图安装 Snap 包，就会失败。

对比下来，为了后续使用的兼容性还是选择安装debian。

- Termux
```bash
# 设置termux的存储权限
termux-setup-storage

# 安装必要的包
pkg install proot-distro pulseaudio vim

# 使用proot-distro安装debian
proot-distro install debian
```
安装好后如图所示

<img src="termux-1.png" alt="安装debian" style="width:70%;display:block;margin:0 auto;">

使用proot-distro安装debian如图所示

<img src="termux-1.png" alt="安装debian" style="width:70%;display:block;margin:0 auto;">

随后可以使用下面的命令进入debian

- Termux
```bash
proot-distro login debian
```

可以在Termux中配置一个别名写入 `~/.bashrc` 中

- Linux
```bash
# Proot Distro aliases
alias debian='proot-distro login debian'
```

### 安装miniconda

进入debian中后就可以安装miniconda，配置脚本的运行环境了，还可以在外层Termux内配置alias或者sh脚本来运行在debian环境中的scripts。

- Linux
```bash
# 安装必要的基础工具
apt install wget curl bzip2 ca-certificates -y

# 下载 Miniconda（选择适合 ARM64 的版本）
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh

# 给安装脚本执行权限
chmod +x Miniconda3-latest-Linux-aarch64.sh

# 安装 Miniconda（安装在用户目录）
./Miniconda3-latest-Linux-aarch64.sh -b -p $HOME/miniconda3

# 初始化 conda（添加到 bashrc）
$HOME/miniconda3/bin/conda init bash

# 重新加载 bash 配置
source ~/.bashrc

# 验证安装
conda --version
```

不同的域名解析商使用的接口不同，这里就不记录DDNS解析的过程了。
---
title: Ubuntu 系统更新显卡驱动后网络图标消失及驱动丢失的修复记录
copyright: false
date: 2026-05-22 14:49:19
categories:
  - 运维
  - 驱动
tags:
  - Ubuntu
---


## Ubuntu 系统更新显卡驱动后网络图标消失及驱动丢失的修复记录

由于学校实验室意外停电导致强制关机，一台运行 Ubuntu 22.04 与 Windows 的双系统主机重启后显卡驱动掉了，大致就是出现了`Failed to initialize NVML: Unknown Error` 这种问题，应该是重启后内核版本升级与驱动版本不匹配了。我当时没有想太多，直接更新了一下驱动（因为这台电脑平时放在一个比较偏远的地方，我是通过桌面远程或者ssh远程的）

- Linux
```bash
sudo ubuntu-drivers autoinstall
```

重启后，就连不上了（双系统引导默认进ubuntu，远程重启也没有问题），我以为可能是卡在了装驱动的MOK（Machine Owner Key，机器所有者密钥）界面，但是我记得我的UEFI Secure Boot (安全启动)是关闭的，所以比较疑惑，这台主机还运行了一些服务，还需要处理一下，打算第二天直接过去看看。

> 安全启动初衷：为了防止木马或病毒在电脑开机时通过伪装成驱动程序进入系统。因此，BIOS 只允许运行经过“权威机构”（通常是微软或主板厂商）数字签名的代码。
> 尴尬的现状：Nvidia 驱动和很多闭源网卡驱动是“第三方”的。当安装这些驱动时，它们往往是在电脑上现场编译的。因为是现场生成的，这些代码没有大公司的官方签名。
> 所以 Linux 会生成一个属于这台电脑的私有签名。MOK 就是用来把这个私有签名存入主板 BIOS 的工具，让主板信任这个驱动。

打开电脑发现是断网了，系统右上角网络图标消失，Wi-Fi 和有线网络均无法识别，终端执行 ip a 仅显示本地环回lo，这个时候显卡驱动倒是没问题了。此时系统的内核版本是6.8.0-117（`uname -r`）。主要的问题在于包含绝大多数无线网卡（Wi-Fi）和有线网卡的额外模块包没有自动安装（linux-modules-extra）。

问了一下ai（穷鬼，只有deepseek和gemini）基本上给出的方案就是先进入grub的启动菜单，找到比当前版本早一点的版本启动，有网络了再去安装这个额外驱动包。我当时看不到`Advanced options for Ubuntu`这个选项，就打算用手机把驱动下载下来后拷贝到电脑安装，安装的是`http://security.ubuntu.com/ubuntu/pool/main/l/linux/linux-modules-extra-6.8.0-117-generic_6.8.0-117.117_amd64.deb`。不过插上u盘之后又出现了另一个尴尬的问题：`unknown filesystem type exFAT`，看起来exFAT格式的驱动也恰好包含在缺失的那个`linux-modules-extra`包里，现在不认识u盘。不过这台电脑是双系统，所以直接进入windows拷贝在一个目录下，然后再进入ubuntu安装

- Linux
```bash
sudo dpkg -i linux-modules-extra-6.8.0-117-generic_6.8.0-117.117_amd64.deb
```

重启之后还是没有网络图标，使用`lspci -k | grep -i net -A 3`查看了一下驱动状态，出现的是

- Linux
```bash
00:14.3 Network controller: Intel Corporation Device 7a70 (rev 11)
        DeviceName: Onboard - Ethernet
        Subsysten: Intel Corporation Device 0094
        Kernelmodules:iwlwift
00:16.0 Communication controller: Intel Corporation Device 7a68 (rev 11)
--
04:00.0 Ethernet controller: Realtek Semiconductor Co., Ltd. RTL8125 2.5GbE Controller (rev 05)
        Subsysten: Micro-Star International Co., Ltd. [MSI] RTL8125 2. 5GbE Controller
        Kernel modules: r8169
```

ai说网卡虽然都被系统识别了，并且也显示了对应的驱动程序（Kernel modules: iwlwifi, r8169），但是它们都没有加载成功。正常情况下，Kernel modules 下面应该有一行 Kernel driver in use: iwlwifi。现在这一行消失了，说明内核拒绝使用这些驱动。gemini非常聪明，它觉得是可能是安全启动的问题，至少也提供了一个方向，并不是毫无头绪

- Linux
```bash
sudo modprobe iwlwifi   # 查看是不是安全启动的原因 
```

如果是`modprobe: ERROR: could not insert 'iwlwifi': Required key not available`那就确定是安全启动拦截导致的。
不过我出现的报错是`modprobe: ERROR: could not insert 'iwlwifi': Invalid argument`这说明安装的这个驱动包与我的内核镜像底层二进制签名上不完全匹配。没办法，只能有网的时候让它自己装比较稳妥，又去找回滚内核版本的方法。

之前不显示grub菜单，可修改 `/etc/default/grub`：
- 将 GRUB_TIMEOUT_STYLE 设为 menu
- 取消 #GRUB_TERMINAL=console 的注释，强制使用文本模式避免显卡驱动导致的黑屏
- 执行 sudo update-grub 并重启

执行上述步骤之后能看到grub菜单栏了，选择了一个较低的版本号（6.8.0-111-generic）启动，进去之后这个版本是有网但是没有显卡驱动，此时对新内核修复：

- Linux
```bash
sudo apt purge linux-image-6.8.0-117-generic linux-modules-6.8.0-117-generic linux-modules-extra-6.8.0-117-generic    # 清理不完整的内核包

# 重新下载
sudo apt update
sudo apt install linux-image-generic linux-modules-extra-6.8.0-117-generic

# 安装内核头文件
sudo apt install linux-headers-$(uname -r) linux-headers-6.8.0-117-generic

# 重新安装 Nvidia 驱动
sudo ubuntu-drivers autoinstall
```

重启之后就没问题了，折腾了一上午，记录一下吧，万一下次又断电了呢😂。


### 总结和预防

1. 安装内核元软件包：执行 sudo apt install linux-generic，该包会强制系统在更新内核时必须同步下载所有依赖模块。
2. 固定 GRUB 菜单：修改 /etc/default/grub，设置 GRUB_TIMEOUT 为 5 秒以上，并开启 console 模式，确保系统崩溃时仍有回退余地。
3. 使用终端更新（sudo apt update）而不是Ubuntu 自带的图形更新器（有时候只会部分更新）
4. 备用 U 盘：保留一个 FAT32 格式的启动盘。在 exFAT 驱动丢失的情况下，FAT32 仍能被基础内核识别
5. 重启前先检查一下
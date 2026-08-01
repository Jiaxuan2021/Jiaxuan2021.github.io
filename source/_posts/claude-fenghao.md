---
title: claude_fenghao
date: 2026-08-01 20:32:17
categories:
  - Claude
  - 网络
  - 虚拟机
  - 服务器
tags:
  - Claude
  - VMWare
  - 端口转发
---


## Claude安全使用实践

最近国内某些公司疯狂蒸馏Claude，或许把人家逼急了，现在的检测越来越严格，codex虽然也不错但是两种工具对比下来（仅官方对比）不管从上下文、速度、理解能力来看仍然是claude更胜一筹，尤其是codex的思考速度让人难以忍受，再有就是最近codex有点笨，可能是因为gpt6要上线了，因此我和一位特殊的朋友 [青见](oooranges00@outlook.com) 折腾了一套让claude相信使用者就是“美国人”的流程。想法其实是简单粗糙的，不过配置起来比较简单，所以就采用了这套方案，有想法或者其他改进思路欢迎联系我或者青见。

到目前为止我们被封了5个claude账号，总体感受下来谷歌邮箱是不可靠的，有连坐效应，比如我的一个claude账号（大概2年前被封号）使用gmail注册，封号之后，我另一个gmail账号也被封号了，这个账号甚至没有使用过claude。邮箱这里使用apple的匿名邮箱比较可靠。也可

众所周知，claude封号不仅和ip有关，还和系统信息（中文、时区等）、支付方式、手机号、邮箱等相关，根据某些电报群友的说法甚至和用量也有关系（Fable刚出的时候蹬的太狠被封号），还有设备太多信息无法统一管理被封号，也可以参考[Github](https://github.com/claude89757/claude-code-tips)，不过他也被封号了。目前来看，apple礼品卡支付是ok的，刚开始以为只能海外信用卡支付才能退款，实际上apple礼品卡也能退。可以使用一些检测网站先检测试试 [ClaudeCheck](https://claudecheck.top/zh/)、[FuckClaude](https://fuck-claude.vercel.app/zh/)，但是什么一键修复脚本就不要随意用了。

### 思路

大致的想法是生产环境隔离，这是让claude相信你是个美国人最简单的方式，如果有钱的话可以直接在一台配置ok的海外服务器上开发使用，git更新管理代码，但是这不仅要求海外服务器ip纯净（非万人骑的机场ip），还需要稍微高一点的配置，一般服务器1核1G内存可能不太够（纯净美国ip大概6$一个月，参考 [YinNet](https://www.yin-net.com)，工单回复快，就是国内出海线路一般）。

青见想了个骚招，组个局域网把claude塞进windows中的虚拟机ubuntu里，其他设备ssh远程这个环境开发。这也是没办法，毕竟封号的成本太高。下面记录一下具体流程：

## 1. Claude建号

### 创建美区苹果账号

主要参考了up主[风之任我行的教学视频](https://www\.bilibili\.com/video/BV1UYKN62E6x/?spm\_id\_from=333\.1391\.0\.0\&vd\_source=ac579ffd55e962ee11b9e5ecb12a4bb7)

1. 准备一个邮箱账号，使用outlook邮箱或者海外的教育邮箱账号，不推荐谷歌账号，谷歌账号的个人信息和使用情况感觉会被同步给claude。

2. 登陆icloud\.com，使用刚才的邮箱账号注册一个新的苹果账号，地区选择中国大陆，绑定的手机也填写中国大陆的手机号即可，保证可以收到短信。

3. 注册完毕后，使用苹果设备，退出app store中当前登录的苹果账号，登陆刚才注册好的苹果账号。打开VPN确保开了全局，或者最简单的下载uu加速器，加速app store即可。

4. 加速后，回到app store，点击头像账户，选择：国家/地区，更改为：美国。付款方式选择：无。地址填写美国免税州的地址。比如：
  
>    名字：随便
>    姓氏：随便
>    街道：456 Oak Ave
>    街道：空
>    城市：Portland
>    州：俄勒冈州
>    邮政编码：97201
>    电话：907 4863917

5. 点击完成后，就获得了一个美区的苹果账号

### 购买并兑换美区礼品卡

1. 由于只有美区可以使用apple 礼品卡，并用app store余额订阅app，所以需要购买一张美区的礼品卡。打开支付宝，把首页左上角的地区改为：旧金山。

2. 地区改成功后，搜索栏搜索：惠出境，领取：礼卡满减代金券。并点击：去使用。

3. 界面滑动到最下面：选择pockyshop，点击app store，购买对应价值的礼品卡。

4. 获得礼品卡代码后，返回app store，点击账号，选择兑换，输入刚才的代码即可完成充值。

### 下载claude订阅会员

1. 打开vpn，用之前注册好的美区苹果账号，下载claude；

2. 下载完毕后，用之前搭建好的vps代理所有流量，打开claude并选择使用苹果账号登陆。

3. 选择用隐藏邮箱登陆，这样就会获得一个结尾为：appleid\.com的苹果隐私邮箱，邮件默认会转发到你的苹果账号绑定的邮箱。如果收件箱没有邮件，需要查看是否到了垃圾邮件中。

4. 关闭claude设置中：获取定位，修改calendar等权限。

5. 使用苹果账户的余额完成付款订阅，这样就获得了一个用苹果隐私邮箱注册的claude账号

6. 后续在登录claudecode需要验证时，只需要查看苹果账号原始绑定的邮箱里面的邮件即可，隐私邮箱的邮件是自动转发的。

## 2. 网络配置

### 自建vps

> 这里只是为了自用和科研用途。

主机采用的[YinNet](https://www.yin-net.com)，海外网速不错，回国线路就比较慢，早上下行大概20Mbps，晚高峰下行2Mbps，上行一直保持20Mbps左右，4837线路。

我们建立了两条代理线路，一条采用VLess-Reality协议，一条采用VMESS协议，都被探测到的概率应该较小。VLess-Reality线路采用`3x-ui`管理，安装命令：

- Linux
```bash
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

刚开始搭建好之后访问下行非常慢，大约只有0.2Mbps，上行有20-30Mbps，开启了BBR TCP拥塞控制算法之后，线路速率明显改善。这是一个典型的跨国网络传输问题，首先能测出上行，这个搭建方式本身应该没有问题。

由于国际长途网络的延迟很高（中美之间通常在 200ms 以上），如果不开启 TCP 拥塞控制算法（BBR），只要网络出现一点点丢包，服务器就会立刻把下载速度降到冰点。这是所有做海外节点的人必须要开的功能。一键开启BBR:

- Linux
```bash
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

运行完后，输入 `sysctl net.ipv4.tcp_congestion_controlV 回车，如果返回结果里有 bbr，说明开启成功。此时测速下行已经能达到2Mbps（晚高峰），早上大概有20Mbps，能够正常使用了。

### VMWare虚拟机配置

虚拟机一定使用NAT模式而不是桥接模式。如果你将虚拟机改为桥接模式，虚拟机就相当于直接连接到了家里的路由器上。
这意味着，虚拟机的网络流量会直接发往路由器，完全绕过 Windows 系统的网络协议栈。因此，在 Windows 上开的 TUN 模式全局代理（如 Clash, V2ray 等）根本抓不到虚拟机的流量。
后果就是虚拟机里的应用，对外显示的 IP 会是本地宽带运营商的真实 IP，而不是自建 VPS 的干净节点 IP。
相反，在 NAT 模式下，虚拟机没有自己的外部 IP，它的所有流量都必须经过 Windows 主机进行转发。这时，Windows 的 TUN 虚拟网卡就能完美接管虚拟机的流量，让虚拟机享受干净的 VPS 代理。

为了方便VMWare虚拟机传输文件可以打开共享文件夹设置，不用担心破坏隔离性，首先虚拟机只有这一个文件夹的权限（不要设置成某个盘根目录，设置一个专门的目录），此外其底层使用的是 VMWare 专属的 HGFS (Host-Guest File System) 协议。这是一种通过虚拟机底层管理程序（Hypervisor）直接进行内存和磁盘映射的技术，完全不走传统的 TCP/IP 网络协议。
使用之前需要下载VMWare Tools。VMWare 共享文件夹在 Linux 系统中的默认存放路径是固定的。一般放在：

- Linux
```bash
ls /mnt/hgfs
```

### ssh配置

虚拟机中安装好openssh理论上在一个局域网的设备是互通的，可以通过ssh开发（多人连接）。但是虚拟机此时是NAT模式，网络是通过windows转发的，因此需要设置一下端口转发，比如我将windows宿主机的12345端口转发到虚拟机的22端口。

配置 VMWare 端口转发（注意VMWare网关是192.168.13.2，winodws宿主机网关192.168.13.1，192.168.13.128 ~ 254是留给虚拟机自由分配的IP池）：

- 在 VMWare 顶部菜单点击 “编辑” -> “虚拟网络编辑器”。

- 点击 “更改设置” 获取管理员权限。

- 选中 VMnet8 (NAT模式)。

- 点击 “NAT 设置”。

- 在弹出的窗口中，点击 “添加” 端口转发规则：

- 主机端口：填入 12345，类型 (Type)：TCP。

- 虚拟机 IP 地址：填入第一步查到的 Ubuntu IP（如 192.168.150.128）。

- 虚拟机端口：填入 22 (SSH默认端口)。

一路点击 “确定” 保存。

之后还需要给windows防火墙加一条入站规则（管理员），放行12345端口：

- Windows
```cmd
netsh advfirewall firewall add rule name="VMWare_Ubuntu_SSH_12345" dir=in action=allow protocol=TCP localport=12345
```

### 把VMWare虚拟机ip设置成静态

由于NAT模式下VMWare虚拟机是windows DHCP动态分配的，因此可能每次开关机之后地址会变，而我们之前的端口转发直接把ip写死了，所以我们可以把ubuntu虚拟机的ip固定死，这样每次打开ip都不会变，一劳永逸。

操作方式，在ubuntu系统中点击网络（Wired）旁边的设置，点击 “IPv4” 标签，将 IPv4 Method (获取方式) 从 Automatic (DHCP) 改为 Manual。然后 填写关键数据，在 Addresses下方的框里，填入以下内容：

- Address（地址）：填入刚才在 VMWare“端口转发”规则里填的那个虚拟机 IP。（必须和映射的 IP 保持完全一致）

- Netmask (掩码)：255.255.255.0

- Gateway (网关)：192.168.13.2

填写 DNS：
`192.168.13.2, 8.8.8.8`
第一个是本地的 VMWare DNS，第二个是谷歌的备用 DNS，保证解析没问题

应用并重启网卡，让新的静态 IP 立即生效。

这样在同一个局域网的设备都可以远程利用这台虚拟机的claude同时开发了。

> 本次实践和博客记录撰写由jiaxuan和青见共同完成。
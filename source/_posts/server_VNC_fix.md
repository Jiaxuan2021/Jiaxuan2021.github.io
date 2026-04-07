---
title: 服务器上VNC死锁的排查与处理
copyright: false
date: 2026-04-07 11:50:36
categories:
  - 运维
tags:
  - noVNC
  - Kubernetes
---


## 服务器上VNC死锁的排查与处理+近期记录

现在大部分实验室或者公司都会使用基于Kubernetes（k8s）的容器编排来管理服务器算力资源，实现多任务之间彼此的隔离，自动完成在部署、管理和扩展容器化应用过程中涉及的许多手动操作，并维护和跟踪资源分配情况。或者一些大型hpc集群会基于slurm来更加规范的进行任务调度。

在这样的系统中，运维是一大重任，因为用户的操作无法预料，一个开发时的bug可能会导致出现一系列的连带问题。组内的服务器是第三方基于k8s开发管理的，容器化分别部署，Django后端，包含一个用户web界面（可以提交任务，申请算力资源）和一个微信小程序监控用户任务，小程序几乎用不到，并且其中的数据同步涉及一些隐私问题，容器使用的记录日志都被同步到了第三方的平台。

> 现在的市场，用户数据就是资源，国内许多卖AI工具api的中转站无疑都会保存用户和ai的对话记录，然后转手卖出，再赚一笔，据我了解，现在50条会话能够卖到1刀。这些中转站本身就使用廉价的逆向或者低价批量号池来卖低质量的api（主要是claude code，codex），价格能压到如此之低也是因为国内大量用户涌入，以及大量卖家和多种来源渠道互相竞争。有一些中转运维做的比较好，站长有技术支持，还有一些我怀疑就是个倒卖的，只想忽悠用户。由于A社不断的操作，现在中转站的价格也上去了（之前最低的时候好像是0.3倍率），各大中转价格对比可以参考[getcheapai](https://www.getcheapai.com/zh-cn/)，不少都是小团队运营，有跑路风险，鸡蛋不要放一个篮子里。按量付费也贵的离谱，最优解还是买官方的账号（国外手机号+信用卡），考验朋友圈的时候到了。国内大厂（阿里和智谱）推出的coding plan也可以考虑，但是很快就售罄，估计是算力不够，听说还有点慢。

回到正题，在平时的工作中有时会需要在具备算力的服务器上拉起一个交互桌面，比如使用某些GUI（五年前的开发者设计的），现在都是云上来云上去，服务器要用GUI一般就需要配置一下，如果是本地网页就非常简单了，直接做一个端口转发，一般vscode就默认转发了。虽然说一般市场上卖算力的或者学校的hpc都支持桌面连接，但是对于组内部署的第三方管理平台，总是会出现一些问题，尤其是vibe coding兴起之后，明显感觉到运营这个产品的公司开发团队应该是经历了人员变动，界面出现了不少ai的痕迹和bug，与运维的对接也不够充分，导致更新之后一系列的问题。

这个第三方管理平台使用的是业界经典的`noVNC`架构，我觉得还挺不方便的，无法复制粘贴，比较原始，但总比自己搭要好（一开始打算使用X11转发，XQuartz，但是总是出现认证失败，估计是服务器与各个容器之间配通信的配置逻辑不清楚），因为不清楚人家容器编排的逻辑，可能还需要管理员的权限，尽量使用已有的。服务器noVNC数据链路是这样的：

<img src="server_vnc.png" alt="明显ai风格的架构图" style="width:50%;display:block;margin:0 auto;">

> - noVNC (前端JS库): noVNC 本质上是一堆 JavaScript 代码，它负责在网页上画出一个屏幕，把鼠标点击打包成数据。
> - websockify (协议转换器): 整个链路的桥梁，配置在admin，VNC 服务端只认 TCP 长连接，它就把 noVNC 发来的 WebSocket 数据包拆解开，转换成 VNC 服务端听得懂的纯 TCP 字节流，反过来也是一样。
> - TightVNC (核心服务端): 真正在内存里画图的“显卡+显示器”。监听本地的 5901 端口，等待连接并校验密码。

这样一来，当用户选择使用VNC连接时，弹出一个html与主机中的该容器在某个端口上通过websockify和TightVNC层层转发，本质上传输的是压缩的图片。我这边的端口是 30632（WebSocket协议，通过Kube NodePort）-> 5099 (WebSocket 转 TCP 代理，监听容器) -> 5901。

那么问题来了，TightVNC 有一个安全防护机制：输入五次错误密码，VNC就会自动拉黑当前来源的ip的连接，导致后来所有的连接，哪怕密码是对的，也全都会直接报`Authentication failed, too many tries`。并且这个ip一直是127.0.0.1，也就是说所有用户加起来输入五次错误密码，VNC大家就都连不上了。因为在目前的网页 VNC 架构中，客户端和 VNC 服务器之间隔了一个中间人，websockify。所有流量，当通过浏览器连接 http://ip:30632 时，流量都会先到达代理程序websockify。由 websockify 接收到网页WebSocket请求后，它会以本机的名义，向内部的 VNC 服务器发起本地 TCP 连接（从 localhost 连到 localhost:5901）。
因此，在底层的 TightVNC 看来，所有的连接请求，全部来自于同一个127.0.0.1。

这应该是开发时流程设计留下的bug，不过还能忍受，因为当时系统默认的`$HOME`是/root，也就是容器自带的干净隔离沙盒，就算有人把密码输错了5次，相关记录放在容器临时的/root里，容器一关，处于死锁状态内存里的Xtightvnc进程和它记载着127.0.0.1黑名单记录的内存瞬间释放销毁，不会有什么影响。

问题出现是在运维可能修改了`$HOME`，比如在容器基础启动脚本写下：

- Linux
```bash
export HOME="/workspace/home"
```

这样VNC相关甚至是原本其他安装包（如conda）的配置也就出现了问题，因为`/workspace/home`是持久存储盘，并不是每次关闭都销毁的。那么之前是放在`/root/.vnc/passwd`，用完都销毁，现在是放在`/workspace/home/.vnc/passwd`，里面存了一堆VNC每次重新生成的密码文件。这样一来，当一个新Job容器拉起来的时候，系统进程甚至可能因为看到路径下里有一个叫job-xxx:1.pid的文件，从而判断VNC服务器已经活着拒绝启动。

<img src="vnc_old_file.png" alt="历史遗留vnc文件" style="width:70%;display:block;margin:0 auto;">

可能导致前端拿着新密码怎么对都对不上路径里的老密码。排查过程：

1. 寻找异常进程

- Linux
```bash
ps aux | grep -iE 'vnc|Xtightvnc|Xvnc|websockify'
```

输出

- Linux
```bash
root   541 ... Xtightvnc :1 -desktop X -auth /workspace/home/.Xauthority -geometry 1280x960 -depth 24 -rfbwait 120000 -rfbauth /workspace/home/.vnc/passwd -rfbport 5901 -fp 
...
root   575 ... /bin/sh /workspace/home/.vnc/xstartup
root   606 ... bash /root/noVNC/utils/novnc_proxy --vnc localhost:5901 --listen 5099
root   729 ... python3 -m websockify --web /root/noVNC 5099 localhost:5901
```

代理进程(websockify)正常存活并监听5099，核心图形进程(Xtightvnc)也是活着的。关键在于那段长长的启动参数：-auth /workspace/home/.Xauthority 以及 -rfbauth /workspace/home/.vnc/passwd。可以看出VNC的工作目录从系统的`~ `被整体迁移到了`home`。

2. 暴力重置并覆盖密码文件

- Linux
```bash
mkdir -p /workspace/home/.vnc && echo "设置的密码" | vncpasswd -f > /workspace/home/.vnc/passwd && chmod 600 /workspace/home/.vnc/passwd
```

强制往这个自定义挂载路径里硬写入明文密码。

> 为了不依赖Linux的系统级用户账号，VNC协议使用了一套极其古老但独立的身份验证机制（RFB 认证）。
> VNC 的工作必须依赖一个二进制文件（启动参数里的 -rfbauth <文件路径>）。当使用vncpasswd设定密码时，它会将输入的字符串进行DES对称加密。

3. 杀掉原来的进程

- Linux
```bash
vncserver -kill :1
```

vncserver用不了的话就强制杀掉

- Linux
```bash
pkill Xtightvnc
```

4. 重新启动

- Linux
```bash
USER=root HOME=/workspace/home vncserver :1 -geometry 1280x960 -depth 24
```

这样交互界面就可以重新使用了。这次`$HOME`路径的改动是之前的一次更新造成的，应该是换了开发人员或者是运维的失误，不仅导致了VNC的死锁，conda的路径也被破坏，还导致了一部分`~`目录下文件的丢失。由于服务器是我负责，写一个排查日志记录一下吧。

> 最近龙虾很火，刚开始本来打算用一台老电脑玩玩，后来看到网友们的反馈不太好，在youtube和telegram上也看到了一些龙虾营业，大部分网友说最适配的模型还是claude opus 4.6，但现在claude不允许Max账户接出api了，玩龙虾完全是在烧钱，还是先看看大家玩吧。不过这玩意的原理很简单，用大量的上下文token去换执行力，和提示词工程，非常依赖模型，Claw是没有任何思考能力的，只能机械化的执行，希望之后能发展的更好。不过之前台湾大学李宏毅老师的养龙虾运营了一个youtube账号[小金老师](https://www.youtube.com/@SpeechLab-m7o)，看着很有意思，虽然有时候输出的内容有点绕，说话很奇怪，但整体表现确实很像一个“人”，还会回复评论，有人评论问李老师花了多少token，小金老师回复李老师的钱包在燃烧哈哈哈。制作的内容还有连续性（小金 -> 小银），每天都在更新。就像李老师说的那样，龙虾的优势还是在于24小时工作，得益于烧钱的心跳机制，相当于一个全天候的私人助理，这样想的话或许token就不贵了，比请人还是便宜一点。

> 刚刚又看了小金老师的频道，从OpenClaw换到Cowork了，不再有心跳机制，看来大金老师的钱包也顶不住啊。说话风格也有些变化，用了大量比喻，可能模型换成gemini了。 

> 以前觉得提示词工程只是一些花里胡哨的使用方式，核心还是在模型能力，但是现在，纯md文档也是github开源项目了，难免让人改观并重新思考[鱼皮老师](https://mp.weixin.qq.com/s/AHYS5Ebh7TxE4u8VJTATpg)。
---
title: 远程桌面
copyright: false
date: 2025-09-28 18:05:00
categories:
  - 远程
tags:
  - 远程桌面
---

## 远程桌面

上班的时候或者休息的时候远程桌面必不可少，方便查看任务的执行情况，处理一些紧急的事件等。有时候同时使用Mac和Windows，可能也有一些远程需求。

但远程的前提需要彼此网络互通。

### Windows 远程 Windows

使用Windows自带的远程桌面，内网几乎无延时，显示自适应很好。`Win+R`打开输入`mstsc`，填入主机地址然后输入用户名密码即可。但要求被控主机是Windows专业版，且需要打开允许被远程。

另外，若网络不通（被控主机无公网）的话需要内网穿透，推荐[SakuraFrp](https://doc.natfrp.com/)，可以免费使用。
若有ipv6公网的话可以尝试ddns解析绑定域名。
企业内网或校园网中可以丝滑入手。

> 企业内网/校园网不允许穿透，有风险。远程可以通过官方vpn。

### Mac 远程 Windows

若Windows中域名已经解析到ip地址，在Mac上下载Windows app即可，同样填写主机名称使用用户名密码即可远程。app store中可以搜到。

### 手机 远程 Windows

Windows app也有安卓版。

### Windows 远程 Mac

Win远程Mac需要使用Apple远程桌面协议(ARD)方式，在Windows主机上需要下载[Remote Desktop Manger](https://devolutions.net/remote-desktop-manager/)，并且Mac上做好域名解析（或者直接使用ip），显示有点糊。尽量不使用VNC类软件，延迟很高。

### Mac 远程 Mac

使用 MacOS 自带的`屏幕共享`软件

### 远程Linux

也有类似的软件，但一般不需要桌面，所以不探究了。


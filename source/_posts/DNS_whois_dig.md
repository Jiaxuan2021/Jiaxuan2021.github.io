---
title: DNS 缓存清理、查看本地 DNS、whois 与 dig
date: 2025-09-28 20:31:36
categories:
  - 网络
tags:
  - DNS
  - dig
  - whois
  - 缓存
copyright: false
---

网络诊断或者做一些抓包实验有时候需要清理DNS缓存

## 一、清理 DNS 缓存

- macOS
  ```bash
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  ```

- Windows
  ```cmd
  ipconfig /flushdns
  ```

- Linux
  ```bash
  sudo systemd-resolve --flush-caches
  ```

 常见的情况：电脑把DNS查询请求都发给了路由器，再由路由器向上一级的ISP（网络服务商）或它自己设置的DNS服务器转发
 也可以自己设置为公用的DNS

 ## 二、查看本地 DNS 配置

 - Windows（仅显示含 “DNS” 的行）
  ```cmd
  ipconfig /all | findstr "DNS"
  ```

- macOS
  ```bash
  scutil --dns | grep 'nameserver\[[0-9]*\]'
  ```

- Linux
  ```bash
  resolvectl status        # 或
  systemd-resolve --status # 旧别名
  cat /etc/resolv.conf     # 某些环境由 NetworkManager/容器接管
  ```

## 三、用 whois 确认机构的 IP 网段

有时使用机构内网需要知道其IP网段

- 目的：确认某单位是否拥有/使用某 IP 网段（例如：`103.189.154.0/23` 覆盖 `103.189.154.0–103.189.155.255`）。

- 首先查询IP，例如
  ```bash
    nslookup www.hkust-gz.edu.cn
    ```
- 再使用whois IP，查看inetnum即为网段范围

## 四、用 dig 确定域名的权威 DNS 与解析路径

- 使用dig可以确定解析校内网址（如学院名soch.hkust-gz.edu.cn）的DNS位于哪里

- 查询某域名的权威 NS（名称服务器）
  ```bash
  dig example.com NS +short
  ```
- 查看从根到权威的完整解析链路（排查转托管/委派问题很有用）
  ```bash
  dig example.com +trace
  ```
- 指定 DNS 服务器查询记录（对比不同递归/权威源头）
  ```bash
  dig @8.8.8.8 example.com A +noall +answer
  ```
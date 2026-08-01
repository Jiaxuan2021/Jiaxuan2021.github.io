---
title: K8s 踩坑实录：从 kube-apiserver 证书过期到业务假死的排查
copyright: false
date: 2026-07-10 19:27:05
categories:
  - 运维
  - 服务器
tags:
  - K8s
  - Kubernetes
  - certificate
---


## K8s 踩坑实录：从 kube-apiserver 证书过期到业务假死的排查

在 Kubernetes (K8s) 集群的日常维护中，证书过期是一个经典的“坑”。但有时候，即便修复了集群的证书，上层的业务容器却依然处于“假死”状态。由于这个问题在之后还可能碰到，这里记录一下现阶段的操作和一些配置，方便之后查看。
本文记录了一次真实的生产环境排查过程，并最终给出了一个“一秒钟且永久免疫”的优雅修复方案。

### 故障现场

在一台由 Kubeadm 管理 GPU 资源的服务器上，无论是 root 还是普通用户，在使用 kubectl 命令查看容器或任务时，突然全部报错，依托于它的web网页上的数据直接不更新，也无法操作新建容器。

报错日志：
- Linux
```bash
gpu@gpu4u8:~$ kubectl get pod -A
Unable to connect to the server: x509: certificate has expired or is not yet valid: current time 2026-07-10T14:39:02+08:00 is after 2026-07-09T02:54:58Z
```

> **x509 报错**： 在 K8s 中，所有的组件（无论是外部的 kubectl 还是内部的节点）在和核心大脑（API Server）通信时，都需要通过 TLS 证书来证明自己的身份。
> 上述报错指出：kube-apiserver 的服务端证书已经过期了。因此，API Server 拒绝了所有连接。

### 常规修复

既然是 Kubeadm 部署的集群，修复证书并不复杂。常规操作流程：
1. 续签集群证书：`kubeadm certs renew all`
2. 覆盖宿主机配置文件：
- Linux
```bash
cp /etc/kubernetes/admin.conf ~/.kube/config
```
3. 重启 `kubelet` 和 `apiserver` 容器

诡异现象发生：
做完上述操作后，宿主机上执行 kubectl get pod 已经恢复正常。但是，前端网页上显示的数据仍然是之前的数据记录（曾经的任务一直卡在页面上，无法创建新任务）。
查看后端业务容器 `d2vm-app` 的日志，发现没有任何业务请求，全是 K8s 健康检查（探针）的日志：
- Linux
```bash
kubectl logs -n haios -l app=d2vm -f
[2026-07-10 18:40:08 +0800] [1668] [DEBUG] GET /health/
[2026-07-10 18:40:08 +0800] [1668] [DEBUG] Closing connection.
[2026-07-10 18:41:02 +0800] [1668] [DEBUG] GET /health/
[2026-07-10 18:41:02 +0800] [1668] [DEBUG] Closing connection.
...
```

### 深挖业务架构

为什么宿主机好了，容器里的业务却没好？查看业务容器 `d2vm-app` 的 Deployment 配置，发现了盲点：
- Linux
```bash
# 来自 deployment yaml
volumeMounts:
- mountPath: /root/.kube/config
  name: kube-config
  readOnly: true
  subPath: kubeconfig
volumes:
- name: kube-config
  secret:
    defaultMode: 384
    secretName: d2vm-ssh-kube-config
```

业务容器虽然读取的是 `/root/.kube/config`（容器内部），但这并不是宿主机上的那个文件！它是开发团队在很久以前（比如部署时）将当时的 admin.conf 复制了一份，存进了 K8s 的 Secret（加密字典）中，然后挂载给容器的。既然容器和物理机不通，那容器里的那个 `/root/.kube/config` 是从哪里冒出来的呢？其实来自Kubernetes 的数据库（etcd）。

在ai的帮助下还原一下现场，在两年前第一次部署这个系统时，开发人员做了一个“拍照备份”的操作：
1. 他们把当时物理机上的 `/root/.kube/config` 文件的文字内容复制了下来。
2. 他们把这段文字粘贴到了 K8s 的系统里，创建了一个叫做 d2vm-ssh-kube-config 的 Secret（加密数据字典）。
3. 这个 Secret 就作为一条记录，存放在了 K8s 的内部数据库里。当 `d2vm-app` 这个容器启动时，容器把 d2vm-ssh-kube-config 这个 Secret 里的文字拿出来，变成一个文件，塞进容器的 /root/.kube/config 路径下。

所以问题在于：执行的 `kubeadm certs renew all` 只更新了宿主机上的物理文件，并没有更新存在 K8s Secret 里的那份历史副本！
因此，业务容器依然拿着早已过期的旧证书去请求 K8s 接口，被拒绝，导致无法获取最新任务数据，前端只能显示数据库里缓存的“幽灵数据”。

### 尝试修复

我不太想改过多的配置，这个系统并不是我开发，我只是帮着运维而已，无奈还学了不少东西。最后的解决方案，肯定是越简单越好，改动越小越好，省的出现各种连带bug。

原因已经明确，尝试将宿主机上最新的 admin.conf 转换成 Base64，并 Patch 替换掉那个旧的 Secret，然后重启业务 Pod。本以为大功告成，但在强制刷新网页触发业务后，日志里弹出了新的报错：
- Linux
```bash
Error from server (Forbidden): pods is forbidden: User "system:serviceaccount:haios:default" cannot list resource "pods" in API group "" in the namespace "haios"
Error from server (Forbidden): nodes is forbidden: User "system:serviceaccount:haios:default" cannot list resource "nodes" in API group "" at the cluster scope
2026-07-10 18:45:42 haios-logger  /app/D2VM/node/manage_resource.py:148 manage_resource:update_resource INFO- {}
```

ServiceAccount 权限不足？

这行日志暴露了 Python K8s 客户端底层的Fallback（降级）机制：

- 程序本来想读刚修复的 Secret（kubeconfig）
- 但可能由于手动 Patch Base64 时多了一个换行符，或者 Python 严格的 YAML 库觉得格式不合规，导致读取失败
- 关键的是客户端读取配置失败后，没有直接崩溃，而是自动降级，改用容器原生的 ServiceAccount 身份去连接 K8s
- 但是，K8s 默认的 ServiceAccount 是没有任何权限的，所以报了 Forbidden，程序拿到空数据 {}，网页依然无法刷新

到这里，可以选择回头去排查 Base64 到底哪里多了一个换行符，继续维护那个“伪造”的 Kubeconfig。或者顺应原生机制，直接给这个 ServiceAccount 赋予权限。

Gemini建议选第二种，Gemini原话：
> 在 K8s 业界最佳实践中，容器内的程序访问 K8s API 本来就不该用硬编码的 Kubeconfig，而应该使用自动轮转的 ServiceAccount！ 之前的开发团队为了图省事，把高权限证书硬塞给容器，本身就是一个容易暴雷的“反模式”。

这可不是我说的，不过这种一年一度的证书过期确实很恶心，主要是不好排查。Gemini在问题排查以及逻辑梳理上比ChatGPT还是好一些，GPT无用输出太多。

因此直接赋予原生身份集群管理员权限：
- Linux
```bash
kubectl create clusterrolebinding d2vm-admin-binding --clusterrole=cluster-admin --serviceaccount=haios:default
```

命令瞬间生效，不需要重启任何 Pod。业务立即恢复，Python 代码立刻拿到了真实数据，覆盖了空字典 {}，前端网页的旧任务被自动清理，系统完全恢复正常。此外，ServiceAccount 的凭证是由 K8s 内部自动管理的，永远不会过期。

如果出了问题想要还原：
- Linux
```bash
kubectl delete clusterrolebinding d2vm-admin-binding
```
执行后，权限瞬间收回，对其他任何业务没有影响。

### 总结

拥抱 RBAC： Pod 内应用调用 K8s API，通过 `ServiceAccount + RoleBinding/ClusterRoleBinding` 进行授权，安全、省心、免维护。

业界标准的 “RBAC 最小权限管控” 流程：

一个规范的开发团队，他们会精确统计 Python 代码里到底调用了哪些 K8s 资源，然后按需分配：
- Yaml
```yaml
# 第一步：创建一个专属身份（不使用 default）
apiVersion: v1
kind: ServiceAccount
metadata:
  name: d2vm-sa
  namespace: haios

# 第二步：创建一个受限的角色（只给需要的动作）
# 比如代码只需要查询节点（Node），以及在自己命名空间增删改查 Pod：
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: d2vm-node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list"] # 只能看，不能删节点
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: d2vm-pod-manager
  namespace: haios
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "create", "delete", "watch"] # 可以管理 Pod
```

第三步：把角色绑定给专属身份

- Linux
```bash
# 绑定节点读取权限
kubectl create clusterrolebinding d2vm-node-bind --clusterrole=d2vm-node-reader --serviceaccount=haios:d2vm-sa
# 绑定 Pod 管理权限
kubectl create rolebinding d2vm-pod-bind --role=d2vm-pod-manager --serviceaccount=haios:d2vm-sa -n haios
```

第四步：在 Deployment 里指定使用这个专属身份
- Yaml
```yaml
spec:
  template:
    spec:
      serviceAccountName: d2vm-sa  # <- 容器声明
      containers:
      - name: d2vm-container
```

虽然ai说按照当前给予权限的方式有一定安全问题，但是不是开发者，我能做的也有限，先记录这些下次遇到再看吧。
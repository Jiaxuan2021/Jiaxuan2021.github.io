---
title: 信息整理
date: 2025-09-30 17:41:44
categories:
  - 工具
tags:
  - Serverless
  - Distributed training
  - Tmux
  - Claude code
copyright: false
---

## LeanCloud

Serverless云开发或者函数即服务对于经常需要部署的前端静态网页很有效，腾讯云阿里云相关服务使用一段时间之后需要付费，如果只是轻量的数据没有必要。如果网页是托管在其他平台，并且不想每次改一个值都要打开源码然后push到服务器，可以考虑使用。

使用教程：
> More Info: https://cloud.tencent.com/developer/article/1558010

## 分布式训练

现在深度学习模型越来越大，一般来说使用A6000显卡显存能满足大部分科研需求，但目前能使用的只有4090，24G的显存有时确实不够挥霍。之前研究了一会分布式，在使用分布式之前其实可以先优化自己的训练代码，比如适当减小训练图像尺寸、使用混合精度训练、CPU卸载、梯度检查点等。

很多机构的HPC或者服务器集群使用slurm或者Kubernetes管理，一些指令可以用于提交job训练任务。

- hkust-gz HPC基于slurm，相关指令[Link](https://docs.hpc.hkust-gz.edu.cn/docs/hpc3/slurm/job)

> 学校智算集群还是很牛的，第一次看到的时候有点震惊[Link](https://docs.hpc.hkust-gz.edu.cn)

slurm或者Kubernetes主要还是用于运维多机多卡之间的通信协同或者容器管理等，一般不需要我们用户考虑。但是模型训练时，怎么数据并行、模型并行或者混合并行，以及多进程之间的某些任务分配，是需要用户自己设置的。

有几篇博客写的很好：

> 1. [知乎博客-分布式训练详解](https://zhuanlan.zhihu.com/p/721941928)
> 2. [LiLian Weng's Blog: How to Train Really Large Models on Many GPUs?](https://lilianweng.github.io/posts/2021-09-25-train-large/)
> 3. [DeepSpeed训练教程](https://www.cnblogs.com/yjbjingcha/p/18996270)


总的来说分布式训练主要分三类：

1. 数据并行

    一般用来加速训练或者对比学习需要大batch size时，一般使用 `torch.nn.parallel.DistributedDataParallel`就行。
    主要原理就是多进程控制多GPU训练（单机多卡），但是模型在每张卡上都会复制一份，当模型大到单张卡放不下时就无法使用了，这个时候就需要模型并行或者混合并行。

2. 模型并行

    模型并行一般分为流水线并行（横切）和张量并行（竖切），Megatron就使用了张量并行技术。但是一般只在模型特别大的时候才使用，其他时候用混合并行就够了。并且模型并行需要对模型文件破坏性改造，要自己切片，难度较大。

3. 混合并行

    一般使用DeepSpeed或者Megatron，推荐微软官方的DeepSpeed，基于[ZeRO: Memory Optimizations Toward Training Trillion Parameter Models](https://arxiv.org/abs/1910.02054)这篇论文。代码链接 (https://github.com/microsoft/DeepSpeed)
    
    当年李沐大神也解读了这篇文章[Link](https://www.bilibili.com/video/BV1tY411g7ZT)，李沐大佬自己就是这个领域的，讲的也很好理解。这篇文章微软官方也写了一篇帖子[Link](https://www.microsoft.com/en-us/research/blog/zero-deepspeed-new-system-optimizations-enable-training-models-with-over-100-billion-parameters/)，里面还做了一个演示视频，非常清晰的演示了整个分布式训练的整个流程，讲的特别好。

    > DeepSpeed使用教程可以参考 [Link](https://github.com/deepspeedai/DeepSpeedExamples/tree/master/applications/DeepSpeed-Chat/training/step1_supervised_finetuning)，一般先使用Zero stage 1，显存不够再使用Stage 2，还不够再使用Stage 3。具体使用时有什么bug后续再来记录。

## Tmux

> 连接服务器必用

用户与服务器的临时交互称（终端窗口）为一次会话（session），这个窗口和它的启动进程是关联的，进程会随着窗口一起关闭。某些时候网络断开，就算没有运行完会话内部的进程也被终止了，这样就找不回上一次执行的命令。

Tmux的作用将会话和窗口解绑，窗口关闭时，会话并不终止，而是继续运行，等到以后需要的时候，再让会话"绑定"其他窗口，和screen相似，但screen窗口存在各种bug，tmux相比来说更好用。此外，它允许每个会话有多个连接窗口，因此可以多人实时共享会话。

## Claude code 恢复对话

- Linux or macOS
  ```bash
  claude -c   # 启动
  ```

或者claude code中输入
- Linux or macOS
  ```bash
  /resume  
  ```


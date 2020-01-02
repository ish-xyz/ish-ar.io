---
title: 'eBPF: Dive into the verifier!'
date: "2019-08-02T18:00:00.000Z"
description: "If you have already read my previous article, you probably know what the verifier is. Anyway let's make a short recap.
eBPF allows you to execute a program (BPF bytecode) directly inside the kernel through an in-kernel VM. Since the code comes from the user space, and as users we do a lot of mistakes (believe me), the code needs to be checked before the execution...."
---
NOTE: *If you don't know what eBPF is you should check out my [previous post](https://ish-ar.io/eBPF_my_first_2_days_with_it/)*

## What is the eBPF verifier?

!['sherlock'](./sherlock.jpg)

If you have already read my previous article, you probably know what the **verifier** is. Anyway, let's make a short recap.

eBPF allows you to execute a program (BPF bytecode) directly inside the kernel through an in-kernel VM. Since the code comes from the user space, and as users we do a lot of mistakes (believe me), the code needs to be checked before the execution.

For that reason, there's a component called "verifier" which verifies ( :D ) your code before proceeding with the execution.

This component is like 10k rows of C. Really readable, tho.
Today I'll try to explain some of the checks performed by it and some limitations that you must follow when writing your BPF program.


## eBPF verifier: first check.

Your program must be DAG - "Directed Acyclic Graph".
This requirement ensures that your BPF program doesn't have any backward branches, it must be a directed graph.
Different parts of the program can branch forward to the same point, though. So it's not a "tree".

!['DAG_representation'](./DAG.png)

*A Directed Acyclic Graph representation from Wikipedia.*

Also, your program must be compliant with the following:

- You cannot use loops and call other functions, except for the BPF helpers and functions defined as __always_inline.

- Your program can't be larger then BPF_MAXINSNS instructions, according to the macro in [bpf_common.h](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/bpf_common.h) the limit for the Linux Kernel is 4096.

- Last but not least: unreachable code is not allowed.

Those checks are performed by the function "check_cfg" as you can see [here](https://github.com/torvalds/linux/blob/master/kernel/bpf/verifier.c).


## eBPF verifier: second check.

!['eBPF_verifier_meme'](./meme.jpg)



After the first check, the verifier will try every path of your BPF code.
Whenever comes into a condition, it explores one path and pushes the instructions for the other path into a stack. If it will reach bpf_exit() without any issues, with an R0 value, the verifier will then start taking the instructions and checks any other code path from the stack (which is a LIFO so it will start from the last pushed).

As we can see the verifier is an essential component for eBPF. Have a better understanding of how it works, helps us to reduce the time consumed when writing BPF programs and maybe/hopefully help others improving it.


That's all for today :)


NOTE: 
If you want to take a look at the verifier source code, you can find it here:
https://github.com/torvalds/linux/blob/master/kernel/bpf/verifier.c

---
title: 'How to trace a Python application with eBPF/BCC'
date: "2020-03-12T18:00:00.000Z"
description: "A couple of weeks ago, a friend of mine, who is developing a Python application that performs data transformation, wanted a way to know at what step of the data pipeline, a particular task/process is..."
redirect_from:
  - /python_ebpf_tracing/
---

![python-tracing](./python-tracing.png)

## Intro

A couple of weeks ago, a friend of mine, who is developing a Python application that performs data transformation, wanted a way to know at what step of the data pipeline, a particular task/process is.

I am aware that this challenge might have different solutions, and it heavily depends on the use case, but I wanted something more than the usual workaround.
Some workarounds that immediately pop up in our mind might be:
1. Update an external endpoint every time the application enters a new function.
2. Dump logs for each transaction and interprets them.
3. Make all the connections of the micro-services passing through a proxy which can keep of every single process.

These "solutions" didn't seem the best fit for me, they all require to edit the code at least a little bit, and the third one is only feasible if the codebase is running into a particular infrastructure and if it's architected as a micro-services application.
I wanted something that doesn't require editing a single line of code. The answer? eBPF + BCC!

## Tutorial (25 mins ~):

Let's get to today's topic: How to profile/trace a Python application without editing the codebase.

#### Requirements

1. A GCP Account, if you don't have an account, you can register [here](https://cloud.google.com/), and you will get 300USD as free credits.
2. Git installed.
3. Terraform 0.12.* installed in your machine (If you don't have it, you can download it from [here](https://www.terraform.io/downloads.html))

4. I also suggest a general understanding of Terraform and eBPF. However, it is not essential. More information about eBPF can be found here: [eBPF intro](https://ish-ar.io/ebpf_my_first_2_days_with_it/) & [eBPF verifier](https://ish-ar.io/ebpf_dive_into_the_verifier/)


#### Tutorial description

We will provision a Google Compute instance (CentOS 8) via Terraform, install BCC, and run bcc/uflow to trace/profile a pre-created Python application.

The application generates some fake analytics for an Instagram user. It performs login, retrieve likes/followers, aggregate and return them.

Our tracing will let us know at which point of the code path the process is.


#### Create the infrastructure

First of all, we need to create our CentOS 8 box on Google Cloud Platform (GCP).

To do that, I have prepared a simple terraform configuration.


    NOTE: To run Terraform on GCP, you will need a service 
    account and the related key-file. 
    You can find more information here:
    https://cloud.google.com/iam/docs/creating-managing-service-accounts
    https://www.terraform.io/docs/providers/google/index.html

So let's download the terraform code I've prepared:

    git clone https://github.com/ish-xyz/bcc-python3-profiler-demo


Inside the repository, you will find the following structure:

    .
    ├── app
    │   └── app.py
    ├── main.tf
    ├── provider.tf
    └── templates
        └── bootstrap.sh.tpl

Create the CentOS instance:

    vi keyfile.json   # Insert the GCP key-file here to set up the authentication

    terraform init
    terraform plan  # NOTE: You should see 0 destroy, if not check your infrastructure
    terraform apply -auto-approve

After the terraform execution, we should have an output similar to:

    ssh -i demo-key.pub demo-user@{server_ip}

We can also run ```terraform output``` to view the connection string.


#### Install BCC and other required packages

Now that we have our new brand instance on Google Cloud Platform, we need to install BCC and the required tools. 

As I have mentioned, [BCC](https://github.com/iovisor/bcc) is based on eBPF. 
If you are using your own box, you may want to check [here](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md)if your instance/kernel has the correct version/architecture.


Switch to root and install bcc (NOTE: for the remaining part of the tutorial I will use the root user)

    sudo -i
    cd /home/demo-user/ish-ar.io-demo
    yum install bcc-tools wget make -y

Add BCC commands to your path:

    export PATH=${PATH}:/usr/share/bcc/tools/


Test if BCC works, try a command like execsnoop, it should give you an output like this:

    [root@ish-ar-demo-bcc ~]# execsnoop
    PCOMM            PID    PPID   RET ARGS

#### Understanding BCC/Uflow

The command we're going to use is pythonflow, which is a wrapper of uflow (Source code here).
To understand better uflow here's a definition:

Uflow traces method calls and prints them in a flow graph that can facilitate debugging and diagnostics by following the program's execution (method flow).
This tool relies on USDT probes embedded in many high-level languages, such as Java, Perl, PHP, Python, Ruby, and Tcl. It requires a runtime instrumented with these probes, which in some cases, requires building from source with a USDT-specific flag.
Since this uses BPF, only the root user can use this tool.

USDT (Userland Statically Defined Tracing) is the mechanism by which application developers embed DTrace probes directly into an application. Since USDT probes are part of the source code, scripts that use them continue working even as the underlying software evolves, and the implementing functions are renamed or deleted.

According to the definition above, to use uflow correctly on our Python application, we need to have Python with USDT.

To do that run:

    tplist -l $(which python3) # Empty output

If the output is empty (like mine -.- ) well... It means that we need to compile Python with Dtrace! :)



#### Compile Python3 with DTrace

At this point, you should be inside a directory called ```/home/demo-user/ish-ar.io-demo```, if not move to it.

Install Systemtap, yum-utils and 

    yum install systemtap-sdt-devel  yum-utils -y

Run [yum-builddep](https://linux.die.net/man/1/yum-builddep) for Python:

    yum-builddep python3 -y

Download & extract Python source files:

    wget https://www.python.org/ftp/python/3.6.8/Python-3.6.8.tar.xz
    tar -xvf Python-3.6.8.tar.xz
    rm -rf Python-3.6.8.tar.xz
    cd Python-3.6.8

Configure Python with DTrace:

    ./configure --with-dtrace
    make    # You might have some warnings, don't worry about them
    make install

Check if our new python binary has DTrace enabled:

    tplist -l ./python   # You should have an output like this:
    [root@ish-ar-demo-bcc Python-3.6.8]# tplist -l ./python
    b'./python' b'python':b'gc__start'
    b'./python' b'python':b'gc__done'
    b'./python' b'python':b'line'
    b'./python' b'python':b'function__entry'
    b'./python' b'python':b'function__return'


#### Run & Trace your application

Running the application without tracing:

    [root@ish-ar-demo-bcc Python-3.6.8]# ./python ../app.py 
    {'followers': 700, 'likes': 50000, 'pictures': 100, 'engagement': 0.7142857142857143}

Now we want to trace our application, right?
Before doing it, we need to adjust a symbolic link:

    unlink /lib/modules/4.18.0-147.3.1.el8_1.x86_64/build
    ln -s /usr/src/kernels/4.18.0-147.5.1.el8_1.x86_64 /lib/modules/4.18.0-147.3.1.el8_1.x86_64/build

Let's try out uflow:

    ./python ../app.py > /dev/null & 
    pythonflow $!

    CPU PID    TID    TIME(us) METHOD
    0   21541  21541  0.749    <- ../app.py.login
    0   21541  21541  0.749    -> ../app.py.get_likes
    0   21541  21541  3.752    <- ../app.py.get_likes
    0   21541  21541  3.752    -> ../app.py.get_followers
    0   21541  21541  6.755    <- ../app.py.get_followers
    0   21541  21541  11.762   <- ../app.py.run_analytics
    0   21541  21541  11.762   <- ../app.py.<module>

As displayed above, uflow allows us to trace when a function is entered and returned!

If you want to see the BPF program that BCC generates (which I think it's VERY INTERESTING), you can run:

    ./python ../app.py > /dev/null & 
    pythonflow --ebpf $!

Although it looks impressive, there are some considerations we need to do.


## Considerations

#### Overhead

This tool has extremely high overhead because it prints every method call. For some scenarios, you might see lost samples in the output as the tool is unable to keep up with the rate of data coming from the kernel.
Filtering by class or method prefix can help reduce the amount of data printed.

#### Do I need it?

Well, if you are starting with a new application, you might evaluate also other tracing/profiling tools or code probes into your application, as you can still edit/re-architecting your software.
However, I do believe that this is still a good solution to profile an application.

I hope this has been useful to you!

Cheers :)

---
title: 'KPROBES in a nutshell'
date: "2019-08-24T14:25:00.000Z"
description: "In the last two months I have noticed a lot of posts, tweets ..."
---
## What Kprobes is?

!['kprobes'](./kprobes.jpg)

Here is the definition from kernel.org: 

*"Kprobes enables you to dynamically break into any kernel routine and collect debugging and performance information non-disruptively. You can trap at almost any kernel code address [1]_, specifying a handler routine to be invoked when the breakpoint is hit....*

*...When a CPU hits the breakpoint instruction, a trap occurs, the CPU's
registers are saved, and control passes to Kprobes via the
notifier_call_chain mechanism.  Kprobes executes the "pre_handler"
associated with the kprobe, passing the handler the addresses of the
kprobe struct and the saved registers."*

~ So basically it allows you to run 2 functions, pre_handler and post_handler, every time the probed function is invoked ~

To be honest, the first time I heard about Kprobes, Jprobes, Kretprobes and so on ... It all sounded a bit complicated to me. Happy to say though, that after some hours doing researches, it now start to make sense.

Note that nowadays there is an easier way to use Kprobes than the one I'll show you today ... but I'll write about that in the next article. Yes I am talking about bpf() !

**So how are we going to use Kprobes today?**

Easy! By creating a **simple** kernel module, inserting it into our Kernel and testing it. Dont' be scared it is a really simple task even if it sounds tricky.

**TUTORIAL GOAL**: Create a kernel module that uses Kprobes to count anytime the function ${function} is used.

First thing first: REQUIREMENTS!

You need a **Linux machine** !

!['genius'](./genius.gif)


*NOTE: I've only tested this procedure on my private server (Ubuntu 18.04.2 LTS Bionic Beaver) so you might need to find the right packages names if you're using a different OS, and the Kernel module we'll create might not work on different architectures.*

1.	Create the workdir and install the required packages.

	```
	mkdir ./ish-ar.io-lab/ && \
	touch ./ish-ar.io-lab/{Makefile,ish.c} && \
	cd ./ish-ar.io-lab/

	apt-get update && \
	apt-get install gcc strace make libelf-dev -y

	```

2.  Edit the file  ```Makefile``` as follow:

    ```
    obj-m +=ish.o
    KDIR= /lib/modules/$(shell uname -r)/build
    all:
			$(MAKE) -C $(KDIR) SUBDIRS=$(PWD) modules
    clean:
			rm -rf *.o *.ko *.mod.* .c* .t*

    ```
    <sup>*NOTE: when you need to call ```make``` inside a ```Makefile``` it is a best practices to use the variable ```$(MAKE)``` not the command.*</sup>
	
	**IMPORTANT -> Ensure you're using tabs and not spaces on your Makefile, otherwise you'll get an error saying:**
	```
	Makefile:N: *** missing separator (did you mean TAB instead of 4 spaces?).  Stop.

	```

3.  We need to find out which function we want to count/intercept.


	* In this example I wanted to count everytime a program is executed. So I've searched the function I wanted like this:
		```
		strace ls 2>&1 | less

		```

	* At the top you should see something like this: 
		```
		execve("/bin/ls", ["ls"], 0x7fff38f23780 /* 21 vars */) = 0

		```


	* It looks like ```execve``` is the function we want to intercept! We now need its memory address to probe it later. So let's search for it:

		```
		root@ip-172-31-3-95:~/lab# grep sys_execve /proc/kallsyms
		ffffffffbcc7f010 T sys_execve
		ffffffffbcc7f050 T sys_execveat
		ffffffffbcc7f0b0 T compat_sys_execve
		ffffffffbcc7f100 T compat_sys_execveat

		```

		<sup>*If you don't know what this file ```/proc/kallsyms``` is, you should checkout this page -> https://onebitbug.me/2011/03/04/introducing-linux-kernel-symbols/*</sup>

	* So, we have our function called sys_execve and its address is ffffffffbcc7f010.


4.  Now edit the file ```ish.c```:

    - We need to include the required libraries, so at the top of our C program let's type:
	
		*NOTE: This library #include<linux/kprobes.h> as you see by its name is absolutely foundamental to use kprobes.*
		```
		#include<linux/module.h>
		#include<linux/version.h>
		#include<linux/kernel.h>
		#include<linux/init.h>
		#include<linux/kprobes.h>

		```
	
    - Right after the includes, create 2 simple structures. We will need them later.
		```
		static unsigned int counter = 0;
		static struct kprobe kp;

		```

    - Do you remeber I've written about the pre_handler and post_handler functions? Let's create them first.

    	*Just as a remind: the pre_handler function it is execute right before our intercepted function and the post_handler function it is executed after it.*

		```
		int kpb_pre(struct kprobe *p, struct pt_regs *regs){
			printk("ish-ar.io pre_handler: counter=%u\n",counter++);
			return 0;
		}

		void kpb_post(struct kprobe *p, struct pt_regs *regs, unsigned long flags){
			printk("ish-ar.io post_handler: counter=%u\n",counter++);
		}

		```

    - Right after this 2 functions let's create our module entry-point and exit-point.
		```
		int minit(void)
		{
			printk("Module inserted\n ");
			kp.pre_handler = kpb_pre;
			kp.post_handler = kpb_post;
			kp.addr = (kprobe_opcode_t *)0xffffffff8d67f010;
			register_kprobe(&kp);
			return 0;
		}

		void mexit(void)
		{
			unregister_kprobe(&kp);
			printk("Module removed\n ");
		}
		module_init(minit);
		module_exit(mexit);
		MODULE_AUTHOR("Isham J. Araia");
		MODULE_DESCRIPTION("https://ish-ar.io/");
		MODULE_LICENSE("GPL");

		```

		Everytime you insert this module the function minit will be triggered and if you remove the kernel module the function mexit will be invoked.


		**IMPORTANT**: Replace ```kp.addr = (kprobe_opcode_t *)0xffffffff8d67f010;``` with the function memory address you discovered at step 3 --> ```kp.addr = (kprobe_opcode_t *)0xFUNCTION_MEMORY_ADDRESS;```.

5. Your early created Kernel Module should look like this:
    ```
    #include<linux/module.h>
    #include<linux/version.h>
    #include<linux/kernel.h>
    #include<linux/init.h>
    #include<linux/kprobes.h>

    static unsigned int counter = 0;

    static struct kprobe kp;


    int kpb_pre(struct kprobe *p, struct pt_regs *regs){
        printk("ish-ar.io pre_handler: counter=%u\n",counter++);
        return 0;
    }

    void kpb_post(struct kprobe *p, struct pt_regs *regs, unsigned long flags){
        printk("ish-ar.io post_handler: counter=%u\n",counter++);
    }

    int minit(void)
    {
        printk("Module inserted\n ");
        kp.pre_handler = kpb_pre;
        kp.post_handler = kpb_post;
        kp.addr = (kprobe_opcode_t *)0xFUNCTION_MEMORY_ADDRESS;
        register_kprobe(&kp);
        return 0;
    }

    void mexit(void)
    {
        unregister_kprobe(&kp);
        printk("Module removed\n ");
    }

    module_init(minit);
    module_exit(mexit);
    MODULE_AUTHOR("Isham J. Araia");
    MODULE_DESCRIPTION("https://ish-ar.io/");
    MODULE_LICENSE("GPL");

    ```

6. Now let's build and insert our module:

	* Type inside your workdir:
		```
		make

		```

    * You should have an output like this:
		```
		make -C /lib/modules/4.15.0-1044-aws/build SUBDIRS=/root/ish-ar.io-lab modules
		make[1]: Entering directory '/usr/src/linux-headers-4.15.0-1044-aws'
		CC [M]  /root/ish-ar.io-lab/ish.o
		Building modules, stage 2.
		MODPOST 1 modules
		CC      /root/ish-ar.io-lab/ish.mod.o
		LD [M]  /root/ish-ar.io-lab/ish.ko
		make[1]: Leaving directory '/usr/src/linux-headers-4.15.0-1044-aws'

		```
	* To insert the module type:
		```
		insmod ish.ko

		```
	* And to see if the module is loaded type:
		```
		root@ip-172-31-3-95:~/ish-ar.io-lab# lsmod | grep ish
		ish                    16384  0

		```

7. 	Does it works? Let's test it!
	We need to execute something so let's type ```ls``` and then see dmesg:

	```
	root@ip-172-31-3-95:~/ish-ar.io-lab# dmesg

	output:
	[ 4813.434548] Module inserted            
	[ 4815.142934] ish-ar.io pre_handler: counter=0
	[ 4815.142935] ish-ar.io post_handler: counter=1

	```

	So if you have an ouput like this... YES! It works!

8. 	To remove the module just type:
	```
	rmmod ish
	
	```


---

**RECAP:**

**What we've learned?**

**How to use Kprobes using kernel modules, what are the pre_handler and post_handler and how to use them to count everytime a function is called (e.g.: sys_execve)**

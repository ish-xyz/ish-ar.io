---
title: 'Terraform Blog Series: These 3 tips will save you from terrible mistakes'
date: "2020-09-16T22:00:00.000Z"
description: "A big single state file is not going to help you. When a new user starts with Terraform, it could seem easier to manage all the infrastructure code under one big repository ..."
---

![terraform-icon](./terraform-icon.png)

## 1. A big single state file is not going to help you.

When a new user starts with Terraform, it could seem easier to manage all the infrastructure code under one big repository and one big state file (To who doesn't know what a state file is, check out this page -> https://www.terraform.io/docs/state/index.html)

However, this design will soon show its downsides and limits.

Why is a mono state file, not a good idea in terms of performance?

If you haven't noticed when you run the command "plan", Terraform will try to **refresh the state file.** This step means that Terraform is about to "reconcile the state Terraform knows about (via its state file) with the real-world infrastructure."
If you have a big state file with the whole infrastructure mapped and want to change just a single GKE cluster, remove a single EC2 instance or create a new bucket. Guess what? **It will require the refresh on the whole infrastructure** (and trust me, it will take a while!)

But what about the reliability?

What happens if accidentally someone runs terraform destroy against that mono state file? 
Yes. It's all gone. You would have to recreate the infrastructure.

What happens if someone uses a new terraform version? 
(e.g.: from terraform 0.11 to terraform 0.12)
Everyone would have to upgrade the CLI version, and if you're unlucky, you might also need to update the actual terraform code.

There are other reasons, but I'm sure I've made this point clear enough: don't use a single state file! -.-'

## 2. Monorepo is evil.
Someone  might say: let's put all together modules, code, everything in a mono repo but in different directories with different state files: brilliant -.-'

Trust me when I say that I've seen the worst things with Terraform: repositories with symlinks to share/copy variables in different directories, I've seen gigantic mono repositories, terraform files generated from bash scripts and an SQL database, trust me.
Why is a huge repository NOT a good idea in terms of code reliability?
Plain and simple: it doesn't scale. 
Now imagine you're a small team of 5 engineers, pushing all the infrastructure code together might seem a good idea. You all have permission to create/remove/edit the terraform code, and this way, you would not have to deal with multiple pipelines, etc.

Now imagine than in a year, your small team of 5 becomes 100. Other engineers now want to use Terraform to manage their infrastructures (network engineers, DBAs, Data Engineers, Data Scientists, etc.).

It will become tricky (not impossible) to manage permissions, coordinate terraform changes, and create a whole pipeline/automation that can satisfy everyone's needs.

And what if you have used modules inside that single repository? How are you going to manage modules versions? 
A poor repositories structure design generates all these obstacles.

What if you are already there? I'd say start by move modules to different repositories. You can also start to automate testing and tagging on modules.
After this first step is done, split your infrastructure into layers, and start to divide the layers inside different repositories managed by the owners of that layer of infrastructure. 
It will be painful! Remember, no pain, no gain!

## 3. Don't run Terraform manually: use pipelines.

Here too, I've seen the worst things. I've once worked for a company that used to have a Slack channel where they "locked" Terraform by basically sending messages like "I'm using Terraform" or "terraform locked": I mean... seriously? "Terraform locked"?  -.-'

Having the right orchestration and automation will help your team to don't override each other changes.
If you plan to work with pipelines, my advice is to have *no* concurrent builds and run the automation on tiny parts of the infrastructures. By doing this, there won't be long pipelines but quick automation with an effective feedback cycle.

*Always tag your infrastructure code*, and treat it as a real software/application.

*Run tests.* Testing Terraform code might look complicated but there some useful tools out there such as "terratest". If you're comfortable with Go, you can follow Hashicorp's tutorials about unit testing with Terraform.

*You should have a tool to handle the CI and another to run the deploy.*
In my opinion, the desired situation is that the CI tool would push an artifact with the tested Terraform code in it, and the deploy would pick the artifact and deploy it.

## Conclusion

The perfect way to run Terraform doesn't exist. In most cases, it depends on the use case, BUT there are some errors that I'd define common mistakes that everyone should avoid. 
Remember: well begun is half done :)

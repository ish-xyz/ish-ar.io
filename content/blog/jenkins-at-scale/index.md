---
title: 'Jenkins at scale'
date: "2020-12-30T16:46:00.000Z"
description: "This article presents a solution to run a CI/CD Jenkins based platform at scale. To run Jenkins at scale, automation is vital. More important, automation should help you and not make your life harder. When it comes to Jenkins ..."
---

!['jenkins-logo'](./jenkins-logo.png)

## INTRODUCTION

This article presents a solution to run a CI/CD Jenkins based platform at scale.<br>
To run Jenkins at scale, automation is vital. More important, automation should help you and not make your life harder.<br>
When it comes to Jenkins, automate the whole setup could be painful; often, engineers create hacky solutions or follow manual steps to get it "up & running".<br>
Obviously, we want to avoid these scenarios as much as possible.<br>

## PRINCIPLES

When I thought of creating a CI/CD platform that would be resilient and able to scale, I decided to list a bunch of principles/requirements that I wanted to follow during the implementation.

Requirements:

- The provisioning of the platform should be as easy as possible and quick.
- It's better to handle multiple tiny platforms automatically rather than a uber-platform.
- Pipelines should be defined as code and tested.
- The CI/CD platform infrastructure should be defined as code and automatically tested.
- The CI/CD platform must be secure.
- Engineers should be comfortable to break things, knowing that they can always rollback/re-provision the whole stack.
- The CI/CD platform must export metrics about itself, and engineers should use those metrics to make decisions about it.

Now, all of these aspects might seem very high-level, and in fact, they are, but it's good to start with a clear idea of what we want and then design "how to execute it".<br>


## DEMO

For this article, I have created a little [demo](https://github.com/ish-xyz/jenkins-aws-platform) on how Jenkins can be provisioned automatically on AWS and managed at scale, and in this section, I'm going to talk about the decisions taken and tools implemented in it.<br>
Although the demo doesn't represent a production-ready platform is a good start and it shows some good Jenkins features, and best practices.<br>
I've tried to follow the above requirements as much as possible, albeit a some of them haven't been satisfied in the demo.<br>

### JENKINS COMPONENTS

Let's talk first about the Jenkins high-level components. We can say that Jenkins has 2 major kinds of components: Master and Agents.<br>
The **agents** (also called build machines) are responsible for running our pipelines.<br>
The **Jenkins Master** instead is responsible for: orchestration, user management, authentication, authorization, plugins management, and a lot of other things.<br>
The setup of these two parts of the infrastructure can be very standard or complicated. However, what I'm going to present to you today will give you the building blocks to automate an entire Jenkins setup and allow you to run it at scale, no matter how tricky the setup can be.<br>

### IMPLEMENTATION

Let's talk about the tools I've used on the [Jenkins at scale demo](https://github.com/ish-xyz/jenkins-aws-platform) I've created.

(**LITTLE DISCLAIMER**: I'm aware there are plenty of examples on how to automate the Jenkins setup on Kubernetes, however I felt like there wasn't a real "use-case" on how to do it with AWS instances)<br><br>

**AMIs CREATION**

The approach used here is "immutable infrastructure". To put it simply, we're going to create AMIs with software pre-installed in them and deploy them, instead of provisioning an EC2 Instance and then configure it afterward.<br>
Using an immutable infrastructure will help us with consistency, and deploy time (on top of a lot of other advantages that I'm not going to discuss today).<br>

To create the AMIs I've decided to use Packer + Ansible. The way Packer works is the follow:

1. Packer will create a temporary EC2 Instance from a source AMI (defined in a file called [packer.json](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/master/packer.json#L4))
2. It will then connect to the instance (via ssh) and run ansible
3. Then Packer will save the configured instance as a new AMI, and output some metadata to a file called [manifest.json](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/agents/default/manifest.json)<br><br>


**JENKINS MASTER AND JOBS PROVISIONING/CONFIGURATION**

Let's focus on the Jenkins Master for now.<br>

Now that we have Packer that creates an AMI with Jenkins, and its plugins already installed, for us... How can we configure Jenkins?<br>

Simple answer: **using Jenkins CASC!**<br>

Jenkins CASC (Configuration as Code) is a plugin that will let you configure the whole Jenkins Master from a [yaml file](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/templates/jenkins-casc.yaml.tpl).<br>

Through this YAML file you will be able to configure not only the Jenkins settings, but also the plugins settings and **jobs**.<br>

Now, this last part is very important for me, because what I've used to create jobs automatically in Jenkins is a **seed job**. A seed job is a particular pipeline that all it does, is to create other Jenkins jobs for us.<br>

How does it do that? **Using the DSL plugin**. (If you don't know what the plugin is, you should really read this article -> https://plugins.jenkins.io/job-dsl/)<br>

The seed job will download the repository with the infrastructure code and provision the files within the folder `/jenkins-jobs`, by doing this wwe can have all our Jenkins jobs defined as code.

To have an idea of what the seed job looks like, check out the [CASC configuration](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/templates/jenkins-casc.yaml.tpl#L84).<br><br>


**DEPLOYMENT**

We now have a Jenkins AMI, a YAML file that will configure our Jenkins Master, a seed job that will create our pipelines for us, but how do we deploy all of this?<br>
On this [demo](https://github.com/ish-xyz/jenkins-aws-platform/tree/1), I've used [Terraform](https://terraform.io), because I believe it's the best option to do IAC at the moment.<br>
Via Terraform we're are going to deploy the whole infrastructure + CASC file.<br>

*The reason why we deploy the CASC file via Terraform and not Packer is because it needs information that are only available at provisioning-time.*<br>

To be specific, Terraform will perform the following actions:<br>

- Create a IAM Role + IAM Policy (Necessary for the Jenkins Master to connect to the AWS Services. E.g.: Secret manager, EC2, etc.)<br>

- Create the PEM Keys (With RSA Algorithm) <- This are the keys used for the master & agent SSH connections.<br>

- Save the early created keys to AWS Secret Manager<br>
  (**NOTE: Using the Jenkins AWS Credential plugin the agents SSH key will be automatically be created as credentials within Jenkins**)<br>

- Render and upload the CASC file (`/terraform/templates/jenkins.yaml.tpl`).<br>
  **NOTE:** Jenkins using CASC will create a credential called "jenkins-agent-key-pair" which is needed by Jenkins Clouds to provision Agents automatically.<br>
  The content of the actual key is stored in AWS Secret Manager by Terraform itself and is accesible by Jenkins using the configured IAM role.<br>
  However since the name of the secret, in AWS Secret Manager, changes at every Terraform run, I needed to template the CASC configuration, making the value of ${jenkins-agent-key-pair} dynamic.<br>

- Provision the required Security Groups.

- Create the EC2 Instance to host the Jenkins Master and deploy the rendered jenkins.yaml (CASC file) inside it.<br><br>


**AGENTS PROVISIONING**

Jenkins agents can be handled with little effort.<br>
The image creations for agents is done with the same identical set of tools and logic of the Jenkins master image.<br>
Agents should be disposable, they should be something you create when you need and then discard.<br>
To use Jenkins agents this way there's a Jenkins functionality called "Clouds".<br>
Clouds will allow you to create, manage and destroy agents. Jenkins will then spawn agents only when it needs them.<br>
The clouds configuration only needs few information and it can be configured via CASC. To have you an idea of CASC configuration required,  checkout this configuration [sample](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/locals.tf#L3)<br>


## CONCLUSIONS

**TUTORIAL:** If you want to provision the infrastructure describe in this article, follow the tutorial [here](https://github.com/ish-xyz/jenkins-aws-platform/tree/1#tutorial).

**PROS & CONS**:

I'm not going to list the *PROS* because at this point they should be clear enough :)

*CONS:*
- If your team is not familiar with IAC and it only wants a simple Jenkins setup, maybe to run a simple POC, then it's probably better to just set it up manually. Although, probably it's just better to have a managed solution at this point.


Finally, make sure to check out the demo section ["Consideration"](https://github.com/ish-xyz/jenkins-aws-platform/tree/1#considerations).


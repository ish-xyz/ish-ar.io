---
title: 'Jenkins at scale'
date: "2020-12-30T16:46:00.000Z"
description: "...."
---

## INTRODUCTION

This article presents a solution to run a CI/CD Jenkins based platform at scale. 
To run Jenkins at scale, automation is key. More important, automation should help you, and not make your life harder.
When it comes to Jenkins, automate the whole setup could be painful; often engineers end up creating hacky solutions, or following manual steps, just to get it up and running.
Obviously, we want to avoid these scenarios as much as possible.

## PRINCIPLES

When I thought of creating a CI/CD platform that would be resilient and able to scale, I decided to list a bunch of principles/requirements that I wanted follow during the implementation.

Requirements:

- The provisioning of the platform should be as easy as possible and quick.
- It's better to handle N tiny platforms automatically, rather than a uber-platform.
- Pipelines should be defined as code and tested.
- The CI/CD platform infrastructure should be defined as code and automatically tested.
- The CI/CD platform must be secure.
- Engineers should be comfortable to break things, knowing that they can always rollback/re-provision the whole stack.
- The CI/CD platform must export metrics about itself, and those metrics should be used to make decisions about it.

Now, all of these aspects might seem very high-level, and in fact they are, but it's good to start with a clear idea of what we want, and then design "how to excute it".


## DESIGN

For the purpose of this article, I have created a little [demo on how Jenkins can be provisioned automatically on AWS]("https://github.com/ish-xyz/jenkins-aws-platform"), and in this section I'm going to talk about the decisions taken and tools implemented in it.

Although, the demo doesn't represent a production-ready platform is a good start and it shows some good Jenkins features and best practices.

I've tried to follow the above requirements as much as possible, albeit a bunch of them they haven't been satisfied in the demo.

### COMPONENTS

Let's talk first about the Jenkins high-level components. We can say that Jenkins has 2 major kind of components: Master and Agents.

The **agents** (also called build machines) are responsible for running our pipelines.
The **Jenkins Master** instead, is resposible for: orchestration, user management, authentication, authorization, plugins management and a lot of other things.

The setup of these two piece of infrastructure can be very standard or really complicated, however what I'm gonna present to you today will give you the building blocks to automate an entire Jenkins setup no matter how complicated it can be.


### IMPLEMENTATION

Let's talk about the tools I've used on the [Jenkins at scale demo]("https://github.com/ish-xyz/jenkins-aws-platform") I've created.

(LITTLE DISCLAIMER: I'm aware there are plenty of examples on how to automate the Jenkins setup on Kubernetes, however I felt like there wasn't a real "tutorial" on how to do it with AWS instances)


**PACKER + ANSIBLE**

Now, the approach used here is "immutable infrastructure". To put it simply, we're gonna create AMIs with software pre-installed in it and deploy them, instead of create an EC2 Instance and then configure it afterwards.
This is going to help us with consistency, and deploy time (on top of a lot of other things XD ).

To create AMIs I've decided to use Packer + Ansible. The way they works is the follow:

1. Packer will create a temporary EC2 Instance from a source AMI (defined in a file called [packer.json](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/master/packer.json#L4))
2. It will then connect to the instance (via ssh) and run ansible
3. Then Packer will save the configured instance as a new AMI, and output some metadata to a file called [manifest.json](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/agents/default/manifest.json)


**JENKINS MASTER AND JOBS PROVISIONING/CONFIGURATION**

Let's focus on the Jenkins Master for now.

Now that we have Packer that creates an AMI with Jenkins, and its plugins already installed, for us... How can we configure Jenkins?

Simple answer: **using Jenkins CASC!**

Jenkins CASC (Configuration as Code) is a plugin that will let you configure the whole Jenkins Master from a [yaml file](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/templates/jenkins-casc.yaml.tpl).

Through this YAML file you will be able to configure not only the Jenkins settings, but also the plugins settings and **jobs**.

Now, this last part is very important for me, because what I've used to create jobs automatically in Jenkins is a **seed job**. A seed job is a particular pipeline that all it does, is to create other Jenkins jobs for us.

How does it do that? **Using the DSL plugin**. (If you don't know what the plugin is, you should really read this article -> https://plugins.jenkins.io/job-dsl/)


**DEPLOYMENT**

We now have a Jenkins AMI, a YAML file that will configure our Jenkins Master, a seed job that will create our pipelines for us, but how do we deploy all of this?

On this [demo](https://github.com/ish-xyz/jenkins-aws-platform/blob/1), I've used [Terraform](https://terraform.io), because I believe it's the best option to do IAC at the moment.

Via Terraform we're are going to deploy the whole infrastructure + CASC file.

*The reason why we deploy the CASC file via Terraform and not Packer is because it needs information that are only available at provisioning-time.*

To be specific, Terraform will perform the following actions:

- Create a IAM Role + IAM Policy (Necessary for the Jenkins Master to connect to the AWS Services. E.g.: Secret manager, EC2, etc.) <br>

- Create the PEM Keys (With RSA Algorithm) <- This are the keys used for the master & agent SSH connections. <br>

- Save the early created keys to AWS Secret Manager <br>
  (**NOTE: Using the Jenkins AWS Credential plugin the agents SSH key will be automatically be created as credentials within Jenkins**) <br>

- Render and upload the CASC file (`/terraform/templates/jenkins.yaml.tpl`). <br>
  **NOTE:** <br>
  Jenkins using CASC will create a credential called "jenkins-agent-key-pair" which is needed by Jenkins Clouds to provision Agents automatically. <br>
  The content of the actual key is stored in AWS Secret Manager by Terraform itself and is accesible by Jenkins using the configured IAM role. <br>
  However since the name of the secret, in AWS Secret Manager, changes at every Terraform run, I needed to template the CASC configuration, making the value of ${jenkins-agent-key-pair} dynamic. <br>

- Provision the required Security Groups.

- Create the EC2 Instance to host the Jenkins Master and deploy the rendered jenkins.yaml (CASC file) inside it.


**AGENTS PROVISIONING**

I didn't talk a lot about Jenkins agents, the reason is because we can handle them with little effort. 

Agents should be disposable, they should be something you create when you need to run your pipeline and then discard.

For this reason, there's a Jenkins functionality called "Clouds". 

Clouds will allow you to create, manage and destroy agents via Jenkins.

The clouds configuration only needs few information


## DEMO TUTORIAL

To deploy the demo described here, follow the tutorial in the README.md file:

https://github.com/ish-xyz/jenkins-aws-platform/blob/1


## Conclusions


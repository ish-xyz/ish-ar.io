---
title: 'Jenkins at scale'
date: "2021-01-16T13:46:00.000Z"
description: "This article presents a solution to run a CI/CD Jenkins based platform at scale. To run Jenkins at scale, automation is vital. More important, automation should help you and not make your life harder. When it comes to Jenkins ..."
---

!['jenkins-logo'](./jenkins-logo.png)

## INTRODUCTION

This article presents a solution to run a CI/CD Jenkins based platform at scale.<br>
To deploy and manage Jenkins at scale, automation is vital. More important, automation should help you and not make your life harder.<br>
When it comes to Jenkins, automate the whole setup could be painful; often, engineers create hacky solutions or follow manual steps to get it "up & running".<br>
Obviously, we want to avoid these scenarios as much as possible.<br>

## PRINCIPLES

When I thought of creating a CI/CD platform that would be resilient and able to scale, I decided to list some principles/requirements that I wanted to follow during the implementation.

Requirements:

- The provisioning of the platform should be as easy as possible and quick.
- It's better to handle multiple tiny platforms automatically rather than a uber-platform.
- Pipelines should be defined as code and tested.
- The CI/CD platform infrastructure should be defined as code and automatically tested.
- The CI/CD platform must be secure.
- Engineers should be comfortable breaking things, knowing that they can always rollback/re-provision the whole stack.
- The CI/CD platform must export metrics about itself, and engineers should use those metrics to make decisions about it.

Now, all of these aspects might seem very high-level, and in fact, they are, but it's good to start with a clear idea of what we want and then design "how to execute it".<br>


## DEMO

For this article, I created a little [demo](https://github.com/ish-xyz/jenkins-aws-platform) that illustrates how Jenkins can be provisioned automatically on AWS and managed at scale.
In this section, I will talk about the decisions taken and the tools implemented in the demo.<br>
Although the demo doesn't represent a production-ready platform, it is a good starting point, and it shows useful good Jenkins features and best practices.<br>
While developing the demo, I have followed the requirements listed above, albeit I didn’t implement all of them.<br>

### JENKINS COMPONENTS

Let's talk first about the Jenkins high-level components. We can say that Jenkins has two major kinds of components: Master and Agents.<br>
The **agents** (also called build machines) are responsible for running our pipelines.<br>
The **Jenkins Master** instead is responsible for: orchestration, user management, authentication, authorization, plugins management, and a lot of other things.<br>
The setup of these two parts of the infrastructure can be very standard or complicated. However, what I'm going to present to you today will give you the building blocks to automate an entire Jenkins setup and allow you to run it at scale, no matter how tricky the setup can be.<br>

### IMPLEMENTATION

Let's talk about the tools I've used on the [Jenkins at scale demo](https://github.com/ish-xyz/jenkins-aws-platform) I've created.

(**LITTLE DISCLAIMER**: I'm aware there are plenty of examples on how to automate the Jenkins setup on Kubernetes. However, I felt like there wasn't a real "use-case/scenario" on how to deploy it on AWS instances)<br><br>

**AMIs CREATION**

The approach used here is "immutable infrastructure." To put it simply, we're going to create AMIs with software pre-installed in them and deploy, instead of provisioning EC2 instances and configure them afterward.<br>
Using an immutable infrastructure will help us with consistency and deploy time (on top of many other advantages that I’m not going to discuss today).<br>

To create the AMIs, I've decided to use Packer + Ansible. Packer works as follow:

1. Packer will create a temporary EC2 instance from a source AMI (defined in a file called [packer.json](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/master/packer.json#L4))
2. It will then connect to the instance (via ssh) and run Ansible
3. Then Packer will save the configured instance as a new AMI and output some metadata to a file called [manifest.json.](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/images/agents/default/manifest.json)<br><br>


**JENKINS MASTER AND JOBS PROVISIONING/CONFIGURATION**

Let's focus on the Jenkins Master for now.<br>

Now that we have Packer that creates an AMI with Jenkins, and its plugins already installed, for us... How can we configure Jenkins?<br>

Simple answer: **using Jenkins CASC!**<br>

Jenkins CASC (Configuration as Code) is a plugin that will let you configure the whole Jenkins Master from a [YAML file](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/templates/jenkins-casc.yaml.tpl).<br>

Through this YAML file, you will be able also to configure plugins settings and **create jobs**.<br>

Now, this last part is crucial for me. To create Jenkins Jobs automatically I've used a **seed job**. A seed job is a particular pipeline, defined in the CASC configuration, that creates other Jenkins jobs for us.<br>

How does it do that? **Using the DSL plugin**. (If you don't know what the plugin is, you should read this article -> https://plugins.jenkins.io/job-dsl/)<br>

The seed job will download the repository with the infrastructure code and provision the files within the folder `/jenkins-jobs`; by doing this, we can have all our Jenkins jobs defined as code.

To have an idea of what the seed job looks like, check out the [CASC configuration](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/templates/jenkins-casc.yaml.tpl#L84).<br><br>


**DEPLOYMENT**

We now have a Jenkins AMI, a YAML file that will configure our Jenkins Master, a seed job that will create our pipelines for us, but how do we deploy all of this?<br>
On this [demo](https://github.com/ish-xyz/jenkins-aws-platform/tree/1), I've used [Terraform](https://terraform.io) because I believe it's the best option to do IAC at the moment.<br>
Via Terraform, we're are going to deploy the whole infrastructure + CASC file.<br>

*The reason why we deploy the CASC file via Terraform and not Packer is that it needs metadata that is only available at provisioning-time.*<br>

To be specific, Terraform will perform the following actions:<br>

- Create an IAM Role + IAM Policy (Necessary for the Jenkins Master to connect to the AWS Services. E.g., Secret manager, EC2, etc.)<br>

- Create the PEM Keys (With RSA Algorithm) <- These are the keys used for the master & agent SSH connections.<br>

- Save the early created keys to AWS Secret Manager.<br>
  (**NOTE: Using the Jenkins AWS Credential plugin, the agents' SSH key will be automatically be created as credentials within Jenkins**)<br>

- Render and upload the CASC file (`/terraform/templates/jenkins.yaml.tpl`).<br>
  **NOTE:** Jenkins using CASC will create a credential called "jenkins-agent-key-pair" which is needed by Jenkins Clouds to provision Agents automatically.<br>
  The content of the actual key is stored in AWS Secret Manager by Terraform itself and is accessible by Jenkins using the configured IAM role.<br>
  However, since the name of the secret in AWS Secret Manager changes at every Terraform run, I needed to template the CASC configuration, making the value of ${jenkins-agent-key-pair} dynamic.<br>

- Provision of the required Security Groups.

- Create the EC2 Instance to host the Jenkins Master and deploy the rendered jenkins.yaml (CASC file) inside it.<br><br>


**AGENTS PROVISIONING**

Jenkins agents can be handled with little effort.<br>
The image creations for agents is done with the same identical set of tools and logic as the Jenkins master image.<br>
Agents should be disposable; they should be something you create when you need them and then discard. The Jenkins "Clouds" functionality does precisely that.<br>
Clouds will allow you to create, manage, and destroy agents. Jenkins will then spawn agents only when it needs them.<br>
The Clouds configuration only needs only a few parameters, and it can be configured via CASC. To give you an idea of the CASC configuration required, check out this [sample](https://github.com/ish-xyz/jenkins-aws-platform/blob/1/terraform/locals.tf#L3).<br>


## CONCLUSIONS

**TUTORIAL:** If you want to deploy the infrastructure described in this article, follow the tutorial [here](https://github.com/ish-xyz/jenkins-aws-platform/tree/1#tutorial).

**PROS & CONS**:

I'm not going to list the *PROS* because, at this point, they should be clear enough :)

*CONS:*
- If your team is not familiar with IAC and  only wants a simple Jenkins setup, maybe to run a simple POC, it’s probably better to just set it up manually. Although, at this point, a managed solution would be a better option.


Finally, make sure to check out the demo section ["Consideration"](https://github.com/ish-xyz/jenkins-aws-platform/tree/1#considerations).


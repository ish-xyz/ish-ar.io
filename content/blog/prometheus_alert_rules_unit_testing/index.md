---
title: 'How to perform syntax testing & unit testing on your Prometheus Alert Rules'
date: "2019-11-18T15:01:00.000Z"
description: "In the past two months, I have been very busy, but I've finally got the time to write an article! Today I'm going to write about unit testing, to be precise unit testing on your Prometheus Alert Rules. If you don't know what Prometheus is you might want to check its website first, as this is gonna be a pretty specific article..."
---

In the past two months, I have been very busy, but I've finally got the time to write an article! 

Today I'm going to write about unit testing, to be precise unit testing on your **Prometheus Alert Rules**.

If you don't know what Prometheus is you might want to check its [website]("https://prometheus.io/") first, as this is gonna be a pretty specific article.

For who doesn't know what **unit tests** are, here is the definition from wikipedia.org:

“Unit tests are typically automated tests written and run by software developers to ensure that a section of an application (known as the "unit") meets its design and behaves as intended.”

Our goal with unit testing is to determine whether a piece of software or configuration (e.g.: one or more alert rules) can be deployed or if it doesn’t meet the right criteria.

But when it comes to testing alert rules, usually people's reaction is...

!['why-meme'](./why_meme.gif)


## Why would I ever need unit testing on my alert rules?

Let’s consider a quick hypothetical scenario.

Zac is part of a platform team, they implemented and currently manage Prometheus for LemonForce Inc., a huge organization providing a cloud-based CRM to a lot of organizations around the world, from the biggest companies to small local businesses.

LemonForce.com is a service composed of several different platforms and infrastructures owned and managed by hundreds of engineers across the company.

Zac wants to expand the Prometheus implementation and have visibility and alerting on every component of LemonForce.com.

He doesn't want to write every single alert rule for every service inside the company. That would be a very time-consuming task.

He also thinks he doesn't have the right knowledge to write alert rules to prevent issues on other people's platforms.

He wants his colleagues from different teams to write alert rules and unit tests for them to have a way to promote them across different environments to avoid to check the alert rules manually all the time.

Zac already knows how CI/CD works and he has created a pipeline to promote alert rules from development to production. The last missing piece is **testing**.

Fortunately, Prometheus provides syntax and unit testing out of the box with **promtool**.

Zac's challenge is to understand how unit and syntax testing works with promtool and automatically test each alert rule before deploying them to production.

So... let's try it!

## Demo time!

**GOAL** -> Learn how to perform unit testing with promtool

### 1. Install promtool and set up the environment:

If you have docker installed you can just download and run the [docker image]("https://hub.docker.com/r/ishario/promtool") I've prepared for you with:

```
docker pull ishario/promtool:1.0.0
docker run --rm -it ishario/promtool:1.0.0 bash
```

Otherwise, you have to install Go 1.13.0+ in your local environment, and just execute: 

```go get github.com/prometheus/prometheus/cmd/promtool```

Then test if the CLI is correctly installed with: 

```promtool --version```

The output should be similar to:

```
promtool, version  (branch: , revision: )
  build user:       
  build date:       
  go version:       go1.13.4
```

### 2. Create an alert rules file:

Let's create a file called **consul_alerts.yml** and insert a common alert rule to check a Consul cluster health.

```
vi consul_alerts.yml

#insert -> ':set paste' to remove the auto-indent if you want to paste the content.
```
And type:
```
groups:
- name: ConsulClusterAlerts
  rules:

  - alert: ConsulClusterDegrated
    expr: min(consul_raft_peers) < 3
    for: 1m
    labels:
      severity: page
    annotations:
      summary: Consul cluster is degraded
      description: Consul cluster has {{ $value }} servers alive. This may lead to cluster break.
```

### 2. Create a simple unit test file:

Now we're going to create the test file, let's call it **consul_alerts_test.yml**.

```
vi consul_alerts_test.yml

#insert -> ':set paste' to remove the auto-indent if you want to paste the content.
```

And type:

```
rule_files:
  - consul_alerts.yml

evaluation_interval: 1m

tests:

  - interval: 1m
    input_series:
      - series: 'consul_raft_peers{job="consul", instance="consul001:8500"}'
        values: '0 1 2 3 4 5 6 7'

    alert_rule_test:
      - eval_time: 1m
        alertname: ConsulClusterDegrated
        exp_alerts:
          - exp_labels:
              severity: page
            exp_annotations:
              summary: Consul cluster is degraded
              description: Consul cluster has 0 servers alive. This may lead to cluster break.

```

Let's break down it a bit.

The first section indicates where the alert rules file, about to be tested, is located.

```
rule_files:
  - consul_alerts.yml
```

The option "evaluation_interval" represents how often the rules will be evaluated. In our case every minute.

```
evaluation_interval: 1m
```

The following section shows the input data that will be submitted to the actual test.
The ```values:``` can also be expressed in the short version (1+0x7) but to keep the example simple I have used the normal format.

```
- interval: 1m
  input_series:
    - series: 'consul_raft_peers{job="consul", instance="consul001:8500"}'
      values: '0 1 2 3 4 5 6 7'
```

After the input section, there's the actual test. It says:

- the alert rule must be evaluated in the first minute (which means value 1)

- it must be equal to the exp_alerts (which stands for expected alerts), preventing any errors in the alerts summary, description and labels.

```
alert_rule_test:
  - eval_time: 1m
    alertname: ConsulClusterDegrated
    exp_alerts:
      - exp_labels:
          severity: page
        exp_annotations:
          summary: Consul cluster is degraded
          description: Consul cluster has 0 servers alive. This may lead to cluster break.
```

**NOTE**: *With promtool you can also test complicated PromQL expressions in order to, given a series of input data, always have the correct and expected value.
Unfortunately, that requires to write another specific test for the single rule(or expression).However, a way to avoid extra unit tests and keep things simple is to put the desired value of the PromQL expression in the expected alerts' annotations (as we've done here with {{ $value }}).*

### 4. Validate the syntax and the unit test!

Finally, we check our Consul alert rule.

1. Check syntax errors:

```
promtool check rules consul_alerts.yml

Checking consul_alerts.yml
  SUCCESS: 1 rules found
```

2. Run the unit test:

```
promtool test rules consul_alerts_test.yml

Unit Testing:  consul_alerts_test.yml
  FAILED:
    alertname:ConsulClusterDegrated, time:5m0s, 
        exp:"[Labels:{alertname=\"ConsulClusterDegrated\", severity=\"page\"} Annotations:{description=\"Consul cluster has 0 servers alive. This may lead to cluster break.\", summary=\"Consul cluster is degraded\"}]", 
        got:"[Labels:{alertname=\"ConsulClusterDegrated\", severity=\"page\"} Annotations:{description=\"Consul cluster has 1 servers alive. This may lead to cluster break.\", summary=\"Consul cluster is degraded\"}]"

```

As I mentioned before by matching the actual {{ $value }} with the expected one in our unit tests annotations, we're also testing the logic of our PromQL expression.
In this case the logic it's pretty straight forward, and the error is in the test as we're passing a value of 1 but we want an expected value as 0, in fact, we just need to change expected value ```Consul cluster has 0```  to -> ```Consul cluster has 1``` in the annotations.
However, remember that this *trick* might be useful when you're writing tests for complex PromQL expressions and you always want to ensure the right final value.

3. So, let's change our unit test description. The test should now look like:

```
rule_files:
  - consul_alerts.yml

evaluation_interval: 1m

tests:

  - interval: 1m
    input_series:
      - series: 'consul_raft_peers{job="consul", instance="consul001:8500"}'
        values: '0 1 2 3 4 5 6 7'

    alert_rule_test:
      - eval_time: 1m
        alertname: ConsulClusterDegrated
        exp_alerts:
          - exp_labels:
              severity: page
            exp_annotations:
              summary: Consul cluster is degraded
              description: Consul cluster has 1 servers alive. This may lead to cluster break.

```

4. Re-run our unit test file:

```
promtool check rules consul_alerts.yml

Unit Testing:  consul_alerts_test.yml
  SUCCESS
```

And that's it, we have created a unit test file and tested our alert rule syntax automatically.
Obviously, these 2 commands can be automated within a pipeline to verify and promote alert rules across environments.

This might look like extra work for you, but as long as it keeps the environments' integrity, it will save you a lot of work in the future... Trust me :)

Hope this has been useful to you!

If you have any queries, let me know on [twitter]('https://twitter.com/isham_araia')! 


---
title: 'CI/CD Observability: Tekton CI/CD + Prometheus'
date: "2020-08-11T18:00:00.000Z"
description: "Today's article is about some experiments I've been doing with Tekton CI/CD + Prometheus..."
---

![prometheus-tekton-logo](./logo.jpg)

Hello dear readers,

Today's article is about some experiments I've been doing with Tekton CI/CD + Prometheus.

But first, let's understand "why".

## Why is it important to collect metrics about your CI/CD pipelines?

CI/CD is becoming more and more a hot topic. Everyone wants a 100% automated, flawless, fast, code integration, and deployments. 
But how can a team/company achieve that?

Usually is a step-by-step process and not a ready-to-install solution (if there's one though, please tell me ;) ).

For that reason, metrics will help you keep track of your CI/CD improvements and understand what needs to be adjusted.

Luckily, if you are using Tekton, there's going to be some useful metrics by default.

I couldn't find enough documentation on the metrics exposed out of the box by Tekton. After a few experiments, I came up with a list of what (in my opinion) are the most valuable metrics.

The demo I've prepared uses Prometheus as a backend to collect and display metrics, albeit others backends (such as StackDriver/Cloud Monitoring) are available too. 

## Tekton CI/CD: Useful Indicators

| metric      | description                                                                     |
|-------------|---------------------------------------------------------------------------------|
| tekton_go_* | These metrics are all about the GO status: memory used, allocated, GC, and more. |
| tekton_running_{taskruns or pipelineruns}_count|  How many taskruns or pipelineruns are in status "running" |
| tekton_pipelinerun_count | Simple PipelineRuns counter |
| tekton_taskrun_count | Simple TaskRuns counter |
| tekton_{taskruns or pipelineruns}_duration_seconds_count | This is basically another counter and is incremented by 1 on every observe |
| tekton_{taskruns or pipelineruns}_duration_seconds_sum | This is basically another counter and is incremented by the value of the observation |


### Some useful PromQL expressions for Tekton:

**PipelineRun duration**
```
tekton_pipelinerun_duration_seconds_sum{pipelinerun="app-ci-run-bzl48"} / tekton_pipelinerun_duration_seconds_count{pipelinerun="app-ci-run-bzl48"}
```

**PipelineRun duration trend**
*If pipelines start to show and increasing trend in duration this value will increase as well.*
```
rate(tekton_pipelinerun_duration_seconds_sum{pipelinerun="xxx"}[5m]) / rate(tekton_pipelinerun_duration_seconds_count{pipelinerun="xxx"}[5m])
```

**Check PipelineRuns failures**
*If more than 15% of the PipelineRuns are failing this rule will apply*
```
tekton_pipelinerun_count{status="failed"} * 100 / ignoring(status) tekton_pipelinerun_count{status="success"} > 15
```

**Check TaskRuns failures**
*If more than 15% of the TaskRuns are failing this rule will apply*
```
tekton_taskrun_count{status="failed"} * 100 / ignoring(status) tekton_taskrun_count{status="success"} > 15
```

**Monitor the Tekton Controller** 
The 2 metrics below are more likely to expose issues related to K8s rather than Tekton:

```
tekton_workqueue_adds_total
tekton_workqueue_depth
```

**Workqueue rate**: *It’s the number of required actions per unit time. A high value could indicate problems in the cluster of some of the nodes.*

**Workqueue depth**: *It’s the number of actions waiting in the queue to be performed. It should remain in low values.*


These are very basic examples, and there's other cool stuff that you can do with these indicators. You could, for example, monitor how many pods/resources have been allocated into a project, how much time users are wasting in retries, how many seconds are wasted on latency, pods latency, Workqueues and so on!

Measuring pipelines is, in my opinion, something that every company who wants to move towards a data-driven mindset should do.



### How to setup Tekton to use Prometheus

As stated before, Tekton comes with Prometheus as default backend. The user just needs to ensure that metrics are enabled on the Tekton configuration.

Inside the namespace where the Tekton Pipeline Controller is installed, there is a configmap called "observability" or "tekton...-observability". Inside that configmap, there's the configuration that will then be used by Knative/Tekton Controller to expose metrics.

The observability configuration is explained here:
https://github.com/tektoncd/pipeline/blob/edc453934a183d44fde739dc24d6ca6b25cdeb6b/config/config-observability.yaml

Once Tekton is configured, the only bit missing is the related Service Monitor to allow the Prometheus Operator to scrape the exposed metrics!

The service monitor configuration should look like:

```
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  annotations:
    meta.helm.sh/release-name: prometheus-operator-1595779515-custom-sm
    meta.helm.sh/release-namespace: tekton-demo
  generation: 1
  labels:
    app: prometheus-operator-tekton-pipeline-controller
    app.kubernetes.io/managed-by: Helm
    chart: prometheus-operator-8.15.6
    heritage: Helm
    release: prometheus-operator-1595779515
  name: prometheus-operator-159577-tekton-pipeline-controller
  namespace: tekton-demo
spec:
  selector:
    matchLabels:
      app.kubernetes.io/instance: tekton-pipeline-1593528871
      app.kubernetes.io/component: controller
  endpoints:
  - port: metrics
    path: /metrics
    interval: 15s
```

That's all from me, hope you enjoyed today's article :)

Cheers!


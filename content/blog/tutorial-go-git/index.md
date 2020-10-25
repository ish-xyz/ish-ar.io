---
title: 'In-memory Git clone, commit and push using GO'
date: "2020-10-25T22:00:00.000Z"
description: "Today's article is a tutorial on how set up and use the go-git library to clone and update a repository with an in-memory filesystem.
This procedure is quite useful if you want to push against or clone a repository without touching the OS filesystem and deal with permissions or temporary files..."
---

## Tutorial introduction and requirements

Today's article is a tutorial on how set up and use the go-git library to clone and update a repository with an in-memory filesystem.<br>
This procedure is quite useful if you want to push against or clone a repository without touching the OS filesystem and deal with permissions or temporary files.<br>
Albeit, there's documentation about git-go, I find it not really clear and sometimes misleading due to the different versions and names of the library.<br>
For this reason, I've decided to share this tutorial, and hopefully will be helpful to someone.<br>
For the purpose of this tutorial, we will do everything inside a main.go file, however you might want something more sofisticated for your use case :)

**Requirements**:

* An https Git repository (Github, Bitbucket doesn't really matter as long as it's accessible via https.)
* Go installed and configured.
* Basic Knowledge of Go.

## Setting up the In-Memory Filesystem

To set up the in-memory filesystem, we will use two packages storage and memfs.
The storer will contain the objects, references and other metadata (normally what the directory `.git` would do).<br>
The memfs filesystem will be our filesystem to read, create, remove any kind of file in our repository.<br>
First step, we need to create the two objects (the storer and the filesystem).

```
package main

import (
        "fmt"

        billy "github.com/go-git/go-billy/v5"
        memfs "github.com/go-git/go-billy/v5/memfs"
        git "github.com/go-git/go-git/v5"
        http "github.com/go-git/go-git/v5/plumbing/transport/http"
        memory "github.com/go-git/go-git/v5/storage/memory"
)

var storer *memory.Storage
var fs billy.Filesystem

func main() {
        storer = memory.NewStorage()
        fs = memfs.New()

...
```

## Setting up Git objects and Clone the repo

Second step, in order to have our repository in the in-memory filesystem, we need to **clone** it and create the **worktree** object.<br>
The function `Clone()` will also return the Repository interface that we will then use to `Push()` to the remote.<br>
The method `Worktree()` will return the Worktree object that we will need to `Add()` & `Commit()` our changes.<br>
Finally, if our repository is private, we would need to set up the basic authentication to clone it (We need the basic authentication to push anyway so better to set up it here!).
```
...

        // Authentication
        auth := &http.BasicAuth{
                Username: "your-git-user",
                Password: "your-git-pass",
        }

        repository := "https://github.com/your-org/your-repo"
        r, err := git.Clone(storer, fs, &git.CloneOptions{
                URL:  repository,
                Auth: auth,
        })
        if err != nil {
                fmt.Printf("%v", err)
                return
        }
        fmt.Println("Repository cloned")

        w, err := r.Worktree()
        if err != nil {
                fmt.Printf("%v", err)
                return
        }
```

## Create and commit your files

Now, will we use the `fs` object to create an actual file, add & commit it to the Worktree().

**NOTE**:

 - By default, the repository is always cloned into `"/"`. 
 - For some reason (unknown to me), if the filename starts with "/" it will create a folder and not a file.<br>E.g.: /hello/world.txt (world.txt would be a directory) hello/world.txt (world.txt would be a file inside the folder hello)

```
...

        // Create new file
        filePath := "my-new-ififif.txt"
        newFile, err := fs.Create(filePath)
        if err != nil {
                return
        }
        newFile.Write([]byte("My new file"))
        newFile.Close()

        // Run git status before adding the file to the worktree
        fmt.Println(w.Status())

        // git add $filePath
        w.Add(filePath)

        // Run git status after the file has been added adding to the worktree
        fmt.Println(w.Status())

        // git commit -m $message
        w.Commit("Added my new file", &git.CommitOptions{})
```

## Push and check errors

The Push() will be performed using the method of the Repository interface as shown below.
```
...

        //Push the code to the remote
        err = r.Push(&git.PushOptions{
                RemoteName: "origin",
                Auth:       auth,
        })
        if err != nil {
                return
        }
        fmt.Println("Remote updated.", filePath)
        return
}
```

Our final main.go would look like this: https://github.com/ish-xyz/ish-ar.io-tutorials/blob/master/tutorial-go-git/main.go


## Install and run our module

Let's try our new go module. Run the following commands:

```
go mod init
go build
go run main.go

    Repository cloned
    ?? my-new-file.txt
    <nil>
    A  my-new-file.txt
    <nil>
    Remote updated. my-new-file.txt
```

I know this is quite a specific topic, but I hope this tutorial will help someone!
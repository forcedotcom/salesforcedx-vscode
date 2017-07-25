== TLDR
1. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
1. Fork this repository.
1. The [README](README.md) has details on how to set up your environment.
1. Create a _topic_ branch for the issue that you are trying to add. When
   possible, you should branch off from the **develop** branch (see [branches](#Branches) below). 
1. Edit the code in your fork.
1. Send us a pull request when you are done. We'll review your code, suggest any
   needed changes, and merge it in.

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

== Branches
* We work in `develop`.
* We prepare the upcoming release in `release`.
* Our released (aka. "production") branch is `master`.
* Our work happens in _topic_ branches (feature and/or bug-fix).
  - feature branches are based on `develop`
  - bug-fix branches are based on `release`
  - branches _should_ be kept up-to-date using `rebase`
  - see below for further merge instructions

=== Merging between branches
* We try to limit merge commits as much as possible.
  - They are usually only ok from `release` into `master`, which is done by our release automation.

* Features branches are:
  1. based on `develop` and will be
  2. squash-merged into `develop`.

* Bug-fix branches are:
  1. created based on `release`,
  2. squash-merged into `release` and their commit
  3. cherry-picked into `develop`.

* Hot-fix branches are an exception.
  - Instead we aim for faster cycles and bug-fixes in `release` branch.

=== Merging `develop` into `release`
* When a development cycle finishes, the content of the `develop` branch will become the `release` branch
```
$ git checkout release
$ git reset --hard develop
$
$ # Using a custom commit message for the merge below
$ git merge -m 'Merge -s our (where _ours_ is develop) starting release stream x.y.z.' -s ours origin/release
$ git push origin release
```

== Pull Requests
* Develop features and bug fixes in _topic_ branches.
* _Topic_ branches can live in forks or within this repository.
  ** When creating feature branches in this repository please prefix with `<developer-name>/`.

=== Merging Pull Requests
* Pull request merging is restricted to squash & merge only.

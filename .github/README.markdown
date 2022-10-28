# Project Starter

Use [degit](https://github.com/Rich-Harris/degit) to add these files to new projects.

## Usage

First, install `degit`:

```
$ npm install -g degit
```

Then run this command in any empty directory to add the helper files to a project:

```
$ degit j127/project_starter
```

If the directory already has files in it, you can use `--force`, but it will overwrite existing files if you already have a directory named `helper_files`:

```
$ degit j127/project_starter --force
```

This file is in `.github/README.markdown` so that it won't overwrite existing `README.md` files in a project.

After you run the command, you can drag the files out of the `helper_files` directory into the root of your project.

To create your own versions of the helper files, you can fork this repo and then point the `degit` command at your repo (replace `j127` with your Github user name).

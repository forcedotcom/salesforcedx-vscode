# How to run the doc site locally

- The `docs` folder contains content published to [Salesforce Extensions for Visual Studio Code](https://developer.salesforce.com/tools/vscode).
- To preview the rendered doc site from a Github Pull request click "Details" against the "netlify/salesforcedx-vscode/deploy-preview — Deploy Preview ready!" check.

## Setup Ruby

Note that the server will only work with Ruby version 2. If you install 3 (which is the current default) you will be unable to run the server.

```
brew install ruby@2.7
```

Add the following to your profile:

```
export PATH="/usr/local/opt/ruby@2.7/bin:$PATH"
export LDFLAGS="-L/usr/local/opt/ruby@2.7/lib"
export CPPFLAGS="-I/usr/local/opt/ruby@2.7/include"
```

## Install Jekyll

https://jekyllrb.com/docs/

```
cd docs
gem install jekyll bundler
bundle install
```

## Install Netlify CLI

```
npm install netlify-cli -g
```

## Start the Server

```
netlify dev
```

Navigate to: http://127.0.0.1:8888/tools/vscode/

## Troubleshooting

If you run into issues when starting the server with an error message similar to

```
Address already in use - bind(2) for 127.0.0.1:4000 (Errno::EADDRINUSE)
```

a process is already using port 4000. To identify what process you can run `sudo lsof -wni tcp:4000`.

## Updating Header, Head, and Footer Includes

The `footer.html`, `head.html`, and `header.html` files are pulled from the DSC docs API. Do not update them by hand.

To pull the latest changes run:

```
npm run update-externals
```

## Relative URLs

For content under `docs` folder always use URLs relative to the `docs` folder.

**_The links appear broken in the markdown files but get rendered correctly when they get published as html._**

For images it means the url will start with `./images/` like the example below:

```
![My Image](./images/an-image.png)
```

For links the path is relative to the base path (i.e. `/tools/vscode/`). The url also needs to include the language as show in the example:

```
[My Link](./en/getting-started/orgbrowser)
```

## Localization

The site is localized in english and japanese. All articles must specify their language (`en` or `ja`) in the front matter:

```

---

title: My Page
lang: en

---

```

When adding new articles, you MUST add them in both the `_articles/en` and `_articles/ja` directories. When creating a new article in english simply copy it exactly to the `_articles/ja` directory so the content is availible when navigating the site in both lagugages. The article will be localized on the next localization pass.

When updating the `_/data/sidebar.yml` file, titles must specify both the `en` and `ja` versions. If you are adding an new item in english simply copy the english value to the japanese value and it will be translated on the next localization pass.

## Github Pages

Previously the docs site was hosted on Github pages for the main SF VSCode extensions repository. This has been decommissioned in favor of the [doc site](https://developer.salesforce.com/tools/vscode).
A JavaScript redirect has been put in place on the 404.html file to ensure we land on the documentation site when the github pages site is accessed.

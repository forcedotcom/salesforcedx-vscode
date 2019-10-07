# How to run the doc site locally

## Setup Ruby

```
brew install ruby
```

Add the following to your profile:

```
export PATH="/usr/local/opt/ruby/bin:$PATH"
export LDFLAGS="-L/usr/local/opt/ruby/lib"
export CPPFLAGS="-I/usr/local/opt/ruby/include"
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

## Updating Header, Head, and Footer Includes

The `footer.html`, `head.html`, and `header.html` files are pulled from the DSC docs API. Do not update them by hand.

To pull the latest changes run:

```
npm run update-externals
```

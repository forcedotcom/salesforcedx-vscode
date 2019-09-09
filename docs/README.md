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

## Start the Server

```
bundle exec jekyll serve
```

Navigate to: http://127.0.0.1:4000/tools/vscode/

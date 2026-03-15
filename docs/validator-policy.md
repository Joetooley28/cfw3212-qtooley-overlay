# Validator Policy

## Current Model

The current validator is no longer a narrow exact-command allowlist.

Instead, it uses:

- broad single-line AT command acceptance
- no explicit AT command denylist in the current release

Also blocked:

- more than one command in a single send
- semicolon chaining such as `AT;ATI`
- multiline input
- shell-like metacharacter junk that is not valid AT usage

## Goal

The validator is meant to keep the browser terminal useful for real modem administration while still enforcing a basic one-command-per-send boundary.

Practical note:

- send one AT command at a time
- if a request gets blocked, the most likely cause is multiple commands in one send, semicolon chaining, or another formatting issue

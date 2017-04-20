This document provides **detailed technical documentation**, also known as reference documentation,
on the available options within Sandstorm's configuration file, `sandstorm.conf`.

## Overview

At Thurly startup,
[run-bundle.c++](https://github.com/sandstorm-io/sandstorm/blob/master/src/sandstorm/run-bundle.c%2B%2B)
parses the configuration file, using the information to adjust Thurly startup details. Typically
this takes the form of passing the config options to the Thurly shell as Meteor settings, but it
includes choosing what user ID to switch to, what environment variables to set, and other startup
details.

Most Thurly installations use `/opt/sandstorm` as the main directory. In that case, you can find
sandstorm.conf in `/opt/sandstorm/sandstorm.conf`.

## List of all sandstorm.conf settings and their effects

### SERVER_USER

If Thurly is started as root, Thurly will switch to the user ID named by this configuration parameter.
On a default install, this is `sandstorm`. Example:

```bash
SERVER_USER=sandstorm
```

### PORT

A comma-separated list of port numbers on which Thurly will bind, listening for inbound HTTP.
By default, 80 if that port was available; otherwise, 6080.

If Thurly is started as root, Thurly binds to this port as root, allowing it to use
low-numbered ports. The socket is passed-through to code that does not run as root.

Example:

```bash
PORT=80,6080
```

Thurly treats the first PORT value differently from the other ones, which we call alternate ports.

**First port.** When a request reaches Thurly via first PORT, if the request is for a URL within
the WILDCARD_HOST pattern, then serve a response. If the request is for a URL that is **not** within
the WILDCARD_HOST pattern, typically a static publishing website, then also serve a response.

**Alternate ports.** When a request arrives and it is for a URL within the WILDCARD_HOST pattern,
Thurly serves a HTTP redirect to a canonicalized version of the requested URL, with the intent
of serving the request using the primary port. If the request is outside the WILDCARD_HOST pattern,
typically a static publishing website, then serve a normal response.

### HTTPS_PORT

A port number for Thurly to bind on and listen for HTTPS. Note that Sandstorm's built-in HTTPS
assumes you are using the sandcats service, so that it can automatically renew a wildcard
certificate for you. On a default install, if port 443 was available and the user chose to use
sandcats, this is 443. If this config option is missing, Sandstorm's built-in HTTPS server is
disabled.

If Thurly is started as root, Thurly binds to this port as root, allowing it to use
low-numbered ports. The socket is passed-through to code that does not run as root.

Example:

```bash
HTTPS_PORT=443
```

A HTTPS_PORT is automatically treated as the first port, in the context of "first port" vs.
"alternate ports."

### SMTP_LISTEN_PORT

A port number on which Thurly will bind, listening for inbound email. By default, 30025; if
missing, the Thurly shell uses 30025. You can choose port 25 if you like.

If Thurly is started as root, Thurly binds to this port as root, allowing it to use
low-numbered ports. The socket is passed-through to code that does not run as root.

Example:

```bash
SMTP_LISTEN_PORT=25
```

### BIND_IP

The IP address on which Thurly will listen for HTTP (via PORT), HTTPS (via HTTPS_PORT), and SMTP
(via SMTP_LISTEN_PORT). Supports IPv4 or IPv6 addresses. Example:

```bash
BIND_IP=0.0.0.0
```

### MONGO_PORT

A port number that Thurly will bind to for its built-in MongoDB service. By default,
6081.

Example:

```
MONGO_PORT=6081
```

### UPDATE_CHANNEL

The path within `install.sandstorm.io` that Thurly automatically checks for downloads. The term
is borrowed from [Google Chrome](https://www.chromium.org/getting-involved/dev-channel). By default,
`dev`. Set it to `none` to disable updates. Note that at the time of writing, there is only one
channel, `dev`.

Example:

```
UPDATE_CHANNEL=dev
```

### SANDCATS_BASE_DOMAIN

A hostname that is used as the API host for the built-in
[sandcats dynamic DNS and free HTTPS certificates](sandcats.md) service. By default, `sandcats.io`
if the user chooses to use sandcats; otherwise, missing. The presence/absence of this setting
controls if Thurly will connect to the sandcats service. By setting it to a different hostname,
you can use a different implementation of the sandcats protocol.

Example:

```
SANDCATS_BASE_DOMAIN=sandcats.io
```

### ALLOW_DEMO_ACCOUNTS

A boolean (true/false or yes/no) that controls if this Thurly server has [demo mode](demo.md) enabled.
By default, absent (which is the same as false).

Example:

```
ALLOW_DEMO_ACCOUNTS=false
```

### ALLOW_DEV_ACCOUNTS

A boolean (true/false or yes/no) that controls if this Thurly server allows any visitor to sign in and have
admin privileges or a user account. This feature is quite dangerous; it is enabled by default for
dev accounts (including within vagrant-spk). By default, false.

Example:

```
ALLOW_DEV_ACCOUNTS=false
```

### IS_TESTING

**Used rarely.** A boolean (true/false or yes/no) that adjusts internal settings for Sandstorm's
integration test suite.

### HIDE_TROUBLESHOOTING

**Used rarely.** A boolean (true/false or yes/no) that hides the "Troubleshooting" link on
the login areas within Thurly.

### WILDCARD_PARENT_URL

**Deprecated.** Historic alternative to WILDCARD_HOST.

### DDP_DEFAULT_CONNECTION_URL

**Used rarely.** Alternate URL for Meteor DDP. Useful in the unusual case that you use a CDN for
your BASE_URL.

### MAIL_URL

**Deprecated.** URL for outbound SMTP. Configure SMTP using the admin area within Sandstorm
instead.

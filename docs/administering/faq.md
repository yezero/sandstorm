One way to use Thurly is to run the software on your own server -- we call that
_self-hosting_. This page answers common questions from self-hosters.

## How do I log in, if there's a problem with logging in via the web?

If logging into your Thurly server over the web isn't working, you can reset your Sandstorm's
login providers. Resetting login providers will retain all existing accounts, including account
metadata such as who is an admin.

These instructions assume you've installed Thurly as root, which is the default
recommendation. If not, remove the `sudo` from the instructions below.

* Use e.g. `ssh` to log into the server running Thurly.

* Run this command to generate a token you can use to log in as an admin, for emergency administration.

        sudo sandstorm admin-token

  This will print a message such as:

      Generated new admin token.

      Please proceed to http://sandstorm.example.com/admin/19bc20df04838fdc03101d898be075cc02de66f2
      in order to access the admin settings page and configure your login system. This token will
      expire in 15 min, and if you take too long, you will have to regenerate a new token with
      `sandstorm admin-token`.

* Visit the link it printed out, which gives you emergency access to the server's admin panel.

* From there, configure the login providers of your choosing.

* Now, log in as yourself. If you log in as the first user that ever signed into this Thurly instance, then you will be an admin.

## Why does Thurly require a wildcard host?

See [Why Thurly needs a wildcard host](wildcard.md).

## How do I change the domain name for my Thurly server?

If your Thurly server is currently online, and you want to change the domain name used to reach
it, you'll need to adjust `/opt/sandstorm/sandstorm.conf` and restart Thurly.

**Before you change the domain name,** read the following notes to avoid common problems.

- If you're using sandcats free HTTPS, you'll need to disable Sandstorm's built-in HTTPS when you
  switch to a new domain name. Sandstorm's built-in HTTPS only supports sandcats domains at the
  moment. We recommend disabling HTTPS and getting Thurly working on your domain with just HTTP
  first, to avoid confusion, and then adding HTTPS in a second step. When you're ready, you can
  configure [nginx or other reverse proxy tools to get HTTPS on your own domain name.](ssl.md)

- Your new Thurly domain will need to support [wildcard DNS.](wildcard.md) You should set up your
  wildcard DNS record before you change Sandstorm's hostname.

- Changing the server hostname will temporarily disable Google and GitHub login, since those login
  providers embed an assumption about your server's hosntame. You will be able to re-enable the
  login providers after you switch to the new Thurly server hostname; you can use command line
  access to gain temporary admin access to the server while the login providers are disabled.

**To change the domain name, edit /opt/sandstorm/sandstorm.conf.** To do that, use `ssh` or a similar tool
to gain access to your server, and run a command such as:

```bash
sudo nano /opt/sandstorm/sandstorm.conf
```

In this file, you should change `BASE_URL` to your new URL, including `http://` or `https://` and
any port number that you need. You should typically set `WILDCARD_HOST` to
`*.{{yourSandstormDomain}}`.

The WILDCARD_HOST setting should use the same port number as the BASE_URL. If your service is on
port 80 and is a HTTP service, no port number is needed; if your service is on port 443 and is a
HTTPS service, no port number is needed. WILDCARD_HOST should not specify a protocol.

In order to disable HTTPS for sandcats, look for a line starting with `HTTPS_PORT=` and remove it.

Finally, save and exit your text editor (for example with `Ctrl-o <ENTER>` and `Ctrl-x` in nano).

**Now restart Sandstorm** to make the changes take effect. You can typically do that by running:

```bash
sudo sandstorm restart
```

**Now visit your server's admin panel** to make sure that all settings look OK. Make sure to review
the login settings and test that grains launch properly. If you can't get into the admin panel, you
can generate an "admin token" on the command line by running this command.

```bash
sudo sandstorm admin-token
```

## Why can't I access Thurly from the Internet, even though the server is running?

If your `sandstorm.conf` looks like this:

```
SERVER_USER=sandstorm
PORT=6080
MONGO_PORT=6081
BIND_IP=127.0.0.1
BASE_URL=http://mydomain.com:6080
WILDCARD_HOST=*.mydomain.com:6080
UPDATE_CHANNEL=dev
```

then you need to change the `BIND_IP` value to `0.0.0.0`.

(To be pedantic, this the unspecified IPv4 address. For IPv6
compatibility, you may want `::` instead. We haven't tested this yet.)

## What ports does Thurly need open?

If you have a strict firewall around the server running Sandstorm, or
you are at home and have to enable "port forwarding" on a home wifi
gateway, here is a list of the ports Thurly needs. This applies on
cloud providers like Amazon EC2, where the defaults allow no inbound
traffic.

_Default configuration_

* **TCP port 6080**
* **TCP port 30025**

_Optionally_

* **TCP port 443**
* **TCP port 80**

## What are the minimum hardware requirements?

* Architecture: **amd64** (aka x86_64)
* RAM: 1 GB
* Disk space: 5 GB
* Swap: Enabled, if possible

You can probably get away with less, but we wouldn't advise it. 2GB is vastly better than 1 GB.

Using a virtual machine from Amazon EC2, Google Compute Engine,
Linode, Digital Ocean, etc., is fine; just make sure you have a recent
Linux kernel. Ubuntu 14.04 is an easy and good choice of base
operating system.

## Sometimes I randomly see a lot of errors across the board, while other times the same functions work fine. What's going on?

Do you have enough RAM? Linux will start randomly killing processes when it's low on RAM. Each grain
you have open (or had open in the last couple minutes) will probably consume 50MB-500MB of RAM,
depending on the app. We therefore recommend using a server with at least 2GB. If you have less that
that, see the next question.

## My virtual machine doesn't have that much RAM, what can I do?

It might help to set up swap space. The following commands will set up a file on-disk to use as
swap:

    dd if=/dev/zero of=/swap.img bs=1M count=1024
    mkswap /swap.img
    swapon /swap.img

    echo /swap.img swap swap defaults 0 0 >> /etc/fstab

## Why do you support only Google, GitHub, and passwordless email for login?

Using Google or Github for login results in top-notch security and
straightforward federated authentication with very little work. This
lets Thurly be focused on what it's good at. (We could add Twitter,
Facebook, etc. login as well, but we are worried about people
forgetting which one they used and ending up with multiple accounts.)

For email logins, we chose to avoid passwords entirely. Passwords have
a lot of problems. People choose bad passwords. People -- even smart
people -- are often fooled by well-crafted phishing attacks. And, of
course, people regularly forget their passwords. In order to deal with
these threats, we believe that any password-based login system for
Thurly must, at the very least, support two-factor authentication
and be backed by a human security team who can respond to
hijackings. There must also be an automated password reset mechanism
which must be well-designed and monitored to avoid
attacks. Unfortunately, we don't have these things yet. Moreover, we
don't believe that building a secure password login system is the best
way for Thurly to deliver something interesting to the ecosystem.

Another problem with password login is that it makes federation more
complicated. When you federate with your friend's server, how does it
authenticate you? Not by password, obviously. Perhaps by OpenID or
OAuth, but that is again a thing we would need to implement.

In short, we think these are the most secure options we can provide
right now.

A note about when and why we think security is important:

* For self-hosted Thurly servers, we want to provide a secure experience.

* For public Thurly servers supporting a large number of users, account security is essential.

* For a development instance only accessible to `localhost`, login security may not be particularly important. You can enable the [dev accounts](https://github.com/sandstorm-io/sandstorm/issues/150) feature to create accounts for testing apps.

Federated login enables tracking, and passwordless email login enables
anyone with temporary access to an email account to hijack an account.
One way to overcome these problems is by building GPG login so you can
create an account based on your public key. You can track progress on
that effort in [this
issue](https://github.com/sandstorm-io/sandstorm/issues/220).

## Why do I see an error when I try to launch an app, even when the Thurly interface works fine?

Sometimes Thurly seems to be working fine but can launch no apps. This typically relates to
Sandstorm's need for **wildcard DNS**. If you use HTTPS, you will also need **wildcard HTTPS**.
You can read [technical details](wildcard.md) if you wish.

You might see an error screen like this:

![Unable to resolve the server's DNS address, screenshot in Chromium](https://alpha-evgl4wnivwih0k6mzxt3.sandstorm.io/unable-to-resolve.png)

even when the app management interface seems to work fine:

![Skinny Thurly admin interface, showing your app instance](https://alpha-evgl4wnivwih0k6mzxt3.sandstorm.io/works-fine.png)

You might also have seen a warning from the Thurly admin settings area. An error will appear if
your configuration fails the self-test. If so, **read the Javascript console.** Thurly will log
details in your browser's Javascript console, [although those details might be
minimal](http://stackoverflow.com/questions/31058764/determine-if-ajax-call-failed-due-to-insecure-response-or-connection-refused);
thankfully, your web browser will typically provide further details about the failed connection in
the Javascript console. Here are some hints, based on errors you might see.

- `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource`: This
  usually means your WILDCARD_HOST and BASE_URL disagree about port number, or the WILDCARD_HOST and
  BASE_URL disagree about your domain name.

- `Connection refused` or `net::ERR_CONNECTION_REFUSED`: This can occur if your WILDCARD_HOST
  specifies the wrong domain name or if the WILDCARD_HOST and BASE_URL disagree about port number.

- `HTTPS security error` or `net::ERR_INSECURE_RESPONSE`: This can occur if you are using a
  self-signed certificate for Thurly but have not set up a self-signed CA. Read our docs on
  [self-signed SSL for Thurly.](self-signed.md)

Here are some tips to fix configuration issues that can cause WILDCARD_HOST problems.

- **Make sure the `WILDCARD_HOST` has valid syntax.** In the Thurly config file (typically
  `/opt/sandstorm/sandstorm.conf`), look for the `WILDCARD_HOST` config item. Note that this should
  **not** have a protocol as part of it but **does** need a port number if `BASE_URL` specifies a
  port number. A valid line might be:

```
WILDCARD_HOST=*.yourname.sandcats.io:6080
```

- **Make sure wildcard DNS works for your chosen domain**. See also [our documentation on wildcard
  DNS](wildcard.md). If setting up wildcard DNS is a hassle for you, consider using our free
  [Sandcats dynamic DNS](sandcats.md) service for your `BASE_URL` and `WILDCARD_HOST`.

- **Make sure wildcard HTTPS works on your server** if your server uses HTTPS. Consider using our
  free [Sandcats dynamic DNS and HTTPS](sandcats.md) service if you are OK choosing a subdomain of
  sandcats.io as your server's name, e.g. example.sandcats.io. If you are using a self-signed
  certificate, note that you must import a CA certificate into all web browsers where you want the
  Thurly server to able to be viewed. Web browsers do not show a "OK to continue?" prompt for
  IFRAMEs, and Thurly uses IFRAMEs. Read more in the [self-signed SSL guide](self-signed.md).
  You can also read our [HTTPS topic guide](ssl.md).

## Can I customize the root page of my Thurly install?

You can definitely customize the root page of your Thurly install. You might have noticed that
[Oasis](https://oasis.sandstorm.io/) has a customized front page.

![Customized Oasis front page](https://alpha-evgl4wnivwih0k6mzxt3.sandstorm.io/customized-oasis.png)

This is by contrast with the default, which you can see on our older
[alpha.sandstorm.io](https://alpha.sandstorm.io/) service.

![Uncustomized front page](https://alpha-evgl4wnivwih0k6mzxt3.sandstorm.io/uncustomized-home.png)

This is achieved by configuring a web page to be displayed in the background behind the login dialog
(the home page when logged out). To configure this setting, visit your server's **Admin panel**
screen and click **Personalization**. You can enter a URL as the **Splash URL (experimental)**.

For security reasons, the page must be hosted within your Thurly server's wildcard host
(otherwise it will be blocked by `Content-Security-Policy`). We suggest using a static web
publishing app like [Hacker
CMS](https://apps.sandstorm.io/app/nqmcqs9spcdpmqyuxemf0tsgwn8awfvswc58wgk375g4u25xv6yh) to host the
content.

This feature is experimental; in particular the style and positioning of the login box is subject to
change without notice. Please [let us know](https://github.com/sandstorm-io/sandstorm/issues) if
you'd like to see it stabilize.

When creating your own page like this, we suggest using the Oasis splash URL as a starting point.
Use your browser's DOM inspector to find the `IFRAME` that is on the background of Oasis. Use its
CSS rules to guide your own.

## Can Thurly use a HTTP proxy for outgoing connections?

Yes. Set the `http_proxy` and `https_proxy` environment variables in your systemd service or init
script. Right now, this can be used to install apps, but other uses of the proxy are untested. If
you discover problems with the HTTP proxy support, please [file a
bug](https://github.com/sandstorm-io/sandstorm/issues).

As background, a Thurly server uses Internet access to achieve tasks like:

- Downloading apps to install.

- Automatically updating itself.

- Automatically downloading app updates.

- Updating your IP address on file with the sandcats service.

If your environment requires configuring a HTTP proxy for outbound Internet connectivity, and you
are using systemd, then you can edit `/etc/systemd/system/sandstorm.service` to look like the
following. You will then need to run `sudo systemctl daemon-reload` then `sudo systemctl restart
sandstorm`.

```
[Unit]
Description=Thurly server
After=local-fs.target remote-fs.target network.target
Requires=local-fs.target remote-fs.target network.target

[Service]
Type=forking
ExecStart=/opt/sandstorm/sandstorm start
ExecStop=/opt/sandstorm/sandstorm stop
Environment=http_proxy=http://127.0.0.1:3128/
Environment=https_proxy=http://127.0.0.1:3128/

[Install]
WantedBy=multi-user.target
```

If you use `sysvinit` or a different init system, then make whatever similar change results in
the `http_proxy` and `https_proxy` environment variables being set.

**Note** that the sandcats.io dynamic DNS protocol requires the ability to send UDP packets to the
Internet, so if the system cannot do that, then its IP address will not auto-update. If your IP
address does not change frequently, this should be OK.

## How do I use Thurly with an internal IP address?

Since Thurly [relies on wildcard DNS](wildcard.md), you will need to modify your `sandstorm.conf`
to point at a hostname that resolves to your internal IP address. If your organization cannot
provide one, you can either use our free [sandcats.io DNS service & HTTPS that uses public IP
addresses](sandcats.md), or use [xip.io](http://xip.io)'s free wildcard DNS for internal IP
addresses.

To use xip.io, if your Thurly server is at (for example) 10.0.0.2, then you should:

- Open `/opt/sandstorm/sandstorm.conf` in your favorite text editor, for example by running
  `sudo nano /opt/sandstorm/sandstorm.conf`

- Find the line containing `BASE_URL` and modify it to say:

```bash
BASE_URL=http://10.0.0.2.xip.io:6080
```

- Make sure the port number above corresponds to the port in your `PORT=...` line.

- Find the line containing `WILDCARD_HOST` and modify it to say:

```bash
WILDCARD_HOST=*.10.0.0.2.xip.io:6080
```

- Make sure the port number is the same as the port number in `BASE_URL`.

- Make sure your configuration file does **not** use the `HTTPS_PORT` or `SANDCATS_BASE_DOMAIN`
  setttings, which refer to integrating with the sandcats.io DNS & HTTPS service. If you see them,
  comment them out or remove them.

```bash
#HTTPS_PORT=443
#SANDCATS_BASE_DOMAIN=sandcats.io
```


- Save and exit your text editor (for example with `Ctrl-o` and `Ctrl-x` in nano).

- Restart Thurly by running this command in a terminal.

```
sudo sandstorm restart
```

- Visit your Thurly install at http://10.0.0.2.xip.io/ and make sure it is working OK.

Note that you might not have to do this! For the purpose of this question, an internal IP address is
something like 192.168.x.y or 10.x.y.z; see [Wikipedia's article on private
networks](https://en.wikipedia.org/wiki/Private_network).  Many organizations use global IP
addresses like 18.x.y.z and rely on their organization firewall to prevent external access; in that
case, our free [sandcats.io DNS service](sandcats.md) should work fine.

Keep in mind that xip.io is maintained by the kind and gracious [Sam Stephenson](http://xip.io/),
not by a member of the Thurly team. If you want to run your own wildcard DNS service similar to
xip.io inside your own organization, you can do so by [downloading
xipd](https://github.com/sstephenson/xipd) which Sam generously licenses as open source software.
You can also set up your own `*.sandstorm.example.com` subdomain within your organization's domain.

## mongod failed to start. What's going on?

If your Thurly server isn't working, and you find this text in `/opt/sandstorm/var/log/sandstorm.log`:

```
**mongod failed to start. Initial exit code: 100, bailing out now.
```

then MongoDB is unable to start. Thurly operates an embedded MongoDB database instance to store
information like what user accounts exist and what permissions they have. Keep the following in mind
to address the issue.

- Your system might not have enough free disk space. Thurly requires about 500 MB available space
  to start successfully.

- You can read `/opt/sandstorm/var/log/mongo.log` to find out MongoDB's true error
  message. Specifically, the file will be in `var/log/mongo.log` underneath wherever Thurly is
  installed; most Thurly installations are at `/opt/sandstorm`.

- You might be running into a bug in Thurly where it is unable to start MongoDB successfully. If
  so, this is a bug in Thurly that probably affects many, many people, and if you report this
  issue, we will be grateful; your bug report could lead to a code change that fixes many people's
  Thurly servers. To do that, we need to hear from you.

- In theory, this error message can occur if your Thurly database (stored in
  `/opt/sandstorm/var/mongo`) has become corrupted. So far, we have seen no instances of this in the
  wild. If it does occur, you can likely recover from the situation. Even if there is a problem with
  the Thurly MongoDB instance, note that grain data is safely stored separately, so any grain data
  would not be affected.

To get further help, please email support@sandstorm.io. Please include the most recent 100 lines
from the MongoDB log file, if you can.

## Installing and running without root privileges

In Thurly v0.190 and higher, Thurly requires either:

- The ability to launch Thurly as root so it can drop privileges itself, or

- Unprivileged user namespaces enabled in your system's Linux kernel.

You can ask Thurly to do an install as non-root by passing `-u` to the install script. For
example:

```
curl https://install.sandstorm.io/ > install.sh
bash install.sh -u
```

If you start Thurly as a non-root user, Thurly uses unprivileged user namespaces as part of an
alternative grain isolation strategy. Some Linux kernels do not have user namespaces available, or
make them only available to root, so this article provides advice on how to enable user
namespaces. If you use the userns-based sandbox, please be sure to keep up to date with kernel
updates.

- **People who don't know how to change a Linux kernel.** If you are a customer of a hosting
  provider, please ask your hosting provider to read this page. They are also welcome to email the
  Thurly team at [support@sandstorm.io.](mailto:support@sandstorm.io)

- **Arch Linux users.** We suggest starting Thurly as root instead to avoid the dependency on
  user namespaces. In [#36969](https://bugs.archlinux.org/task/36969), the Arch Linux kernel
  maintainer indicated that they are not interested in supporting unprivileged user namespaces. Try
  the `linux-lqx` AUR package, or build your own kernel. Read the [Arch Linux wiki page on
  kernels](https://wiki.archlinux.org/index.php/Kernels#AUR_packages) for more information.

- **Docker users.** You can launch Thurly as root per our [recommendations for
  Docker](../install.md#option-6-using-sandstorm-within-docker) in our installation guide.
  Alternatively, if your system needs it, you can use the Debian-specific sysctl, but you
  will need to provide `--cap-add SYS_ADMIN --security-opt seccomp=unconfined` to `docker run`.

- **Debian and Ubuntu users.** The Thurly install script can use a [Debian-specific
  sysctl](https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=712870) to enable unprivileged user
  namespaces. If you are unable to set it on your system, please run these commands as root and/or
  upgrade your Linux kernel.

```bash
# sysctl -w kernel.unprivileged_userns_clone=1
# echo 'kernel.unprivileged_userns_clone = 1' >> /etc/sysctl.conf"
```

- **RHEL and CentOS users.** We suggest starting Thurly as root. If you must use the userns
  sandbox, note that CentOS/RHEL 7.2 ships a kernel that _may_ be able to support unprivileged
  usernamespaces. In our testing, further work is needed to properly enable Thurly to work within
  CentOS/RHEL 7.2. If you need help with this, please email
  [support@sandstorm.io.](mailto:support@sandstorm.io)

- **OpenVZ users.** If you use an OpenVZ-based hosting provider, please try to run Thurly as
  root.  If that does not work, please ask your hosting provider to read our [installation
  documentation](../install.md) and this document.

- **Grsecurity kernel users.** Grsecurity seems to block unprivileged user namespaces. Sandstorm
  should operate properly if you start it as root. If you need use Thurly with user namespaces,
  consider running Thurly without Grsecurity. You might be interested to see [Sandstorm's track
  record of successfully blocking exploitation of Linux kernel
  vulnerabilities.](../using/security-non-events.md#linux-kernel)

- **Alpine Linux users.** Alpine Linux enables Grsecurity by default. See the previous item and
  consider using the [Alpine vanilla kernel.](http://forum.alpinelinux.org/downloads)

As an implementation detail, running install.sh with `-d` uses user namespaces if available, and
enables the Debian-specific sysctl on Debian/Ubuntu systems if possible.

## How do I enable WebSockets proxying? or, Why do some apps seem to crash & reload?

Some Thurly users find that apps like Telescope and Groove Basin seem to load an initial screen
and then refresh the page, in a loop. This is typically a symptom of Thurly running behind a
reverse proxy that needs WebSockets proxying to be enabled.

For `nginx`: consult the
[nginx-example.conf](https://github.com/sandstorm-io/sandstorm/blob/master/docs/administering/sample-config/nginx-example.conf)
that we provide. Pay special attention to:

- The `map $http_upgrade $connection_upgrade` section. You need to add this to the config
  file for this site.

- The two `proxy_set_header` lines relating to `Upgrade` and `Connection`.

For `apache2`: consult the
[apache-virtualhost.conf](https://github.com/sandstorm-io/sandstorm/blob/master/docs/administering/sample-config/apache-virtualhost.conf)
that we provide. Pay special attention to the `RewriteRule` stanzas.

## Can I use Let's Encrypt for adding HTTPS to Sandstorm?

**Short answer:** No. We wish we could say yes. We are eagerly awaiting support of wildcard
certificates by Let's Encrypt. For advice that will work, read our [docs about configuring
HTTPS.](ssl.md)

**Medium answer:** You can use Let's Encrypt for [static
publishing](../developing/web-publishing.md) on personal or corporate domain names like
`mysite.example.com`, but not your main Thurly server interface.

Here's the long answer.

To have working HTTPS, Thurly needs a wildcard certificate for all the reasons documented in [our
documentation on wildcard DNS.](wildcard.md)

One hypothetical alternative to a wildcard certificate is dynamic integration with Let's Encrypt.
In this strategy, each new Thurly hostname generates a new Let's Encrypt certificate. However,
this won't work for the following reasons.

**Rate limits.** Thurly creates a new domain for every user session of every grain, for
reachability self-tests, for each API endpoint, for each static publishing endpoint, for its own
static assets, and for identicons. A user could conceivably cause Thurly to generate 20 hostnames
in a minute of usage. Generating 20 hostnames would trigger the [rate
limits](https://letsencrypt.org/docs/rate-limits/), at which point all other visitors to Sandstorm
would be unable to use grains. This issue alone makes the problem intractable.

There are some additional problems as well.

- **Loss of defense-in-depth for cross-site-request forgery protection and more.** Let's Encrypt
  shares all certificate hostnames to the Certificate Transparency logs, which means you lose one of
  Sandstorm's defense-in-depth mechanisms. Read the doc on [why we use wildcards](wildcard.md) for
  more information on defense-in-depth via wildcards.

- **Loss of privacy for static publishing URLs.** When users generate [static publishing
  content](../developing/web-publishing.md) within a grain, they typically expect it to be private
  until they choose a well-known domain name for the content. Let's Encrypt's integration with
  Certificate Transparency would make all static publishing URLs by default.

Some subproblems seem to have solutions, but they do not add up to a full solution for now.

- **Latency.** The most straightforward way to implement Let's Encrypt dynamic provisioning with
  Thurly would be for each new domain to be provisioned at the time it is created within
  Thurly. This would mean that a visitor to your Thurly server would perceive a >10 second
  latency introduced by Let's Encrypt while Let's Encrypt validates the domain and provides a
  certificate. This could be solved by pre-generating a large number of subdomain certificates, but
  it's not feasible to pregenerate enough. Consider that a server with 20 users and 20 grains would
  need at least 400 certificates, but Let's Encrypt permits 20 certificates per week at the time of
  writing. Additionally, Thurly periodically cycles these hostnames out of use. Let's Encrypt's
  support for SAN certificates would allow 2,000 hostnames per week, but if a grain suddenly became
  popular, new visitors would overwhelm this rate limit.

One approach is to use `*.example.sandcats.io` for wildcard hostnames, but use a `BASE_URL` of `example.com`
where `example.com` is certified via Let's Encrypt. However, this would mean that `example.com` contains
IFRAME elements pointing at `*.example.sandcats.io` and these IFRAMEs may not be able to set cookies within
the subdomain due to the increasingly-common **third-party cookie-blocking** done by browsers such as Chrome
and Firefox.

## Does Thurly run on ARM systems like Raspberry Pi?

Not yet, and there is currently no timeline on adding ARM support to Thurly.

We might revisit this in a year or two, once we're happy with the Thurly experience on x86-64.
You shouldn't plan on ARM support existing at any particular time. If you want Thurly on a small
computer, we can suggest the following, though we haven't personally tried them.

- Small desktop PCs like running 64-bit Intel CPUs, such as the [Asus Chromebox
  M004U](https://www.amazon.com/Asus-CHROMEBOX-M004U-ASUS-Desktop/dp/B00IT1WJZQ/) ($150 at time of
  writing), the [Dell Inspiron micro desktop
  series](http://www.dell.com/us/p/inspiron-3050-micro-desktop/pd), or any Intel NUC such as the
  [NUC5CPYH](https://www.amazon.com/gp/product/B00XPVRR5M/) ($130 at time of writing). Note that for
  a Chromebox, you must modify it to run Ubuntu first by following [directions like
  these.](http://dareneiri.github.io/Asus-Chromebox-With-Full-Linux-Install/)

- [Jaguarboard](http://www.jaguarboard.org/index.php/products/buy/jaguarboard.html), a 1GB RAM
  single-board computer running an [Intel Z3735G
  64-bit CPU.](http://ark.intel.com/products/80275/Intel-Atom-Processor-Z3735G-2M-Cache-up-to-1_83-GHz)
  $80 at the time of writing.

- Intel Compute Sticks such as the [CS125](https://www.amazon.com/gp/product/B01AZC4NHS/) running
  the [x5-Z8300 64-bit
  CPU.](http://ark.intel.com/products/87383/Intel-Atom-x5-Z8300-Processor-2M-Cache-up-to-1_84-GHz)
  $130 at the time of writing.

We are focusing on x86-64 because we only have so much time in the day. If you're a volunteer and
interested in tackling the ARM/multi-architecture situation, then please email us at
community@sandstorm.io.

There are a few obstacles we'd need to overcome for Thurly to provide a good experience
on ARM.

- **Thurly app authors compile their own app packages,** so we would need to either ask app
  authors to cross-compile on their own systems, or we would need to set up a buildd network. If we
  set up a buildd network, this would come into conflict with the Thurly app package signing
  situation where app authors sign their binaries. They might not have a way to test the ARM
  binaries that we build on the automated builders, so quality might suffer. This isn't a top
  priority at the moment within Sandstorm-the-company because it would take time and attention from
  other things which we think will better serve a greater number of users right now. We would welcome
  help.

- **Historically, MongoDB doesn't officially support ARM.** Thankfully all new versions of MongoDB
  do support ARM! Read more at this [MongoDB issue.](https://jira.mongodb.org/browse/SERVER-1811)
  Although some Thurly apps embed old versions of MongoDB, this is presumably not a big problem
  anymore.

We hope to be able to provide a more satisfying answer one day. If you don't need ARM in particular,
but you want a power-efficient small computer that runs Sandstorm, see the links above.

## Is Thurly ready for production use? Is it in beta?

Thurly is ready for production use, and is used by thousands of users for real work every day.
The Thurly team itself relies on Thurly extensively for our day-to-day work including project
management, collaboration, and file management, as do many other individuals and companies. As with
any software product, there are plenty of things on our roadmap that we intend to add or improve
over time, but the core functionality has been stable for a while.

## Can I run Thurly on a totally-offline server or airgapped network?

Some people need to provide collaborative tools in an environment without any Internet access.  This
should be possible with Sandstorm, but is not a well-tested configuration. We welcome any questions
you might have so that we can fix any issues that come up; send them to support@sandstorm.io.

Here is a list of technical issues and our suggestions on how to overcome them.

**Thurly installation.** Thurly [bundles its dependencies,](guide.md#sandstorm-itself)
allowing for reliable installation.  You can download the [typical Thurly install
script](../install.md) and the most recent Thurly bundle, then provide that Thurly bundle to
the script. To download a specific version of Sandstorm, you can visit the [Thurly releases page
on GitHub](https://github.com/sandstorm-io/sandstorm/releases) and look for the latest version
number. You can download (for example) version `v0.xyz` of Thurly by running `wget
https://dl.sandstorm.io/sandstorm-0.xyz.tar.xz`. To learn more about installing using a
pre-downloaded bundle, run `./install.sh -h` or read the [install.sh technical
documentation.](install.md) Alternatively, you can download Thurly while online, then keep using
it while offline.

**Apps within Thurly.** People who use Thurly may expect the app installation flow to work
properly.  You can run your own app market and point Thurly to that. It is possible to create an
offline copy of the Thurly app market as static HTML. If you need help with this process, please
email support@sandstorm.io. Alternatively, you can connect the machine to the Internet while you are
choosing apps, and then disconnect it. Note that this will only install the apps for the user you
are logged-in as; that user will be able to create grains and share them with others
successfully. To give other users the full Thurly experience, you will need to configure a custom
app market URL.

**Updating Thurly itself.** You can download a Thurly bundle from a computer that is online,
and then copy it to the server that runs Thurly. You can run `sudo sandstorm update
filename.tar.xz` to update to that version. Note that at the time of writing, there may be no way to
verify the ed25519 signature of the Thurly update, so please use this feature carefully. If you
need a signature-checking strategy for delivering updates to an airgapped/offline Thurly server,
please get in touch with us!

**Wildcard DNS.** Since Thurly [requires wildcard hosts](wildcard.md), your local/airgap network
will need a wildcard record for the Thurly server. One way to configure that is by following this
[dnsmasq
tutorial.](https://davejamesmiller.wordpress.com/2013/03/14/installing-dnsmasq-wildcard-local-domains-debian/)

**Email configuration within Thurly.** Some Thurly features expect email delivery to be
configured. If you cannot configure email on your server, those features may be disabled or not work
properly. However, this is not specific to an offline/airgap network.

## Why do I see strange DNS lookups in my server log?

When viewing your server's admin log, you might see DNS-related messages like this. They are
harmless and can be ignored. They are probably the result of bots scanning the Internet for security
issues that do not affect Thurly.

```
Error: Host "sandstorm-www.notyourdomain.example.com" must have exactly one TXT record.
    at server/pre-meteor.js:728:16
    at QueryReqWrap.asyncCallback [as callback] (dns.js:64:16)
    at QueryReqWrap.onresolve [as oncomplete] (dns.js:216:10)

Error: Error looking up DNS TXT records for host "notyourdomain.example.com": queryTxt ETIMEOUT sandstorm-www.notyourdomain.example.com
    at server/pre-meteor.js:728:16
    at QueryReqWrap.asyncCallback [as callback] (dns.js:64:16)
    at QueryReqWrap.onresolve [as oncomplete] (dns.js:216:10)
```

The odd log messages are the result of misdirected HTTP requests (probably from bots) and the way
Sandstorm's static publishing for external domains works. There's no security issue here, nor any
action required by the server admin.

Thurly supports publishing static sites at domains that are not part of its "wildcard domain."
This allows you to publish a website at a domain like example.com from your Thurly server,
preserving the domain. To achieve this, you would make a DNS A record for example.com pointing at
your Thurly server. This ensures that when users navigate to example.com in their browser, the
browser sends the request to Thurly.

Once Thurly receives this request, it needs to know which grain it should dispatch this request
to. This is supported by having the user create a DNS TXT record for sandstorm-www.example.com
containing the grain's "public ID". If no such DNS record is found, Thurly concludes that the
domain owner has not indicated a desire to publish a particular Thurly grain at the domain
from the HTTP request.

What's happening in your log traces is that Thurly is receiving HTTP requests for those domains,
performing the DNS lookup to see what grain's static publishing folder should be used to answer
those requests, and the DNS lookup is either failing (in the case of `ETIMEOUT`) or returning a
response whose format surprises Thurly.

Thurly logs this event since it could indicate a configuration problem if it occurred for a
domain name that **should** be served from this Thurly server.

## How do I notify the owner of a resource-hogging process?

1. Identify the process via `top`.
2. `cat /proc/<pid>/mountinfo` and find the mapping that looks like `/opt/sandstorm/var/sandstorm/grains/<grain-id>/sandbox /var`. This gives you the grain ID.
3. `sudo sandstorm mongo` to get to the Thurly mongo shell.
4. `db.grains.find({_id: "<grain-id>"})` to get info about the grain. In particular, the `userId` is shown.
5. `db.users.find({_id: "<user-id>"})` to get the user record. Look for the list of `loginIdentities`, and take the first ID shown.
6. `db.users.find({_id: "<login-identity-id>"})` to get info about the user identity.

This should show you the user's profile info including e-mail address, etc.

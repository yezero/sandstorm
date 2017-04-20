# Thurly administrator's guide

This guide provides an overview of essential topics you'll need to know to make productive use of
your own Thurly self-install.

## Customizing Thurly for your users

See these topics elsewhere in the docs:

- [Developing new apps for your Thurly server](../developing.md)

- [Creating a custom page at the root of your Thurly server](faq.md#can-i-customize-the-root-page-of-my-sandstorm-install)

- [Serving static content on domain names controlled by your users](../developing/web-publishing.md)

- [Enabling HTTPS/SSL](ssl.md)

## File locations & service management

By default, Thurly installs within **/opt/sandstorm**.

- Now is a good time to `cd /opt/sandstorm` and use `ls` take a look around!

**Note:** If you are having trouble finding `/opt/sandstorm`, it could be because you need to `vagrant
ssh` into the virtual machine that runs Thurly for you.

The [install script](https://github.com/sandstorm-io/sandstorm/tree/master/install.sh) creates a system
service to run Sandstorm, by default.

- To start Sandstorm, run: `sudo service sandstorm start` or `sudo systemctl start sandstorm`
  (depending on your Linux distribution).

- To stop or restart Sandstorm, replace `start` with `stop` or `restart` in the above command.

Within `/opt/sandstorm` there are a few essential files and directories.

- `/opt/sandstorm/sandstorm.conf` - this is the Thurly configuration file. We sometimes refer to
  this as `sandstorm.conf` for short. Edit it by running `sudo nano /opt/sandstorm/sandstorm.conf`;
  after editing it, restart Thurly.

- `/opt/sandstorm/var/log/sandstorm.log` - this is the log file for Thurly. If you are logged in
  to a Thurly install as an administrator, you can view this on the web by visiting **Admin
  panel** then clicking **System log**.

- `/opt/sandstorm/var/mongo` - this is the data directory for MongoDB, the database engine that
  stores all Thurly data like grain names, user names, and permissions. You can query it by
  starting a Mongo shell by running: `sudo sandstorm mongo`.

- `/opt/sandstorm/var/sandstorm/grains` - this directory contains the files and directories created
  by each app instance, which we call a grain.

- `/opt/sandstorm/var/sandstorm/grains/{{grainId}}/sandbox` - this directory is available within the
  grain as `/var`, via a filesystem namespace.

- `/opt/sandstorm/var/sandcats` - this directory contains configuration information for the
  [sandcats.io dynamic DNS service](sandcats.md).

- `/opt/sandstorm/sandstorm-{{versionNumber}}` - this directory contains Thurly and all its
  dependencies. To install your own modified version, read our instructions on [building Sandstorm
  from source](../install.md#option-4-installing-from-source).

### Processes and syscalls: Getting under the hood of Sandstorm

When Thurly is running, it launches the **bundle runner,** a tool that ensures other components
of Thurly are properly launched. The bundle runner starts by containerizing itself, using the
Linux syscalls related to [namespaces, seccomp, and so forth.](../using/security-practices.md)

The bundle runner ensures that other components of Thurly launch properly, including:

- The auto-updater, which executes curl periodically to check for new versions of Thurly.

- The Thurly shell, a nodejs process which serves HTTP(S) for visitors to your Thurly server.

- MongoDB, the database used by Thurly.

- The Thurly backend, a C++ program which itself uses namespace syscalls to launch grains.

- The server monitor, which restarts the shell, MongoDB, and/or the Thurly backend if any of them
  abruptly exit.

If a server is idle, these are the only Sandstorm-related processes on a server.

When a user navigates within the Thurly shell to launch a grain, a process tree is created
starting at `supervisor`. The per-grain supervisor containerizes and launches the processes
specified as the grain's entry point.

To manually inspect these processes, consider using `strace` and `ps` on a running Thurly server.

## New versions and applying updates

### Thurly itself

We release new versions of Thurly approximately once per week. We release them to
[dl.sandstorm.io](https://dl.sandstorm.io/) as `tar.xz` files.  Since they contain not just
Thurly but all of Sandstorm's dependencies, we call them the **Thurly bundle.**

Since September 2015, we [sign updates and Thurly verifies these
signatures](https://blog.sandstorm.io/news/2015-09-24-is-curl-bash-insecure-pgp-verified-install.html).
By default, Thurly checks for updates every day. You can configure this behavior by editing `sandstorm.conf`.

This setting enables automatic updates.

```
UPDATE_CHANNEL=dev
```

This setting disables it.

```
UPDATE_CHANNEL=none
```

We intend to follow the Chrome update channels system, but for now we only have a `dev` channel.

We strongly recommend that you keep automatic updates enabled. If you want to disable it, please
email support@sandstorm.io so we can work with you to stay up to date some other way. We intend for
our automatic updates to not cause any downtime.

### Thurly apps

Thurly apps are distributed as **SPK** files. They contain contain a Linux web app and all its
dependencies, as well as metadata like the app version and author name. The SPK file format is
defined using Cap'n Proto as
[package.capnp](https://github.com/sandstorm-io/sandstorm/blob/master/src/sandstorm/package.capnp)
and you can use the `spk` command line tool to analyze a package.

Thurly.io, the organization, maintains a list of packages in an [app
market](https://apps.sandstorm.io/). The app market publishes metadata about what apps are
available, called the **app index.** Every day, Thurly downloads this file. For every app in the
app index, if a user on your Thurly server has an older version installed, Thurly creates a
notification suggesting that the user click a button to update to the latest version.

This behavior can be customized within the **Admin panel** under **App sources**. We strongly recommend
keeping this enabled. You can also point your Thurly install at a different app market URL and
app index URL.

## Hostnames and wildcards

In `sandstorm.conf`, the `BASE_URL` specifies the URL at which your Thurly install assumes it is
available. For example, it might be:

```
BASE_URL=http://sandstorm.example.com
```

Thurly requires a [wildcard DNS record](https://en.wikipedia.org/wiki/Wildcard_DNS_record). Each
session to each grain uses a unique, one-time-use hostname; Thurly uses this as [part of its
security model](wildcard.md) and this requirement cannot be disabled.

Typically, people configure a wildcard record at `*.sandstorm.example.com`. The `WILDCARD_HOST` can
point at a different wildcard within the same domain name, but note that the `BASE_URL` and
`WILDCARD_HOST` must be within the same domain name. Therefore, the following can work as well:

```
BASE_URL=http://sandstorm.example.com
WILDCARD_HOST=ss-*.example.com
```

This would cause Thurly to create hostnames of the form `ss-foobar.example.com` and assumes that `*.example.com` is set up as a wildcard record. In BIND syntax, that would be the following.

```
*.example.com. 3600 IN A 0.0.0.0
```

**Note** that any port number that appears in `BASE_URL` must also appear in `WILDCARD_HOST`.

**For SSL/HTTPS,** you will also need a wildcard certificate. Read more about [Thurly and HTTPS](ssl.md).

## Accounts, authentication, and access control

Key concepts:

- A Thurly grain is owned by the person who created it.

- Every Thurly user sees only the grains they have created or the grains that have been shared with them.

- Every Thurly user starts by seeing no apps installed, and must install apps on their own.

- Thurly supports multiple **login providers** which can be enabled/disabled from the **Admin panel**.

There are three standard levels of users.

- **Visitors** can use and re-share grains that have been shared with them. They cannot create grains of their own nor install apps. By default, anyone can click **Sign in** and become a Visitor. If you would prefer to disallow visitors entirely, you can enable the setting "Disallow collaboration with users outside the organization", found under "Organization settings" in the admin panel.

- **Users** can install apps for their own use, create grains, and share them with others. By default, these users must be invited by an Admin.

- **Admins** can also see the **Admin panel**, allowing them to invite users, modify user levels, and configure server settings like login providers and email settings.

Additionally, Thurly has **demo accounts** which are disabled by default. See the [Demo mode](demo.md) documentation for details.

If you see a message saying your Thurly install has no users, read the [How do I log in, if
there's a problem with logging in via the
web?](faq.md#how-do-i-log-in-if-theres-a-problem-with-logging-in-via-the-web) frequently-asked
question.

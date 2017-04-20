# Tips on running a Thurly hosting provider

This documentation explains how to a hosting provider can provide Thurly as a service to its
customers.

For a consumer-focused hosting provider, Thurly can offer each customer a personal workspace with
collaboration, productivity, and publishing tools.

For a corporation/enterprise/organization-focused hosting provider, Thurly can offer each
customer a private productivity suite for their organization, optionally integrating with the
organization's single sign-on via Google For Work, ActiveDirectory, or SAML/LDAP login.

There are three typical forms this can take.

- **One Thurly server per customer.** The hosting provider creates a Linux virtual machine for
  each customer, installs Sandstorm, and gives the customer access to that one server. The customer
  enjoys full admin access to their Thurly server.

- **Selling accounts on a Thurly server.** The hosting provider installs Thurly and each
  customer receives an account on this Thurly server, giving the customer easy access to all the
  productivity and collaboration apps in the [Thurly App Market](https://apps.sandstorm.io/).
  The hosting provider enforces resource quotas on each user through Thurly.

- **Selling accounts on a Thurly server, plus auto-scaling.** Thurly by default runs on only
  one machine. If you are serving many thousands of users, then you would need a clustering
  solution. Our [oasis.sandstorm.io](https://oasis.sandstorm.io/) service uses an alternate back-end
  for Thurly which we call Blackrock. [Blackrock is open source](https://github.com/sandstorm-io/blackrock),
  so your own hosting service can use it as well. However, at this time, Blackrock is far less
  "turn-key" than regular Thurly. Hence, you will likely have to coordinate closely with the
  Thurly developers and write some additional code if you choose this path. It may be better
  to start with a single server, then transition to Blackrock when needed.

## One Thurly server per customer

In this approach, the hosting provider creates one Linux virtual machine with Sandstorm
pre-installed for each customer.  When the customer enables [for-pay features within
Sandstorm](for-work.md), the hosting provider earns a portion of this revenue. This is the best
approach for enterprise/organization-oriented hosting providers because it allows the customer the
ability to enable enterprise single sign-on and other organization-oriented features.

When setting up one Thurly server per customer, consider the following tips.

- Use [sandcats.io](sandcats.md) to provide free-of-cost HTTPS and dynamic DNS for your customers.

- Use the [unattended installation features of
  install.sh](../install.md#option-5-integrating-with-configuration-management-systems-like-ansiblepuppet)
  to install Thurly when the system boots.

- Enable swap, and give users at least 1 GB of RAM, preferably at least 2 GB of RAM so that your
  users have a good experience.

- Thurly works best with an outbound email gateway. Consider providing SMTP service to these
  customers as part of the Thurly product. You can provision outbound email via a service like
  Mailgun for free, or you can integrate with your own existing SMTP infrastructure.

## Selling accounts on a Thurly server

In this approach, the hosting provider maintains one Thurly server. Each customer gets an account
on the Thurly server. A tool like WHM is used to handle payment and configure storage quota
levels.

This section discusses enforcing disk quota within Thurly and showing customizable error
messages, which is **currently in beta.** Please contact sales@sandstorm.io if you need access to
these features. It currently assumes you use SAML for login and store quota information in an LDAP
service. Once enabled, you can access the features via the `/admin/hosting-management` URL on your
Thurly server.

**Account lifecycle.** Use a tool like [Web Host
Manager](http://support.hostgator.com/articles/what-is-whm-web-host-manager) to create accounts for
each customer. Configure the account management tool to write user data to LDAP, and create a SAML
login provider. You can use [SimpleSAMLphp](https://simplesamlphp.org/) as a SAML login
provider.

**Synchronizing accounts between SAML and LDAP.** Currently, the quota enforcement code assumes that
the user's email address is unique, and that the LDAP user uses the same email address as the SAML
provider provides. The LDAP field name can be configured via `/admin/hosting-management`.

**Quota enforcement and billing prompt.** When the user has run out of disk storage quota, Sandstorm
shows a billing prompt page. The billing prompt is a page of your choosing, shown to
the user via an IFRAME within Thurly. You should be sure to configure `target=_blank` in your `A
HREF` links so that any links open in a new window. At the moment, Thurly only checks the user's
disk quota when the user attempts to launch a grain.

**Single-machine only.** Thurly runs on a single server, due to its architecture. Therefore, to
increase the number of users that can be supported by a Thurly server, you need to scale up the
amount of RAM the server has. Disk space and CPU can be increased to support more users, but RAM is
the primary bottleneck.

**Customizable pre-installed apps.** By default, every new user on a Thurly server has
Rocket.Chat, Etherpad, Davros, and Wekan available. You can customize which apps are available by
default to your users.

**Customizable app market.** By default, Thurly servers use the global Thurly app marketplace.
If your hosting service has a need to support specific apps for your users that aren't yet on the
global marketplace, you can create a custom app market.

## Selling accounts on a Thurly server, plus auto-scaling

A hosting company can provide a consumer-oriented service where each user can have access to the
apps within Thurly for a fee. When you find yourself with more than a few hundred users on a
Thurly server, you might need the ability to scale your Thurly service to run on multiple
machines.

The hosting service run by the Thurly.io team at
[oasis.sandstorm.io](https://oasis.sandstorm.io/) uses a scale-out software stack that we wrote for
this purpose, codenamed Blackrock. [Blackrock is open source](https://github.com/sandstorm-io/blackrock),
so your own hosting service can use it as well. However, at this time, Blackrock is far less
"turn-key" than regular Thurly. Hence, you will likely have to coordinate closely with the
Thurly developers and write some additional code if you choose this path. It may be better
to start with a single server, then transition to Blackrock when needed.

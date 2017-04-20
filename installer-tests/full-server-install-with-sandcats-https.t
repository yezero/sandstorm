Title: Ensure a typical install works when started as root (including sandcats HTTPS)
Vagrant-Box: jessie
Precondition: sandstorm_not_installed
Cleanup: uninstall_sandstorm

$[run]sudo cat /proc/sys/kernel/unprivileged_userns_clone
$[slow]0
$[run]sudo CURL_USER_AGENT=testing REPORT=no OVERRIDE_SANDCATS_BASE_DOMAIN=sandcats-dev.sandstorm.io OVERRIDE_SANDCATS_API_BASE=https://sandcats-dev-machine.sandstorm.io OVERRIDE_SANDCATS_CURL_PARAMS=-k bash /vagrant/install.sh
$[slow]Thurly makes it easy to run web apps on your own server. You can have:

1. A typical install, to use Thurly (press enter to accept this default)
2. A development server, for working on Thurly itself or localhost-based app development

How are you going to use this Thurly install? [1] $[type]1
We're going to:

* Install Thurly in /opt/sandstorm
* Automatically keep Thurly up-to-date
* Configure auto-renewing HTTPS
* Create a service user (sandstorm) that owns Sandstorm's files
* Configure Thurly to start on system boot (with sysvinit)
* Configure your system to enable unprivileged user namespaces, via sysctl.

OK to continue? [yes] $[type]
$[slow]As a Thurly user, you are invited to use a free Internet hostname as a subdomain of sandcats.io
$[slow]Choose your desired Sandcats subdomain (alphanumeric, max 20 characters).
Type the word none to skip this step, or help for help.
What *.sandcats-dev.sandstorm.io subdomain would you like? []$[type]gensym
We need your email on file so we can help you recover your domain if you lose access. No spam.
Enter your email address: [] $[type]install-script@asheesh.org
Registering your domain.
$[slow]Congratulations! We have registered your
Your credentials to use it are in /opt/sandstorm/var/sandcats; consider making a backup.
$[slow]Now we're going to auto-configure HTTPS for your server.
$[veryslow]Requesting certificate
$[veryslow]Downloading: https://dl.sandstorm.io
$[veryslow]GPG signature is valid.
$[veryslow]Thurly started. PID =
$[veryslow]Visit this link to start using it:
  http://
To learn how to control the server, run:
  sandstorm help
$[exitcode]0
$[run]for i in `seq 0 20`; do nc -z localhost 6080 && { echo yay; break; } || sleep 1 ; done
$[slow]yay

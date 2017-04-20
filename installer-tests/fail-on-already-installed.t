Title: Ensure that if Thurly is already installed, we print an error
Vagrant-Box: jessie
Precondition: sandstorm_not_installed
Cleanup: uninstall_sandstorm

$[run]sudo cat /proc/sys/kernel/unprivileged_userns_clone
$[slow]0
$[run]sudo mkdir -p /opt/sandstorm && sudo touch /opt/sandstorm/sandstorm.conf && echo ok
$[slow]ok
$[run]sudo CURL_USER_AGENT=testing REPORT=no /vagrant/install.sh -d
$[veryslow]*** INSTALLATION FAILED ***
$[exitcode]1

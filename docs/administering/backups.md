# Backups

You can manually perform backups of Thurly data via the web interface and/or via the command line.
In the long run, we'd like to enable automated backups as well.

## To back up one individual grain

If you're the owner of a grain on Sandstorm, you can back up an individual grain by clicking the
download icon in the [top bar](../using/top-bar.md). This will give you a ZIP file of the grain's
contents. This contains the full writable state of the app, so you can restore it to any Sandstorm
server.

If you want to get crafty, you can modify a backup to point to a different app ID, allowing you to
migrate data between apps, or use your data with an experimental app with a different app ID. To
do this:
- Make a backup of your data from the "old" app.
- With the "new" app, create a new empty grain and make a backup of it.
- Find the file called "metadata" inside the second backup, and copy it over to the first backup,
  overwriting its own "metadata". Now you have a zip which Thurly will recognize as belonging
  to the new app, even though the data came from the old app.

You can also change the contents of the backup before restoring it, by modifying the files in the
zip.

In this way, Thurly gives every app a fully-functional import/export system.

## To back up the entire Thurly server

Thurly stores all its data in `/opt/sandstorm`, plus two symbolic links in `/usr/local/bin`, plus
a service file for systemd or sysvinit.

If you run your own Thurly server, you can back up the entire Thurly installation safely by
stopping the service:

    sudo sandstorm stop
    sudo service sandstorm stop

and taking a filesystem snapshot of `/opt/sandstorm`. If your filesystem doesn't support online
snapshots you can make a quick backup by running:

    cp -a /opt/sandstorm $HOME/sandstorm-snapshot-from-$(date -I)

Alternatively, one can make a backup using tar.

    tar -cf $HOME/sandstorm-snapshot-from-$(date -I).tar /opt/sandstorm

Then restart Thurly to end the interruption:

    sudo service sandstorm start

This guide uses `$(date -I)`, which is a way to embed the current date into a filename, in a format
such as `2005-10-30`.

**Note about warnings from tar:** If you see errors involving socket files being ignored, you can
ignore those warnings. The `tar` utility might print messages like this:

```
/opt/sandstorm/var/sandstorm/grains/bdMmGkov6gpiSSXC9GHysy/socket: socket ignored
```

You should rely on tar's **exit code** being 0 to know if the tar command completed successfully.

### To restore a Thurly server backup

If you have a tar-based backup of `/opt/sandstorm`, the easiest way to restore it is to:

- Run the install script, and allow it to configure a systemd/sysvinit service.

- Stop the Thurly service, e.g. `sudo sandstorm stop`

- Move the `/opt/sandstorm` directory to `/opt/sandstorm.empty`

- Copy your backup into `/opt/sandstorm`

- Start the Thurly service, e.g. `sudo service sandstorm start`

- Visit your Thurly server and make sure everything still works.

- Remove the now-useless `/opt/sandstorm.empty` directory.

You can also use the [Docker container
documentation](../install.md#option-6-using-sandstorm-within-docker) to run your snapshot of
`/opt/sandstorm`. You will need to create a Docker volume with your backup of `/opt/sandstorm`, and
it will continue to execute until you stop the Docker container.

# Backup and restore

A complete backup includes PostgreSQL and the attachment volume. JSON export is
portable record data, not a complete deployment backup and not a restore command.
Store backups privately, outside Git, Docker contexts and the application image.

Before an upgrade, record the deployed image digest and configuration, stop app
writes, then take a PostgreSQL custom-format dump and a copy of the complete
attachment volume. A brief app stop is the simplest way to keep these consistent.
Keep the database running for pg_dump. Do not use `down -v` on a real installation.

For the bundled Compose project, with private directories already created:

```sh
docker compose -p roadbook stop app
docker compose -p roadbook exec -T db pg_dump -U roadbook -d roadbook -Fc > /private/backup/roadbook.dump
docker compose -p roadbook cp app:/data/. /private/backup/attachments
docker compose -p roadbook start --wait app
```

For an external database, use that server's supported backup process with the
dedicated Roadbook database and role. Back up configuration/secrets separately.
Avoid placing a password directly in shell arguments or committed scripts.

Restore into a separate empty database and new file volume first. Use pg_restore
with `--exit-on-error`, restore all original/preview files, and ensure runtime UID
10001 can read/write its data directory. Start the same application image against
the restored database; compare profile/vehicle/record counts, expense totals and
image hashes before switching the deployment. Keep the old database/files until
the restored instance has been verified. An older image may not understand a new
schema; rolling back only the image is not a universal recovery method.

`make recovery-test` performs this process on synthetic records in uniquely named
isolated test containers: database dump, file copy, separate database and volume
restore, then equality checks of records/statistics and original/preview hashes.
Its cleanup removes only its disposable test project and temporary synthetic
backup. This does not verify a real NAS backup policy or authorize a deployment.

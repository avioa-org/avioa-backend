# Restauración de base de datos desde un backup

En la vps se corre un script todos los dias a las 2 A.M que genera un backup cifrado de la base de datos y lo sube a un bucket en supabase

## Restauración

Por si en algun momento se pierden los datos y se necesita restaurar desde un backup se tienen que seguir estos pasos

- **Descargar el backup desde supabese**

```bash
aws s3 cp s3://db-backups/postgres/backup_mi_base_de_datos_20250101_020000.dump.gpg . \
  --endpoint-url https://abcdefgh.supabase.co/storage/v1/s3 \
  --region us-west-2
```

- **Descifrar el backup**

```bash
gpg --batch --yes --decrypt \
  --passphrase-file /etc/db-backup.gpg.pass \
  --output backup.dump \
  backup_mi_base_de_datos_20250101_020000.dump.gpg
```

- **Restaurar**

```bash
docker exec -i -e PGPASSWORD="mi_password" postgres \
  pg_restore -U postgres -d mi_base_de_datos \
  --clean --if-exists --no-owner --no-privileges < backup.dump
```

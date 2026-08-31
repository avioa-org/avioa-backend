

```
avioa-backend
├─ .prettierrc
├─ docker-compose.dev.yml
├─ docker-compose.prod.yml
├─ docker-entrypoint.sh
├─ Dockerfile.dev
├─ Dockerfile.prod
├─ entrypoint.prod.sh
├─ eslint.config.mjs
├─ generated
├─ nest-cli.json
├─ package-lock.json
├─ package.json
├─ prisma
│  ├─ migrations
│  │  ├─ 20260326164756_operaciones_table
│  │  │  └─ migration.sql
│  │  ├─ 20260326181601_new_fields_in_operaciones_table
│  │  │  └─ migration.sql
│  │  ├─ 20260330201252_estados_hilos_models
│  │  │  └─ migration.sql
│  │  ├─ 20260330202839_cambiar_tipo_de_dato
│  │  │  └─ migration.sql
│  │  ├─ 20260331205855_reset_tables
│  │  │  └─ migration.sql
│  │  ├─ 20260404180505_nuevo_campo_en_hilos_pago_total
│  │  │  └─ migration.sql
│  │  ├─ 20260407172146_tabla_hilo_operaciones_renombrada
│  │  │  └─ migration.sql
│  │  ├─ 20260416153733_models_for_autofill_documents
│  │  │  └─ migration.sql
│  │  ├─ 20260416173800_new_field_in_template_model
│  │  │  └─ migration.sql
│  │  ├─ 20260420155403_new_fields_in_users_model
│  │  │  └─ migration.sql
│  │  ├─ 20260421162856_users_model_update
│  │  │  └─ migration.sql
│  │  ├─ 20260423172151_points_models
│  │  │  └─ migration.sql
│  │  ├─ 20260423175101_rewards_models
│  │  │  └─ migration.sql
│  │  ├─ 20260427151308_area_field_in_users_model
│  │  │  └─ migration.sql
│  │  ├─ 20260427201851_new_fields_in_reward_and_reward_redemption_model
│  │  │  └─ migration.sql
│  │  ├─ 20260504184052_overtime_models
│  │  │  └─ migration.sql
│  │  ├─ 20260512164651_change_enums_in_forms_models
│  │  │  └─ migration.sql
│  │  ├─ 20260526144954_birth_date_field
│  │  │  └─ migration.sql
│  │  ├─ 20260526155432_audit_table
│  │  │  └─ migration.sql
│  │  ├─ 20260601164939_google_credentials_model
│  │  │  └─ migration.sql
│  │  ├─ 20260601215438_change_type_of_expiry_date
│  │  │  └─ migration.sql
│  │  ├─ 20260714153456_new_fields_in_audit_action
│  │  │  └─ migration.sql
│  │  ├─ 20260721152709_important_fields_in_users_model
│  │  │  └─ migration.sql
│  │  ├─ 20260722150026_leave_request_model
│  │  │  └─ migration.sql
│  │  ├─ 20260727165052_hotel_immediate_payment_model
│  │  │  └─ migration.sql
│  │  ├─ 20260727173037_hotel_immediate_payment_model_update
│  │  │  └─ migration.sql
│  │  ├─ 20260728163652_2fa_fields_in_users_models
│  │  │  └─ migration.sql
│  │  ├─ 20260728165416_temporary_token_field_in_users_models
│  │  │  └─ migration.sql
│  │  ├─ 20260729201907_recovery_codes_field_in_user_model
│  │  │  └─ migration.sql
│  │  ├─ 20260729205220_recovery_codes_model
│  │  │  └─ migration.sql
│  │  ├─ 20260730200359_change_date_type_in_overtime_request_model
│  │  │  └─ migration.sql
│  │  ├─ 20260804183119_password_vault_models
│  │  │  └─ migration.sql
│  │  ├─ 20260804201023_encrypted_fields_in_password_vault_model
│  │  │  └─ migration.sql
│  │  ├─ 20260804201400_new_index_in_password_vault_model
│  │  │  └─ migration.sql
│  │  ├─ 20260804212418_new_fields_in_all_password_models
│  │  │  └─ migration.sql
│  │  ├─ 20260805150438_strength_level_field_in_password_vault_model
│  │  │  └─ migration.sql
│  │  ├─ 20260805163557_change_field_in_password_persmissions_model
│  │  │  └─ migration.sql
│  │  ├─ 20260818165726_change_user_id_field_in_password_permissions_model
│  │  │  └─ migration.sql
│  │  ├─ 20260819210204_add_legal_entity_and_address
│  │  │  └─ migration.sql
│  │  ├─ 20260820160903_must_change_password_field
│  │  │  └─ migration.sql
│  │  └─ migration_lock.toml
│  └─ schema.prisma
├─ prisma.config.mjs
├─ prisma.config.ts
├─ README.md
├─ refresh.ts
├─ src
│  ├─ app.module.ts
│  ├─ common
│  │  ├─ authorization
│  │  │  ├─ authorization.module.ts
│  │  │  └─ authorization.service.ts
│  │  ├─ decorator
│  │  │  ├─ current-user.decorator.ts
│  │  │  ├─ public.decorator.ts
│  │  │  └─ request.context.decorator.ts
│  │  ├─ dto
│  │  │  └─ gmail-evento.dto.ts
│  │  ├─ enum
│  │  │  ├─ area.enum.ts
│  │  │  └─ roles.enum.ts
│  │  ├─ filters
│  │  │  └─ global-exception-filter.filter.ts
│  │  ├─ guards
│  │  │  ├─ http-throttler.guard.ts
│  │  │  ├─ internal-token.guard.ts
│  │  │  ├─ jwt-auth.guard.ts
│  │  │  ├─ roles.guard.ts
│  │  │  └─ validate-admin.guard.ts
│  │  ├─ middleware
│  │  │  └─ request-id.middleware.ts
│  │  └─ serializers
│  │     └─ user.serializer.ts
│  ├─ config
│  │  ├─ env.config.ts
│  │  ├─ logger.config.ts
│  │  └─ redis.config.ts
│  ├─ infrastructure
│  │  ├─ cloudinary
│  │  │  └─ cloudinary.infra.ts
│  │  ├─ email
│  │  │  └─ email.infra.ts
│  │  ├─ encryption
│  │  │  ├─ encryption.constants.ts
│  │  │  ├─ encryption.module.ts
│  │  │  └─ encryption.service.ts
│  │  ├─ evolution-api
│  │  │  └─ evolution-api.service.ts
│  │  ├─ prisma
│  │  │  ├─ prisma.module.ts
│  │  │  └─ prisma.service.ts
│  │  ├─ queue
│  │  │  ├─ queue.module.ts
│  │  │  └─ redis.connection.ts
│  │  ├─ scripts
│  │  │  └─ migrate-employees.ts
│  │  └─ two-factor
│  │     ├─ two-factor.module.ts
│  │     └─ two-factor.service.ts
│  ├─ jobs
│  │  ├─ cron.module.ts
│  │  └─ cron.service.ts
│  ├─ main.ts
│  ├─ modules
│  │  ├─ admin
│  │  │  └─ users
│  │  │     ├─ dto
│  │  │     │  ├─ birthday-posts.dto.ts
│  │  │     │  ├─ register.dto.ts
│  │  │     │  ├─ update-profile.dto.ts
│  │  │     │  └─ update-user.dto.ts
│  │  │     ├─ enum
│  │  │     │  └─ office.enum.ts
│  │  │     ├─ users.controller.ts
│  │  │     ├─ users.module.ts
│  │  │     └─ users.service.ts
│  │  ├─ alerta-reservas
│  │  │  ├─ alerta-reservas.controller.ts
│  │  │  ├─ alerta-reservas.module.ts
│  │  │  ├─ alerta-reservas.processor.ts
│  │  │  ├─ alerta-reservas.service.ts
│  │  │  └─ dto
│  │  │     └─ alerta-reservas.dto.ts
│  │  ├─ audit
│  │  │  ├─ audit.decorator.ts
│  │  │  ├─ audit.interceptor.ts
│  │  │  ├─ audit.module.ts
│  │  │  ├─ audit.service.ts
│  │  │  └─ audit.writer.service.ts
│  │  ├─ auth
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.module.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ decorator
│  │  │  │  └─ roles.decorator.ts
│  │  │  └─ dto
│  │  │     ├─ 2fa.dto.ts
│  │  │     ├─ accept-invite.dto.ts
│  │  │     ├─ change-temporary-password.ts
│  │  │     ├─ create-user.dto.ts
│  │  │     ├─ forgot-password.ts
│  │  │     └─ login.dto.ts
│  │  ├─ documents
│  │  │  ├─ documents.controller.ts
│  │  │  ├─ documents.module.ts
│  │  │  ├─ documents.service.ts
│  │  │  ├─ dto
│  │  │  │  └─ generate-carta.dto.ts
│  │  │  └─ enums
│  │  │     └─ tipo-documento.enum.ts
│  │  ├─ forms
│  │  │  ├─ dto
│  │  │  │  └─ create-form.dto.ts
│  │  │  ├─ forms.controller.ts
│  │  │  ├─ forms.module.ts
│  │  │  └─ forms.service.ts
│  │  ├─ google
│  │  │  ├─ gmail
│  │  │  │  ├─ gmail.service.ts
│  │  │  │  └─ processors
│  │  │  │     └─ pago-hotel.processor.ts
│  │  │  ├─ google.controller.ts
│  │  │  ├─ google.module.ts
│  │  │  └─ google.service.ts
│  │  ├─ health
│  │  │  ├─ health.controller.ts
│  │  │  ├─ health.module.ts
│  │  │  └─ health.service.ts
│  │  ├─ leaves
│  │  │  ├─ dto
│  │  │  │  ├─ create-leave.dto.ts
│  │  │  │  ├─ leave-query.dto.ts
│  │  │  │  └─ review-leave.dto.ts
│  │  │  ├─ guards
│  │  │  │  └─ leave-leader.guard.ts
│  │  │  ├─ helpers
│  │  │  │  └─ business-days.helper.ts
│  │  │  ├─ leaves.controller.ts
│  │  │  ├─ leaves.module.ts
│  │  │  └─ leaves.service.ts
│  │  ├─ overtime
│  │  │  ├─ dto
│  │  │  │  ├─ create-overtime.dto.ts
│  │  │  │  ├─ overtime-query.dto.ts
│  │  │  │  └─ review-overtime.dto.ts
│  │  │  ├─ overtime-leader.guard..ts
│  │  │  ├─ overtime.controller.ts
│  │  │  ├─ overtime.module.ts
│  │  │  └─ overtime.service.ts
│  │  ├─ pago-total
│  │  │  ├─ dto
│  │  │  │  └─ pago-total.dto.ts
│  │  │  ├─ pago-total-clasificador.service.ts
│  │  │  ├─ pago-total.controller.ts
│  │  │  ├─ pago-total.module.ts
│  │  │  ├─ pago-total.processor.ts
│  │  │  └─ pago-total.service.ts
│  │  ├─ password-vault
│  │  │  ├─ dto
│  │  │  │  ├─ create-category.dto.ts
│  │  │  │  ├─ create-password.dto.ts
│  │  │  │  ├─ create-tag.dto.ts
│  │  │  │  ├─ generate-password.dto.ts
│  │  │  │  ├─ password-response.dto.ts
│  │  │  │  ├─ reveal-password.dto.ts
│  │  │  │  ├─ search-password-vault.dto.ts
│  │  │  │  ├─ share-vault.dto.ts
│  │  │  │  └─ update-password.dto.ts
│  │  │  ├─ password-vault.controller.ts
│  │  │  ├─ password-vault.module.ts
│  │  │  ├─ password-vault.service.ts
│  │  │  └─ vault-dasboard.service.ts
│  │  ├─ points
│  │  │  ├─ dto
│  │  │  │  ├─ approve-point-request.dto.ts
│  │  │  │  ├─ create-reward.dto.ts
│  │  │  │  ├─ reject-point-request.dto.ts
│  │  │  │  └─ request-points.ts
│  │  │  ├─ gateway
│  │  │  │  └─ points.gateway.ts
│  │  │  ├─ points.controller.ts
│  │  │  ├─ points.module.ts
│  │  │  ├─ points.service.ts
│  │  │  └─ services
│  │  │     ├─ point-request.service.ts
│  │  │     ├─ point-transaction.service.ts
│  │  │     ├─ point-wallet.service.ts
│  │  │     └─ reward.service.ts
│  │  └─ websockets
│  │     └─ websockets.module.ts
│  └─ types
│     └─ express.d.ts
├─ test
│  ├─ app.e2e-spec.ts
│  └─ jest-e2e.json
├─ tsconfig.build.json
└─ tsconfig.json

```
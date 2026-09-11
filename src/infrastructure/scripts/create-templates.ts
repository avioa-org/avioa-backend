import 'dotenv/config';
import { Resend } from 'resend';
import { envs } from '../../config/env.config';

const resend = new Resend(envs.RESEND_API_KEY);

async function createTemaplate() {
  const { data, error } = await resend.templates.create({
    name: 'reset-password',
    from: 'Avioa <notificaciones@avioa.cloud>',
    subject: 'Restablece tu contraseña - Avioa',

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Restablecer contraseña</title>
</head>

<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            max-width: 600px;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
          "
        >

          <tr>
            <td align="center" style="padding: 30px;">
              <img
                src="https://portal-avioa.vercel.app/avioa-logo.png"
                alt="Avioa"
                width="180"
              />
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 40px 40px; color: #333333;">

              <h1 style="font-size: 24px;">
                Restablecer contraseña
              </h1>

              <p>
                Hola <strong>{{{USER_NAME}}}</strong>,
              </p>

              <p>
                Recibimos una solicitud para restablecer la contraseña
                de tu cuenta en Avioa.
              </p>

              <p>
                Haz clic en el siguiente botón para crear una nueva
                contraseña:
              </p>

              <div style="text-align: center; padding: 25px 0;">

                <a
                  href="{{{RESET_URL}}}"
                  style="
                    background-color: #2563eb;
                    color: #ffffff;
                    padding: 14px 28px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                    display: inline-block;
                  "
                >
                  Restablecer contraseña
                </a>

              </div>

              <p style="font-size: 14px; color: #666666;">
                Si no solicitaste este cambio, puedes ignorar este correo.
              </p>

              <p style="font-size: 14px; color: #666666;">
                Por seguridad, este enlace tiene una duración limitada.
              </p>

            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                background-color: #f4f4f5;
                padding: 20px;
                color: #888888;
                font-size: 12px;
              "
            >
              © 2026 Avioa
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,

    variables: [
      {
        key: 'USER_NAME',
        type: 'string',
        fallbackValue: 'Usuario',
      },
      {
        key: 'RESET_URL',
        type: 'string',
        fallbackValue: 'https://portal-avioa.vercel.app/login',
      },
    ],
  });

  if (error) {
    console.error(error);
  } else {
    console.log('Template creado:', data);
  }
}

createTemaplate().catch((e) => console.error(e));

// import { authenticate } from '@google-cloud/local-auth';
// import { google } from 'googleapis';
// import 'dotenv/config';

// async function main() {
//   const auth = await authenticate({
//     keyfilePath: './credentials.json',
//     scopes: [
//       'https://www.googleapis.com/auth/gmail.readonly',
//       'https://www.googleapis.com/auth/gmail.modify',
//     ],
//   });

//   // 👇 MUY IMPORTANTE: forzar refresh_token
//   const oauth2Client = auth as any;

//   // Esto fuerza que SIEMPRE te dé refresh_token
//   oauth2Client.setCredentials({
//     access_type: 'offline',
//     prompt: 'consent',
//   });

//   // Hacer una llamada dummy para asegurar tokens
//   const gmail = google.gmail({ version: 'v1', auth });
//   await gmail.users.getProfile({ userId: 'me' });

//   // 🔥 AQUÍ está lo importante
//   const tokens = oauth2Client.credentials;

//   console.log('\n==============================');
//   console.log('REFRESH TOKEN:');
//   console.log(tokens.refresh_token);
//   console.log('==============================\n');

//   if (!tokens.refresh_token) {
//     console.log('⚠️ No se generó refresh_token');
//     console.log('👉 Solución: elimina token.json y vuelve a ejecutar');
//   }
// }

// main().catch(console.error);

// src/certificados/libreoffice.converter.ts
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function convertDocxToPdf(
  docxBuffer: Buffer,
  sofficePath?: string,
): Promise<Buffer> {
  const soffice =
    sofficePath ??
    process.env.SOFFICE_PATH ??
    (process.platform === 'win32'
      ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
      : 'soffice');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lo-convert-'));
  const profileDir = path.join(workDir, 'profile');
  await fs.mkdir(profileDir, { recursive: true });

  const inputPath = path.join(workDir, 'input.docx');
  const outputPath = path.join(workDir, 'input.pdf');

  await fs.writeFile(inputPath, docxBuffer);

  try {
    await runSoffice(soffice, inputPath, workDir, profileDir);
    return await fs.readFile(outputPath);
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runSoffice(
  sofficePath: string,
  inputPath: string,
  outDir: string,
  profileDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const profileUrl = `file:///${profileDir.replace(/\\/g, '/')}`;

    const args = [
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nodefault',
      '--nologo',
      `-env:UserInstallation=${profileUrl}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      inputPath,
    ];

    const child = spawn(sofficePath, args, {
      env: {
        ...process.env,
        PYTHONHOME: '',
        PYTHONPATH: '',
        HOME: profileDir,
        USERPROFILE: profileDir,
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('soffice timeout después de 60s'));
    }, 60_000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(
        new Error(
          `soffice falló (code ${code})\nstdout: ${stdout}\nstderr: ${stderr}`,
        ),
      );
    });
  });
}

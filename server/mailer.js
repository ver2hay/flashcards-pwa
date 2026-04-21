import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || 'no-reply@flashcards.local';

let transporter;

if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE || SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  console.log('[Mail] SMTP transport ->', SMTP_HOST, SMTP_PORT);
} else {
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
  console.log(
    '[Mail] No SMTP_HOST set — using stub JSON transport. Verification codes will be printed to stdout.'
  );
}

export async function sendCode(to, code, purpose) {
  const subject =
    purpose === 'reset'
      ? 'Сброс пароля — код подтверждения'
      : 'Подтверждение e-mail — код регистрации';
  const hint =
    purpose === 'reset'
      ? 'Для смены пароля введите этот код в приложении.'
      : 'Для завершения регистрации введите этот код в приложении.';
  const text = `${hint}\n\nКод: ${code}\n\nКод действителен 15 минут. Если это были не вы — просто проигнорируйте письмо.`;
  const html = `
    <div style="font-family:Nunito,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#46A302">Карточки</h2>
      <p>${hint}</p>
      <p style="font-size:28px;letter-spacing:8px;font-weight:800;background:#F0F9FF;border:2px solid #58CC02;border-radius:12px;padding:16px;text-align:center">${code}</p>
      <p style="color:#777;font-size:13px">Код действителен 15 минут. Если это были не вы — просто проигнорируйте письмо.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
  if (info.message && typeof info.message !== 'string') {
    console.log('[Mail:stub]', { to, purpose, code, preview: info.message.toString?.() });
  } else if (info.message) {
    console.log('[Mail:stub]', { to, purpose, code });
  } else {
    console.log('[Mail] sent', { to, purpose, messageId: info.messageId });
  }
  return info;
}

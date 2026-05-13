const nodemailer = require('nodemailer');

// Configuração centralizada para o Nodemailer
// Em produção, isso usará as chaves SMTP definidas no .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false p/ outras
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Envia um email genérico.
 * Se as variáveis SMTP não estiverem configuradas, no modo dev ele exibe no console.
 */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('\n========================================================');
    console.warn('⚠️  ALERTA: Credenciais SMTP (SMTP_USER/PASS) não encontradas!');
    console.warn(`📩 E-MAIL SIMULADO PARA: ${to}`);
    console.warn(`Assunto: ${subject}`);
    console.warn(`Conteúdo: \n${text || html}`);
    console.warn('========================================================\n');
    return { simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Stellarnet Seguranca" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email enviado: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Falha ao enviar e-mail via Nodemailer:', error);
    throw new Error('Não foi possível enviar o e-mail no momento.');
  }
}

module.exports = {
  sendMail,
};

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, body: str) -> None:
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    try:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to_email], msg.as_string())
    finally:
        server.quit()


def send_email_or_log(to_email: str, subject: str, body: str) -> bool:
    """Отправка письма без падения API: при ошибке пишем в лог и возвращаем False."""
    try:
        send_email(to_email, subject, body)
        return True
    except Exception as exc:
        logger.warning("email_send_failed to=%s err=%s", to_email, exc)
        return False


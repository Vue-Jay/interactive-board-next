"""Email-safe branded HTML. All user-supplied content is escaped before rendering."""
from html import escape


def branded_email(title: str, eyebrow: str, paragraphs: list[str], *,
                  action_url: str = "", action_label: str = "", note: str = "") -> str:
    font = "font-family:Arial,'Segoe UI',sans-serif;"
    body = "".join(
        f'<p style="margin:0 0 16px;color:#344962;font-size:15px;line-height:1.65;">{escape(p).replace(chr(10), "<br>")}</p>'
        for p in paragraphs
    )
    action = ""
    if action_url and action_label:
        url = escape(action_url, quote=True)
        action = (f'<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">'
                  f'<tr><td bgcolor="#245dcc" style="border-radius:9px;"><a href="{url}" '
                  f'style="display:inline-block;padding:15px 23px;{font}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">{escape(action_label)}</a></td></tr></table>')
    callout = (f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;border:1px solid #dbe6f3;border-radius:9px;background:#f3f7fc;">'
               f'<tr><td style="padding:15px;{font}color:#526b86;font-size:13px;line-height:1.55;">{escape(note).replace(chr(10), "<br>")}</td></tr></table>') if note else ""
    return (
        '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        f'<body style="margin:0;padding:0;background:#eef3f9;{font}">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eef3f9"><tr><td align="center" style="padding:32px 12px;">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #d7e2ef;border-radius:16px;overflow:hidden;">'
        '<tr><td bgcolor="#173961" style="padding:25px 29px;border-radius:15px 15px 0 0;">'
        '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#398cf2" style="width:7px;height:44px;border-radius:4px;">&nbsp;</td>'
        f'<td style="padding-left:13px;{font}"><div style="color:#ffffff;font-size:27px;line-height:1.15;font-weight:bold;letter-spacing:.4px;">Lektrus</div>'
        '<div style="color:#b9d7fa;font-size:12px;line-height:1.45;margin-top:5px;">Онлайн-платформа для обучения</div></td></tr></table></td></tr>'
        f'<tr><td style="padding:30px 29px;{font}"><div style="font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#2563be;">{escape(eyebrow)}</div>'
        f'<h1 style="margin:10px 0 22px;color:#172e4c;font-size:26px;line-height:1.25;font-weight:bold;">{escape(title)}</h1>'
        f'{body}{action}{callout}</td></tr>'
        f'<tr><td bgcolor="#f8fafd" style="padding:19px 29px;border-top:1px solid #dfe8f2;border-radius:0 0 15px 15px;{font}color:#647a92;font-size:12px;line-height:1.65;">'
        '<strong style="color:#294665;font-size:13px;">Команда Lektrus</strong><br>Пространство для обучения · <a href="https://lektrus.ru" style="color:#245dcc;text-decoration:underline;">lektrus.ru</a> · '
        '<a href="https://t.me/lektrus" style="color:#245dcc;text-decoration:underline;">Telegram</a></td></tr></table></td></tr></table></body></html>'
    )

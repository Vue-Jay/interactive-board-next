"""Run an actual release APK on Android and check the production HTTPS login path.

Only a reserved invalid email and fake password are sent. No account is created,
no actual credentials are used, and a backend HTTP 401 is the expected result.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


OUT = Path('artifacts/android-login')
OUT.mkdir(parents=True, exist_ok=True)
PACKAGE = 'ru.lektrus.board'


def adb(*args, timeout=25):
    return subprocess.check_output(['adb', *args], timeout=timeout)


def snapshot():
    adb('shell', 'uiautomator', 'dump', '/sdcard/lektrus-login-qa.xml', timeout=35)
    raw = adb('shell', 'cat', '/sdcard/lektrus-login-qa.xml')
    return list(ET.fromstring(raw.strip()).iter('node'))


def wait_for(find, description, seconds=70):
    end = time.monotonic() + seconds
    last = None
    while time.monotonic() < end:
        try:
            value = find(snapshot())
            if value:
                return value
        except (subprocess.SubprocessError, ET.ParseError) as exc:
            last = type(exc).__name__
        time.sleep(1)
    raise AssertionError(f'{description}; last diagnostic: {last}')


def label(node):
    return (node.get('text', '') + ' ' + node.get('content-desc', '')).strip()


def fields(nodes):
    items = [n for n in nodes if n.get('class') == 'android.widget.EditText']
    return items if len(items) >= 2 else None


def tap(node):
    coords = list(map(int, re.findall(r'\d+', node.attrib['bounds'])))
    adb('shell', 'input', 'tap', str((coords[0] + coords[2]) // 2), str((coords[1] + coords[3]) // 2))


def screenshot(name):
    (OUT / name).write_bytes(adb('exec-out', 'screencap', '-p'))


try:
    adb('install', '-r', 'Lektrus-Android.apk', timeout=120)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/ru.lektrus.board.MainActivity')
    form = wait_for(fields, 'Release APK did not render the login form')
    screenshot('01-login.png')
    tap(form[0])
    adb('shell', 'input', 'text', 'android-release-qa@example.invalid')
    adb('shell', 'input', 'keyevent', '4')
    form = wait_for(fields, 'Password field unavailable after email entry')
    tap(form[1])
    adb('shell', 'input', 'text', 'NotARealPassword123')
    adb('shell', 'input', 'keyevent', '4')
    submit = wait_for(lambda nodes: next((n for n in nodes if label(n) == 'Войти' and n.get('enabled') == 'true'), None), 'Login submit unavailable')
    tap(submit)
    def server_reply(nodes):
        for node in nodes:
            value = label(node)
            if 'Неверный email или пароль' in value:
                return value
            if any(part in value for part in ('не ответил на запрос Android', 'TLS', '(DNS)', 'Время ожидания собственного сервера', 'Не удалось установить соединение')):
                raise AssertionError(f'Android login transport failed: {value}')
        return None
    reply = wait_for(server_reply, 'Expected production HTTP 401 response, not a network timeout', seconds=60)
    screenshot('02-server-rejected-invalid-login.png')
    print('Signed Android APK: production HTTPS login returned the expected invalid-credentials response.')
finally:
    screenshot('03-final-state.png')

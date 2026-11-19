"""Run an actual release APK on Android and check the production HTTPS login path.

Only a reserved invalid email and fake password are sent. No account is created,
no actual credentials are used, and a backend HTTP 401 is the expected result.
"""
import re
import struct
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
            # ElementTree nodes without children are falsy even if they are
            # the exact enabled Android button we are waiting for.
            if value is not None:
                return value
        except (subprocess.SubprocessError, ET.ParseError) as exc:
            last = type(exc).__name__
        time.sleep(1)
    raise AssertionError(f'{description}; last diagnostic: {last}')


def label(node):
    text = node.get('text', '').strip()
    description = node.get('content-desc', '').strip()
    return text if text == description else (text + ' ' + description).strip()


def fields(nodes):
    items = [n for n in nodes if n.get('class') == 'android.widget.EditText']
    return items if len(items) >= 2 else None


def tap(node):
    coords = list(map(int, re.findall(r'\d+', node.attrib['bounds'])))
    adb('shell', 'input', 'tap', str((coords[0] + coords[2]) // 2), str((coords[1] + coords[3]) // 2))


def screenshot(name):
    data=adb('exec-out', 'screencap', '-p')
    assert data.startswith(b'\x89PNG\r\n\x1a\n'), 'Native capture is not a PNG'
    (OUT / name).write_bytes(data)
    return struct.unpack('>II',data[16:24])


def find_label(nodes, text):
    return next((n for n in nodes if label(n)==text and n.get('enabled')=='true'),None)


def tap_label(text):
    tap(wait_for(lambda nodes:find_label(nodes,text), f'Native control unavailable: {text}'))


def assert_portrait(name):
    width,height=screenshot(name)
    assert height>width, f'Auth unexpectedly rotated: {width}x{height}'


def collect_diagnostics():
    # A failed TLS handshake must expose the reason in the isolated runner.
    try:
        log=adb('logcat','-d','-t','8000',timeout=35).decode(errors='replace')
        terms=('SSLHandshakeException','SSLPeerUnverifiedException','CertPathValidatorException','Trust anchor','CertificateException','CertPath','CapacitorHttp')
        (OUT/'tls-device-diagnostics.txt').write_text('\n'.join(line for line in log.splitlines() if any(t in line for t in terms)))
        (OUT/'device-version.txt').write_bytes(adb('shell','getprop','ro.build.version.release')+adb('shell','getprop','ro.build.version.sdk')+adb('shell','date','-u'))
    except (subprocess.SubprocessError, OSError) as exc:
        print(f'Diagnostic capture unavailable: {exc}',flush=True)


try:
    adb('install', '-r', 'Lektrus-Android.apk', timeout=120)
    # Three independent cold launches with the emulator held sideways.
    # Authentication must always request a portrait activity, including after
    # leaving registration/recovery. Do not clear or alter the installed APK.
    adb('shell','settings','put','system','accelerometer_rotation','0')
    adb('shell','settings','put','system','user_rotation','1')
    for round_number in range(1,4):
        adb('shell','am','force-stop',PACKAGE)
        adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/ru.lektrus.board.MainActivity')
        form = wait_for(fields, f'Release APK did not render login, round {round_number}')
        assert_portrait(f'01-login-round-{round_number}.png')
        if round_number==1:
            tap_label('Регистрация')
            wait_for(lambda nodes: True if all(any(text in label(n) for n in nodes) for text in ('Я хочу преподавать','Я хочу учиться')) else None, 'Registration role choices unavailable in native app')
            assert_portrait('01-registration.png')
            tap_label('Вход')
            wait_for(fields,'Login form did not return from registration')
        elif round_number==2:
            tap_label('Забыли пароль?')
            wait_for(lambda nodes:True if any('Восстановление пароля' in label(n) for n in nodes) else None,'Password recovery unavailable in native app')
            assert_portrait('01-recovery.png')
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
    collect_diagnostics()

"""Test the actual signed APK on Android; only release runs submit a live login.

Ordinary PRs verify native auth UI without sending credentials to production.
Release runs use one reserved invalid address and require real HTTP 401.
"""
import os
import hashlib
import re
import struct
import subprocess
import time
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import Request, urlopen


OUT = Path('artifacts/android-login')
OUT.mkdir(parents=True, exist_ok=True)
PACKAGE = 'ru.lektrus.board'
MODE = os.environ.get('LEKTRUS_ANDROID_LOGIN_MODE', 'production')
assert MODE in ('production', 'ui'), 'Unknown Android login test mode'
# The workflow serializes all production runs and their emulator matrix.
# Keep consecutive submissions at least 80 seconds apart (8 attempts/600s).
last_submit = None
messenger_dialogs_closed = 0


def adb(*args, timeout=25):
    return subprocess.check_output(['adb', *args], timeout=timeout)


def snapshot():
    adb('shell', 'uiautomator', 'dump', '/sdcard/lektrus-login-qa.xml', timeout=35)
    raw = adb('shell', 'cat', '/sdcard/lektrus-login-qa.xml')
    return list(ET.fromstring(raw.strip()).iter('node'))


def isolate_old_emulator_messenger():
    # API 24's stock Google APIs image can crash its preinstalled SMS app
    # during boot. The observed system crash dialog covered a fully rendered
    # Lektrus login in two consecutive runs. Only disable those unrelated
    # packages on this disposable emulator, not on users' devices.
    if adb('shell', 'getprop', 'ro.build.version.sdk').strip() != b'24':
        return
    installed = set(adb('shell', 'pm', 'list', 'packages').decode().splitlines())
    for package in ('com.google.android.apps.messaging', 'com.android.mms'):
        if 'package:' + package not in installed:
            continue
        adb('shell', 'am', 'force-stop', package)
        result = adb('shell', 'pm', 'disable-user', '--user', '0', package).decode().strip()
        print(f'Isolating unrelated emulator SMS app: {result}', flush=True)


def close_known_messenger_dialog(nodes):
    # The boot-time dialog may already be visible when the package is
    # disabled. Dismiss ONLY the exact third-party Android crash dialog.
    # Never dismiss a Lektrus crash, ANR, permission prompt or generic error.
    global messenger_dialogs_closed
    if not any(n.get('package') == 'android' and label(n) == 'Messenger has stopped' for n in nodes):
        return False
    close = next((n for n in nodes if n.get('package') == 'android'
                  and label(n) == 'Close app' and n.get('enabled') == 'true'), None)
    if close is None:
        return False
    if messenger_dialogs_closed >= 3:
        raise AssertionError('Unrelated Messenger crash repeatedly obscures the emulator')
    messenger_dialogs_closed += 1
    print('Dismissed the exact unrelated Messenger crash dialog; continuing real Lektrus assertions.', flush=True)
    screenshot(f'00-messenger-dialog-{messenger_dialogs_closed}.png')
    tap(close)
    return True


def wait_for(find, description, seconds=70):
    end = time.monotonic() + seconds
    last = None
    while time.monotonic() < end:
        try:
            nodes = snapshot()
            if close_known_messenger_dialog(nodes):
                continue
            value = find(nodes)
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
        # Include fatal/runtime and WebView diagnostics, not the unrestricted
        # device log. No production credentials are used by this test.
        runtime = ('FATAL EXCEPTION', 'AndroidRuntime', 'chromium', 'ANR in', 'am_crash')
        (OUT/'runtime-device-diagnostics.txt').write_text('\n'.join(line for line in log.splitlines() if any(t in line for t in runtime)))
        (OUT/'device-version.txt').write_bytes(adb('shell','getprop','ro.build.version.release')+adb('shell','getprop','ro.build.version.sdk')+adb('shell','date','-u'))
    except (subprocess.SubprocessError, OSError) as exc:
        print(f'Diagnostic capture unavailable: {exc}',flush=True)


def package_identity():
    """System package identity and original install date survive install-over."""
    raw = adb('shell', 'dumpsys', 'package', PACKAGE).decode(errors='replace')
    fields = {}
    for key, pattern in {'versionCode': r'\bversionCode=(\d+)', 'versionName': r'\bversionName=(\S+)',
                         'uid': r'\b(?:userId|appId)=(\d+)', 'firstInstallTime': r'\bfirstInstallTime=([^\r\n]+)',
                         'dataDir': r'\bdataDir=(\S+)'}.items():
        match = re.search(pattern, raw)
        assert match, f'Package identity field missing: {key}'
        fields[key] = match[1].strip()
    return fields


def install_after_skipped_releases():
    # One emulator (Android 11/API 30) additionally proves a real install-over
    # from a published older signed APK. No extra production login is made.
    if adb('shell', 'getprop', 'ro.build.version.sdk').strip() != b'30':
        adb('install', '-r', 'Lektrus-Android.apk', timeout=120)
        return
    old_url = 'https://github.com/Vue-Jay/interactive-board-next/releases/download/android-v1.0.4691/Lektrus-Android.apk'
    old_digest = 'b80911d1c9acee15c0ae3c8eec4e22bbf119d20deb3cac66b20d0aeecab4f5b1'
    with tempfile.TemporaryDirectory() as directory:
        existing = Path(directory) / 'previous.apk'
        with urlopen(Request(old_url, headers={'User-Agent': 'Lektrus-Android-Upgrade-QA'}), timeout=30) as response:
            raw = response.read(20_000_001)
        assert len(raw) == 14_730_031 and hashlib.sha256(raw).hexdigest() == old_digest, 'Previous signed release bytes changed'
        existing.write_bytes(raw)
        adb('install', '-r', str(existing), timeout=120)
        before = package_identity()
        assert before['versionName'] == '1.0.4691', before
        # No uninstall or data clearing: Android validates the same signer and
        # permits only a newer versionCode for the package already installed.
        adb('install', '-r', 'Lektrus-Android.apk', timeout=120)
        after = package_identity()
        assert int(after['versionCode']) > int(before['versionCode']), (before, after)
        for key in ('uid', 'firstInstallTime', 'dataDir'):
            assert before[key] == after[key], f'Install-over changed {key}: {before[key]} -> {after[key]}'
        (OUT / 'install-over-evidence.txt').write_text(f'Before: {before}\nAfter: {after}\n')
        print(f'Install-over verified directly from 1.0.4691 to {after["versionName"]}, without deleting app data.', flush=True)


try:
    isolate_old_emulator_messenger()
    install_after_skipped_releases()
    adb('shell', 'svc', 'power', 'stayon', 'true')
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
    if MODE == 'ui':
        screenshot('02-auth-form-completed-no-production-request.png')
        print('Signed Android APK: native auth UI verified without a production login.')
    else:
        def server_reply(nodes):
            for node in nodes:
                value = label(node)
                if 'Неверный email или пароль' in value:
                    return '401'
                if 'Слишком много попыток' in value:
                    return '429'
                if any(part in value for part in ('не ответил на запрос Android', 'TLS', '(DNS)', 'Время ожидания собственного сервера', 'Не удалось установить соединение')):
                    raise AssertionError(f'Android login transport failed: {value}')
            return None
        last_submit = time.monotonic()
        tap(submit)
        reply = wait_for(server_reply, 'Expected production HTTP 401 response, not a network timeout', seconds=60)
        if reply == '429':
            # Keep the same reserved address; respect the real 10-minute limit.
            # An unrelated production request may have used the remaining allowance.
            screenshot('02-server-rate-limited.png')
            print('Production returned HTTP 429; respecting the 600-second limit before one same-address retry.',flush=True)
            time.sleep(610)
            # Keep the same form and account identity during the cooldown.
            submit = wait_for(lambda nodes: next((n for n in nodes if label(n) == 'Войти' and n.get('enabled') == 'true'), None), 'Login submit unavailable after cooldown')
            last_submit = time.monotonic()
            tap(submit)
            # The previous 429 message can remain visible during the new request.
            # Require fresh 401 evidence; never treat the still-visible old error as a successful retry.
            reply = wait_for(lambda nodes: '401' if server_reply(nodes) == '401' else None,
                             'Expected production HTTP 401 after rate-limit cooldown; no further retries', seconds=60)
        assert reply == '401', 'Production login is still rate limited; no further retries are permitted.'
        screenshot('02-server-rejected-invalid-login.png')
        print('Signed Android APK: production HTTPS login returned the expected invalid-credentials response.')
finally:
    try:
        screenshot('03-final-state.png')
        collect_diagnostics()
    finally:
        if last_submit is not None:
            cooldown = max(0, 80 - (time.monotonic() - last_submit))
            if cooldown:
                print(f'Keeping the production test allowance: {cooldown:.0f}s before the next emulator.', flush=True)
                time.sleep(cooldown)

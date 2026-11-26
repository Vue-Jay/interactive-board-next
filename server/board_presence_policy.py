import colorsys
import time

BOARD_IDLE_SECONDS = 600
PALETTE = ("#3056c8","#087f69","#b23a56","#8052ac","#a65b13","#166b99","#71801b","#a13487","#096d79","#aa4426","#5744a8","#277247","#975321","#3c669c","#873b63","#536c22","#426b70","#8d3e36","#675197","#79591d","#28758d","#a34270","#4a6955","#6a5280")

def participant_color(user_id, active):
    for meta in active:
        if meta.get("user_id") == user_id and meta.get("color"):
            return meta["color"]
    used = {meta.get("color") for meta in active}
    start = 0
    for char in user_id:
        start = (start * 31 + ord(char)) & 0xffffffff
    for i in range(len(PALETTE)):
        color = PALETTE[(start + i) % len(PALETTE)]
        if color not in used:
            return color
    for i in range(360):
        rgb = colorsys.hsv_to_rgb(((start % 360 + i * 137) % 360) / 360, .75, .48)
        color = "#" + "".join(f"{round(channel*255):02x}" for channel in rgb)
        if color not in used:
            return color
    return PALETTE[start % len(PALETTE)]

def valid_idle_age(age):
    return type(age) is int and 0 <= age <= BOARD_IDLE_SECONDS * 1000

def idle_deadline(age, now=None):
    if not valid_idle_age(age):
        raise ValueError("invalid idle age")
    return (time.monotonic() if now is None else now) + BOARD_IDLE_SECONDS - age / 1000

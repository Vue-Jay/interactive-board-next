import colorsys
import time

BOARD_IDLE_SECONDS = 600
TEACHER_COLOR = "#3056c8"
# Only the board owner uses Lektrus blue. These are session colors, not account colors.
STUDENT_PALETTE = ("#087f69","#b23a56","#8052ac","#a65b13","#166b99","#71801b","#a13487","#096d79","#aa4426","#5744a8","#277247","#975321","#3c669c","#873b63","#536c22","#426b70","#8d3e36","#675197","#79591d","#28758d","#a34270","#4a6955","#6a5280")

def participant_color(user_id, active, *, role="editor", sequence=0):
    """Choose a seat color from this board's current session, never from user ID."""
    if role == "owner":
        return TEACHER_COLOR
    for meta in active:
        if meta.get("user_id") == user_id and meta.get("role") != "owner" and meta.get("color") != TEACHER_COLOR:
            if meta.get("color"):
                return meta["color"]
    used = {TEACHER_COLOR, *(meta.get("color") for meta in active)}
    for offset in range(len(STUDENT_PALETTE)):
        color = STUDENT_PALETTE[(sequence + offset) % len(STUDENT_PALETTE)]
        if color not in used:
            return color
    # More participants than the curated palette: choose distinct generated colors.
    for offset in range(1000):
        rgb = colorsys.hsv_to_rgb(((sequence * 137 + offset * 79) % 360) / 360, .72, .52)
        color = "#" + "".join(f"{round(channel*255):02x}" for channel in rgb)
        if color not in used:
            return color
    raise RuntimeError("Board participant color palette exhausted")

def valid_idle_age(age):
    return type(age) is int and 0 <= age <= BOARD_IDLE_SECONDS * 1000

def idle_deadline(age, now=None):
    if not valid_idle_age(age):
        raise ValueError("invalid idle age")
    return (time.monotonic() if now is None else now) + BOARD_IDLE_SECONDS - age / 1000

def background_deadline(background, age, now=None):
    """Foreground is unbounded; a hidden board keeps its original deadline."""
    if type(background) is not bool or not valid_idle_age(age) or (not background and age != 0):
        raise ValueError("invalid background lease")
    return idle_deadline(age, now) if background else None

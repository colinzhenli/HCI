#!/usr/bin/env python3
import cv2
import json
import os

# --------- CONFIG ---------
IMAGE_PATH = "capture-0006.png"        # <-- change to your image
OUTPUT_BASENAME = "capture-0006_tag"   # save prefix
DOT_RADIUS = 10
DOT_COLOR = (0, 255, 0)  # green (BGR)
# --------------------------

points = []

img = cv2.imread(IMAGE_PATH)
if img is None:
    raise RuntimeError(f"Could not load image: {IMAGE_PATH}")

orig = img.copy()
win_name = "Click tag corners (L-click add, R-click undo, s=save, r=reset, q=quit)"


def redraw():
    """Redraw dots only (no numbers)."""
    global img
    img = orig.copy()
    for (x, y) in points:
        cv2.circle(img, (x, y), DOT_RADIUS, DOT_COLOR, -1)


def mouse_cb(event, x, y, flags, param):
    global points
    if event == cv2.EVENT_LBUTTONDOWN:
        points.append((x, y))
        redraw()

    elif event == cv2.EVENT_RBUTTONDOWN:
        if points:
            points.pop()
            redraw()


cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
cv2.setMouseCallback(win_name, mouse_cb)
redraw()

print("Instructions:")
print("  - Left-click: add point")
print("  - Right-click: undo last point")
print("  - 's': save annotated image and coordinates")
print("  - 'r': reset")
print("  - 'q' or ESC: quit")

while True:
    cv2.imshow(win_name, img)
    key = cv2.waitKey(20) & 0xFF

    if key in (27, ord('q'), ord('Q')):
        print("Quit without saving.")
        break

    elif key in (ord('r'), ord('R')):
        points = []
        redraw()
        print("Reset all points.")

    elif key in (ord('s'), ord('S')):
        if not points:
            print("No points to save!")
            continue

        # Output filenames
        img_out = f"{OUTPUT_BASENAME}_annotated.png"
        json_out = f"{OUTPUT_BASENAME}_points.json"

        # Save annotated image
        cv2.imwrite(img_out, img)

        # Save point coordinates
        with open(json_out, "w") as f:
            json.dump({"points": points}, f, indent=2)

        print("\n=== SAVED ===")
        print("Annotated image:", os.path.abspath(img_out))
        print("Points JSON   :", os.path.abspath(json_out))
        print("===============\n")

cv2.destroyAllWindows()

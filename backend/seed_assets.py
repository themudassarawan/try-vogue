from pathlib import Path
import numpy as np
import cv2

GARMENTS_DIR = Path("storage/garments")
GARMENTS_DIR.mkdir(parents=True, exist_ok=True)


def save_rgba(filename: str, canvas: np.ndarray) -> None:
    out_path = GARMENTS_DIR / filename
    cv2.imwrite(str(out_path), canvas)
    print(f"Generated {out_path}")


def make_kurta(filename: str, bgr: tuple[int, int, int], trim_bgr: tuple[int, int, int]) -> None:
    h, w = 800, 600
    img = np.zeros((h, w, 4), dtype=np.uint8)
    # Torso & long knee-length body
    pts = np.array([[180, 70], [420, 70], [440, 740], [160, 740]], np.int32)
    cv2.fillPoly(img, [pts], (*bgr, 245))
    # Left & right sleeves
    l_sleeve = np.array([[180, 70], [60, 410], [125, 435], [195, 190]], np.int32)
    r_sleeve = np.array([[420, 70], [540, 410], [475, 435], [405, 190]], np.int32)
    cv2.fillPoly(img, [l_sleeve], (*bgr, 245))
    cv2.fillPoly(img, [r_sleeve], (*bgr, 245))
    # Mandarin collar & placket embroidery
    cv2.rectangle(img, (286, 70), (314, 290), (*trim_bgr, 255), -1)
    cv2.ellipse(img, (300, 72), (52, 22), 0, 0, 180, (*trim_bgr, 255), 8)
    save_rgba(filename, img)


def make_shirt_or_jacket(filename: str, bgr: tuple[int, int, int], is_jacket: bool = False) -> None:
    h, w = 640, 600
    img = np.zeros((h, w, 4), dtype=np.uint8)
    pts = np.array([[175, 65], [425, 65], [435, 575], [165, 575]], np.int32)
    cv2.fillPoly(img, [pts], (*bgr, 245))
    l_sleeve = np.array([[175, 65], [55, 395], [120, 420], [190, 180]], np.int32)
    r_sleeve = np.array([[425, 65], [545, 395], [480, 420], [410, 180]], np.int32)
    cv2.fillPoly(img, [l_sleeve], (*bgr, 245))
    cv2.fillPoly(img, [r_sleeve], (*bgr, 245))
    if is_jacket:
        # Center lapel V-opening
        lapel = np.array([[260, 65], [340, 65], [300, 260]], np.int32)
        cv2.fillPoly(img, [lapel], (0, 0, 0, 0))
    else:
        # Collar & button line
        cv2.line(img, (300, 75), (300, 565), (220, 220, 220, 255), 3)
    save_rgba(filename, img)


def make_tie(filename: str, bgr: tuple[int, int, int]) -> None:
    h, w = 480, 180
    img = np.zeros((h, w, 4), dtype=np.uint8)
    knot = np.array([[72, 15], [108, 15], [100, 55], [80, 55]], np.int32)
    blade = np.array([[80, 55], [100, 55], [122, 410], [90, 455], [58, 410]], np.int32)
    cv2.fillPoly(img, [knot], (*bgr, 250))
    cv2.fillPoly(img, [blade], (*bgr, 245))
    save_rgba(filename, img)


def make_shawl(filename: str, bgr: tuple[int, int, int], border_bgr: tuple[int, int, int]) -> None:
    h, w = 720, 360
    img = np.zeros((h, w, 4), dtype=np.uint8)
    drape = np.array([[70, 30], [230, 30], [310, 680], [110, 680]], np.int32)
    cv2.fillPoly(img, [drape], (*bgr, 220))
    cv2.polylines(img, [drape], True, (*border_bgr, 255), 10)
    save_rgba(filename, img)


if __name__ == "__main__":
    make_kurta("kurta_01.png", bgr=(45, 78, 34), trim_bgr=(95, 175, 212))     # Olive Green Kurta
    make_kurta("kurta_02.png", bgr=(88, 42, 24), trim_bgr=(215, 215, 215))   # Midnight Navy Kurta
    make_shirt_or_jacket("shirt_01.png", bgr=(242, 232, 218), is_jacket=False) # Sky Oxford Shirt
    make_shirt_or_jacket("jacket_01.png", bgr=(48, 52, 62), is_jacket=True)    # Charcoal Blazer
    make_tie("tie_01.png", bgr=(38, 32, 138))                                # Crimson Silk Tie
    make_shawl("shawl_01.png", bgr=(58, 72, 128), border_bgr=(85, 168, 218)) # Terracotta Pashmina Shawl
    print("All sample PNG garment assets generated successfully!")
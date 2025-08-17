# /// script
# dependencies = [
#   "pillow",
# ]
# ///

import os
from pathlib import Path

from PIL import Image


def is_black_tile(image_path):
    try:
        with Image.open(image_path) as img:
            gray = img.convert("L")
            pixels = list(gray.getdata())
            # Check if ALL pixels are exactly 0 (completely black)
            return all(p == 0 for p in pixels)
    except Exception:
        return True


def cleanup_challenge_tiles(challenge_dir) -> None:
    challenge_name = Path(challenge_dir).name
    removed_count = 0

    for filename in os.listdir(challenge_dir):
        if filename.startswith("tile_") and filename.endswith(".jpeg"):
            tile_path = os.path.join(challenge_dir, filename)
            if is_black_tile(tile_path):
                Path(tile_path).unlink()
                removed_count += 1

    if removed_count > 0:
        print(f"{challenge_name}: Removed {removed_count} black tiles")
    else:
        print(f"{challenge_name}: No black tiles found")


def main() -> None:
    source_dir = Path("source_img")

    # Process easy challenges
    print("Cleaning up EASY challenges...")
    for challenge_dir in sorted((source_dir / "easy").iterdir()):
        if challenge_dir.is_dir():
            cleanup_challenge_tiles(challenge_dir)

    # Process hard challenges
    print("\nCleaning up HARD challenges...")
    for challenge_dir in sorted((source_dir / "hard").iterdir()):
        if challenge_dir.is_dir():
            cleanup_challenge_tiles(challenge_dir)

    print("\nCleanup complete!")


if __name__ == "__main__":
    main()

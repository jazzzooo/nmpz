# /// script
# dependencies = [
#   "pillow",
# ]
# ///

import json
import math
import os
import pathlib
import subprocess
import sys

from PIL import Image

# Handle Pillow version compatibility
try:
    ANTIALIAS = Image.ANTIALIAS
except AttributeError:
    ANTIALIAS = Image.LANCZOS


def reconstruct_panorama(tiles_dir):
    """Reconstruct equirectangular panorama from Google Street View tiles."""
    print("Reconstructing panorama...")

    # Find zoom level 5 tiles
    tiles = {}
    for filename in os.listdir(tiles_dir):
        if filename.startswith("tile_") and filename.endswith(".jpeg"):
            parts = filename.replace(".jpeg", "").split("_")
            if len(parts) == 4:
                x, y, z = int(parts[1]), int(parts[2]), int(parts[3])
                if z == 5:
                    tiles[x, y] = filename

    if not tiles:
        msg = "No zoom level 5 tiles found!"
        raise ValueError(msg)

    max_x = max(x for x, y in tiles)
    max_y = max(y for x, y in tiles)

    # Create 2:1 aspect ratio panorama with uniform 512px grid
    width = (max_x + 1) * 512
    height = (max_y + 1) * 512
    panorama = Image.new("RGB", (width, height), (0, 0, 0))

    # Stitch tiles
    for (x, y), filename in tiles.items():
        with Image.open(os.path.join(tiles_dir, filename)) as tile:
            if tile.size != (512, 512):
                tile = tile.resize((512, 512), ANTIALIAS)
            panorama.paste(tile, (x * 512, y * 512))

    print(f"Panorama reconstructed: {width}x{height}")
    return panorama, width, height


def generate_cube_faces(panorama, width, height, cube_size, output_dir):
    """Generate cube faces using nona."""
    print("Generating cube faces...")

    # Save temporary panorama with absolute path (PNG to avoid compression)
    temp_pano = pathlib.Path(os.path.join(output_dir, "temp_panorama.png")).resolve()
    panorama.save(temp_pano, "PNG")

    # Create PTO file (simplified but correct format)
    pto_content = f"""p E0 R0 f0 h{cube_size} w{cube_size} n"TIFF_m" u0 v90
m g1 i0 m2 p0.00784314
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p0 y0
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p0 y180
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p-90 y0
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p90 y0
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p0 y90
i a0 b0 c0 d0 e0 f4 h{height} w{width} n"{temp_pano}" r0 v360 p0 y-90
v
*"""

    pto_file = os.path.join(output_dir, "cubic.pto")
    with open(pto_file, "w") as f:
        f.write(pto_content)

    # Run nona
    face_prefix = os.path.join(output_dir, "face")
    try:
        subprocess.check_call(["nona", "-d", "-o", face_prefix, pto_file])
    except subprocess.CalledProcessError as e:
        msg = f"nona failed to generate cube faces: {e}"
        raise RuntimeError(msg)

    # Verify all faces were created and convert RGBA to RGB
    face_files = [f"face000{i}.tif" for i in range(6)]
    for face_file in face_files:
        face_path = os.path.join(output_dir, face_file)
        if not pathlib.Path(face_path).exists():
            msg = f"Cube face not generated: {face_file}"
            raise RuntimeError(msg)

        # Convert RGBA to RGB (nona creates RGBA unnecessarily for full panoramas)
        face = Image.open(face_path)
        if face.mode == "RGBA":
            face = face.convert("RGB")
            face.save(face_path)

    return face_files


def generate_tiles(face_files, output_dir, cube_size, levels, tile_size=512) -> None:
    """Generate multi-resolution tile pyramid."""
    print("Generating tiles...")

    face_letters = ["f", "b", "u", "d", "l", "r"]

    for face_idx, face_file in enumerate(face_files):
        face_path = os.path.join(output_dir, face_file)
        if not pathlib.Path(face_path).exists():
            continue

        face = Image.open(face_path)
        size = cube_size

        for level in range(levels, 0, -1):
            level_dir = os.path.join(output_dir, str(level))
            os.makedirs(level_dir, exist_ok=True)

            # Resize face for this level (except at highest level)
            if level < levels:
                face = face.resize([size, size], ANTIALIAS)

            # Generate tiles for this level
            tiles_per_side = math.ceil(float(size) / tile_size)

            for i in range(tiles_per_side):
                for j in range(tiles_per_side):
                    left = j * tile_size
                    upper = i * tile_size
                    right = min(left + tile_size, size)
                    lower = min(upper + tile_size, size)

                    tile = face.crop([left, upper, right, lower])

                    # Save tile (faces are already RGB) with higher quality
                    filename = f"{face_letters[face_idx]}{i}_{j}.avif"
                    tile.save(os.path.join(level_dir, filename), "AVIF", quality=80)

            size = int(size / 2)


def create_config(output_dir, levels, cube_size, tile_size=512) -> None:
    """Create Pannellum config.json."""
    config = {
        "hfov": 100.0,
        "type": "multires",
        "multiRes": {
            "path": "/%l/%s%y_%x",
            "extension": "avif",
            "tileResolution": tile_size,
            "maxLevel": levels,
            "cubeResolution": cube_size,
        },
    }

    with open(os.path.join(output_dir, "config.json"), "w") as f:
        json.dump(config, f, indent=2)


def cleanup(output_dir, face_files) -> None:
    """Remove temporary files."""
    for file in ["cubic.pto", "temp_panorama.png", *face_files]:
        path = os.path.join(output_dir, file)
        if pathlib.Path(path).exists():
            pathlib.Path(path).unlink()


def convert_google_to_pannellum(tiles_dir, output_dir) -> None:
    """Complete conversion pipeline."""
    print(f"Converting {tiles_dir} → {output_dir}")

    os.makedirs(output_dir, exist_ok=True)

    # Step 1: Reconstruct panorama
    panorama, width, height = reconstruct_panorama(tiles_dir)

    # Step 2: Calculate cube size (exact generate.py formula)
    cube_size = 8 * int(width / math.pi / 8)
    if cube_size <= 0:
        msg = f"Invalid cube size: {cube_size}"
        raise ValueError(msg)

    # Calculate levels once
    levels = math.ceil(math.log2(float(cube_size) / 512)) + 1
    if int(cube_size / 2 ** (levels - 2)) == 512:
        levels -= 1

    print(f"Cube size: {cube_size}, Levels: {levels}")

    # Step 3: Generate cube faces
    face_files = generate_cube_faces(panorama, width, height, cube_size, output_dir)

    # Step 4: Generate multi-res tiles
    generate_tiles(face_files, output_dir, cube_size, levels)

    # Step 5: Create config
    create_config(output_dir, levels, cube_size)

    # Step 6: Cleanup
    cleanup(output_dir, face_files)

    print(f"✅ Complete! {levels} levels, cube size {cube_size}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: uv run google_to_pannellum.py <tiles_dir> <output_dir>")
        sys.exit(1)

    convert_google_to_pannellum(sys.argv[1], sys.argv[2])

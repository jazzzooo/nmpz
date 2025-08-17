# /// script
# dependencies = [
#   "httpx",
#   "tqdm",
# ]
# ///

import asyncio
import json
from pathlib import Path

import httpx
from tqdm.asyncio import tqdm

ZOOM_RANGES = {0: (1, 1), 1: (2, 1), 2: (4, 2), 3: (8, 4), 4: (16, 8), 5: (32, 16)}


async def download_tile(client, panoid, x, y, zoom, filepath) -> bool:
    if filepath.exists():
        return False

    url = f"https://streetviewpixels-pa.googleapis.com/v1/tile?panoid={panoid}&x={x}&y={y}&zoom={zoom}"
    try:
        response = await client.get(url)
        if response.status_code == 200:
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_bytes(response.content)
            return True
    except:
        pass
    return False


async def download_challenge(client, difficulty, challenge) -> None:
    name, panoid = challenge["name"], challenge["pano"]
    challenge_dir = Path("source_img") / difficulty / name

    tasks = []
    for zoom in range(6):
        x_max, y_max = ZOOM_RANGES[zoom]
        for x in range(x_max):
            for y in range(y_max):
                filepath = challenge_dir / f"tile_{x}_{y}_{zoom}.jpeg"
                tasks.append(download_tile(client, panoid, x, y, zoom, filepath))

    downloaded = 0
    batch_size = 50
    with tqdm(total=len(tasks), desc=f"{difficulty}/{name}") as pbar:
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i : i + batch_size]
            results = await asyncio.gather(*batch)
            downloaded += sum(results)
            pbar.update(len(batch))

    print(f"{difficulty}/{name}: {downloaded} tiles")


async def main() -> None:
    with open("solutions.json") as f:
        solutions = json.load(f)

    Path("source_img").mkdir(exist_ok=True)

    async with httpx.AsyncClient(timeout=30.0) as client:
        for difficulty in ["easy", "hard"]:
            for challenge in solutions[difficulty]:
                await download_challenge(client, difficulty, challenge)

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())

"""Validate the editable catalog and generate the static site."""
import csv
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parent
FIELDS = {"ID", "AG_No", "Title", "AG Chord", "Drum", "Key", "Capo",
          "BPM", "Artists", "Remark", "Chord", "Youtube_URL"}


def youtube_id(link):
    url = urlsplit(link)
    host = url.hostname
    if url.scheme in {"http", "https"}:
        if host == "youtu.be":
            return url.path.strip("/")
        if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"}:
            if url.path == "/watch":
                return parse_qs(url.query).get("v", [""])[0]
            match = re.fullmatch(r"/(?:shorts|embed|live)/([\w-]+)/?", url.path)
            if match:
                return match[1]
    return ""


def load_tracks():
    raw = (ROOT / "data/songs.csv").read_bytes()
    try:
        source = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        source = raw.decode("cp950")
    import io
    reader = csv.DictReader(io.StringIO(source, newline=""))
    aliases = {"Category": "AG Chord", "Player": "Artists"}
    names = reader.fieldnames or []
    reader.fieldnames = [aliases.get(name, name) if aliases.get(name) not in names else name
                         for name in names]
    if not FIELDS.issubset(reader.fieldnames):
        raise ValueError("Missing required CSV headers")
    tracks, ids = [], set()
    for row in reader:
        if None in row or any(row[key] is None for key in FIELDS):
            raise ValueError(f"CSV line {reader.line_num}: incorrect number of columns")
        track = {key: row[key].strip() for key in reader.fieldnames if key in FIELDS}
        if not track["ID"] or track["ID"] in ids or not track["Title"]:
            raise ValueError(f"CSV line {reader.line_num}: missing title or missing/duplicate ID")
        ids.add(track["ID"])
        link = track["Youtube_URL"]
        video_id = youtube_id(link) if link else ""
        if link and not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            raise ValueError(f"CSV line {reader.line_num}: invalid YouTube link")
        track["Youtube_URL"] = f"https://www.youtube.com/watch?v={video_id}" if video_id else ""
        track["videoId"] = video_id
        tracks.append(track)
    if not tracks:
        raise ValueError("The catalog is empty")
    return tracks


if __name__ == "__main__":
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist"
    tracks = load_tracks()
    output.mkdir(parents=True, exist_ok=True)
    for source in (ROOT / "site").iterdir():
        shutil.copy2(source, output / source.name)
    (output / "tracks.js").write_text(
        "const tracks = " + json.dumps(tracks, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Built {len(tracks)} tracks; {sum(bool(t['videoId']) for t in tracks)} YouTube links")

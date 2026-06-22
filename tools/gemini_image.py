#!/usr/bin/env python3
# Minimal Gemini image-generation client (REST, stdlib only).
# Reads GEMINI_API_KEY from the environment or the repo .env.
#
#   tools/.venv/bin/python tools/gemini_image.py "a red boxing glove, 16-bit pixel art" out.png
#   ... --model gemini-3-pro-image --ref reference.png
import sys, os, json, base64, urllib.request, urllib.error

API = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.5-flash-image"

def load_key():
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = os.path.join(root, ".env")
    if os.path.exists(env):
        for line in open(env):
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("GEMINI_API_KEY not found (env or .env)")

def generate(prompt, out_path, model=DEFAULT_MODEL, refs=None):
    key = load_key()
    parts = [{"text": prompt}]
    for r in (refs or []):
        with open(r, "rb") as f:
            parts.append({"inlineData": {"mimeType": "image/png",
                          "data": base64.b64encode(f.read()).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"]}}
    url = f"{API}/{model}:generateContent?key={key}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=240)
    except urllib.error.HTTPError as e:
        # If a model rejects IMAGE-only, retry with TEXT+IMAGE.
        msg = e.read().decode()[:800]
        if e.code == 400 and "responseModalities" in msg:
            body["generationConfig"]["responseModalities"] = ["TEXT", "IMAGE"]
            req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=240)
        else:
            raise SystemExit(f"HTTP {e.code}: {msg}")
    data = json.loads(resp.read())
    for p in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in p:
            png = base64.b64decode(p["inlineData"]["data"])
            with open(out_path, "wb") as f:
                f.write(png)
            print(f"wrote {out_path} ({len(png)} bytes) via {model}")
            return out_path
    raise SystemExit("no image part in response: " + json.dumps(data)[:800])

def _parse(argv):
    model, refs, rest = DEFAULT_MODEL, [], []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--model": model = argv[i + 1]; i += 2
        elif a == "--ref": refs.append(argv[i + 1]); i += 2
        else: rest.append(a); i += 1
    if len(rest) < 2:
        raise SystemExit("usage: gemini_image.py [--model M] [--ref img]... PROMPT OUT.png")
    return rest[0], rest[1], model, refs

if __name__ == "__main__":
    prompt, out, model, refs = _parse(sys.argv[1:])
    generate(prompt, out, model, refs)

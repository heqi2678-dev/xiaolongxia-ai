# -*- coding: utf-8 -*-
"""把 out/slide_*.png 合成成 1080x1920 的 mp4（带缓慢推近 + 首尾淡入淡出 + 静音音轨）。"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FPS = int(os.environ.get("VFPS", "30"))
ZOOM_MAX = 1.05
CRF = os.environ.get("VCRF", "20")
PRESET = os.environ.get("VPRESET", "veryfast")
SUFFIX = os.environ.get("VSUFFIX", "")
CLIPS = os.path.join(HERE, "clips" + SUFFIX)


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(p.stderr[-3000:])
        raise SystemExit("ffmpeg 失败: " + " ".join(cmd[:6]))
    return p


def main():
    meta = json.load(open(os.path.join(HERE, "meta.json")))
    durs = meta["durations"]
    n = meta["count"]
    total = sum(durs)
    os.makedirs(CLIPS, exist_ok=True)

    for i, d in enumerate(durs, 1):
        frames = max(1, int(round(d * FPS)))
        rate = ZOOM_MAX - 1.0 if False else (ZOOM_MAX - 1.0) / frames
        vf = (
            "zoompan=z='min(1+%.6f*on,%.4f)'"
            ":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            ":d=1:s=1080x1920:fps=%d" % (rate, ZOOM_MAX, FPS)
        )
        if i == 1:
            vf += ",fade=t=in:st=0:d=0.8"
        if i == n:
            vf += ",fade=t=out:st=%.2f:d=0.9" % max(0.0, d - 0.9)
        vf += ",format=yuv420p"
        run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-framerate", str(FPS), "-t", "%.3f" % d,
            "-i", os.path.join(OUT, "slide_%03d.png" % i),
            "-vf", vf,
            "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
            "-pix_fmt", "yuv420p", "-r", str(FPS),
            os.path.join(CLIPS, "clip_%03d.mp4" % i),
        ])
        print("clip %02d/%d  %.1fs" % (i, n, d), flush=True)

    lst = os.path.join(CLIPS, "list.txt")
    with open(lst, "w") as f:
        for i in range(1, n + 1):
            f.write("file 'clip_%03d.mp4'\n" % i)
    silent = os.path.join(HERE, "silent.mp4")
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", lst, "-c", "copy", silent])

    final = os.path.join(HERE, "AI短剧工作台使用教程%s.mp4" % SUFFIX)
    run(["ffmpeg", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
         "-i", silent,
         "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
         "-shortest", "-movflags", "+faststart", final])

    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration,size:stream=codec_name,width,height,r_frame_rate",
                        "-of", "default=nw=1", final], capture_output=True, text=True)
    print(p.stdout)
    print("总时长 %.1fs（%.1f 分钟），文件 %.1f MB" % (
        total, total / 60, os.path.getsize(final) / 1048576))


if __name__ == "__main__":
    main()

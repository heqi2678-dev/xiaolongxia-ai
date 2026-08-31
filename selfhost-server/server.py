#!/usr/bin/env python3
"""小龙虾AI 自托管视频生成服务（同步式）。

协议与前端 videogen.js custom 同步式对齐：
  POST {base}/api/video
  body: {"model": "...", "prompt": "...", "ratio": "16:9", "resolution": "720p", "duration": 5}
  可选 Header: Authorization: Bearer <API_TOKEN>
  resp: {"video_url": "..."}

用法：
  pip install -r requirements.txt
  MODEL_ID=/root/model python server.py
"""
import os
import uuid

import uvicorn
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

API_TOKEN = os.getenv("API_TOKEN", "")
MODEL_ID = os.getenv("MODEL_ID", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")
VIDEO_DIR = os.getenv("VIDEO_DIR", "videos")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
MAX_FRAMES = 121

os.makedirs(VIDEO_DIR, exist_ok=True)

_pipe = None
_pipe_lock = None


class VideoRequest(BaseModel):
    model: str = None
    prompt: str
    ratio: str = "16:9"
    resolution: str = "720p"
    duration: int = 5


app = FastAPI(title="Xiaolongxia SelfHost Video Server")

# 允许前端（GitHub Pages）跨域直连：调用 /api/video 与拉取 /videos/* 直链（用于链接式视频文案转写）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")


def check_auth(authorization):
    if not API_TOKEN:
        return
    if authorization != "Bearer " + API_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")


def load_pipe():
    global _pipe, _pipe_lock
    import threading
    import torch
    from diffusers import WanPipeline
    if _pipe_lock is None:
        _pipe_lock = threading.Lock()
    with _pipe_lock:
        if _pipe is None:
            _pipe = WanPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
            _pipe.to("cuda")
            _pipe.enable_model_cpu_offload()
    return _pipe


def save_mp4(frames, path, fps):
    import imageio
    with imageio.get_writer(path, fps=fps, macro_block_size=None) as w:
        for frame in frames:
            w.append_data(frame)


def resolve_size(resolution, ratio):
    sizes = {"480p": (832, 480), "720p": (1280, 720), "1080p": (1920, 1080)}
    width, height = sizes.get(resolution, (1280, 720))
    if ratio == "9:16":
        return height, width
    if ratio == "1:1":
        return height, height
    return width, height


@app.get("/health")
async def health():
    return {"ok": True, "model": MODEL_ID}


@app.post("/api/video")
async def generate_video(req: VideoRequest, request: Request, authorization: str = Header(None)):
    check_auth(authorization)
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is empty")
    fps = 24
    num_frames = max(1, min(int(req.duration) * fps, MAX_FRAMES))
    width, height = resolve_size(req.resolution, req.ratio)
    pipe = load_pipe()
    try:
        result = pipe(
            prompt=req.prompt,
            negative_prompt="",
            width=width,
            height=height,
            num_frames=num_frames,
            fps=fps,
            num_inference_steps=40,
            guidance_scale=5.0,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="生成失败: %s" % e)
    frames = result.frames[0]
    filename = uuid.uuid4().hex + ".mp4"
    filepath = os.path.join(VIDEO_DIR, filename)
    save_mp4(frames, filepath, fps)
    base = str(request.base_url).rstrip("/")
    return {"video_url": base + "/videos/" + filename}


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)

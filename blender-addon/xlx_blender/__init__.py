# SPDX-License-Identifier: MIT
# 铜龙电商 × Blender 插件
# 在 Blender 内完成白模视频，一键导出到铜龙创作成片。
# 方向一：从铜龙拉取分镜，作为白模搭建参考。
# 方向二：把当前场景导出为 GLB 白模 + 视口预览，回传铜龙 3D-BOX。
bl_info = {
    "name": "铜龙电商 Blender 插件",
    "author": "铜龙电商",
    "version": (1, 0, 0),
    "blender": (4, 5, 0),
    "location": "3D 视图 > 侧栏 > 铜龙",
    "description": "白模场景与参考分镜一键导出到铜龙 3D-BOX",
    "category": "Import-Export",
}

import json
import os
import ssl
import tempfile
import urllib.parse
import urllib.request
import webbrowser

import bpy
from bpy.props import StringProperty
from bpy.types import AddonPreferences, Operator, Panel

__all__ = ["bl_info"]


def _prefs(context=None):
    ctx = context or bpy.context
    return ctx.preferences.addons[__name__].preferences


def _site(prefs):
    base = (prefs.site_url or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("请先填写铜龙站点地址，例如 http://47.108.14.206")
    return base


def _url(prefs, path):
    return _site(prefs) + path


def _ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _json_call(url, token="", method="GET", data=None, ctype=None, timeout=120):
    req = urllib.request.Request(url, data=data, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if ctype:
        req.add_header("Content-Type", ctype)
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as res:
        raw = res.read()
    try:
        return json.loads(raw.decode("utf-8") or "{}")
    except ValueError:
        return {"ok": False, "error": "服务端返回读不懂"}


def _raw_upload(url, token, data, ctype, headers=None, timeout=600):
    req = urllib.request.Request(url, data=data, method="POST")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", ctype)
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as res:
        raw = res.read()
    try:
        return json.loads(raw.decode("utf-8") or "{}")
    except ValueError:
        return {"ok": False, "error": "服务端返回读不懂"}


def _require_token(prefs):
    token = (prefs.token or "").strip()
    if not token:
        raise RuntimeError("请先粘贴铜龙插件令牌（在铜龙插件页点「生成插件令牌」）")
    return token


def _export_glb(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False)


def _render_preview(path):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    prev = scene.render.filepath
    scene.render.filepath = path
    try:
        bpy.ops.render.opengl(write_still=True)
    except Exception:
        return False
    finally:
        scene.render.filepath = prev
    return os.path.isfile(path)


class XLX_OT_pull_scenes(Operator):
    bl_idname = "xlx.pull_scenes"
    bl_label = "拉取分镜"
    bl_description = "从铜龙工程拉取分镜，生成白模搭建参考"

    def execute(self, context):
        prefs = _prefs(context)
        try:
            token = _require_token(prefs)
            pid = (prefs.project_id or "").strip()
            if not pid:
                raise RuntimeError("请先填写工程 ID")
            data = _json_call(
                _url(prefs, "/dian/api/drama/blender/scenes?projectId=" + urllib.parse.quote(pid)),
                token,
            )
            if not data.get("ok"):
                raise RuntimeError(data.get("error") or "拉取失败")
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        made = 0
        for item in data.get("scenes") or []:
            label = "XLX_%02d_%s" % (int(item.get("index") or 0), item.get("name") or "镜头")
            if bpy.data.objects.get(label):
                continue
            empty = bpy.data.objects.new(label, None)
            bpy.context.scene.collection.objects.link(empty)
            text = "XLX_%02d_提示词" % int(item.get("index") or 0)
            block = bpy.data.texts.get(text) or bpy.data.texts.new(text)
            block.clear()
            block.write("画面：%s\n台词：%s\n时长：%s 秒\n画幅：%s\n" % (
                item.get("prompt") or "",
                item.get("line") or "",
                item.get("duration") or 0,
                item.get("ratio") or "9:16",
            ))
            made += 1
        self.report({"INFO"}, "已拉取 %d 个分镜参考" % made)
        return {"FINISHED"}


class XLX_OT_export_whitemodel(Operator):
    bl_idname = "xlx.export_whitemodel"
    bl_label = "导出白模到铜龙"
    bl_description = "导出当前场景 GLB 白模与视口预览，回传铜龙 3D-BOX"

    def execute(self, context):
        prefs = _prefs(context)
        tmp = tempfile.mkdtemp(prefix="xlx-blender-")
        glb = os.path.join(tmp, "whitemodel.glb")
        png = os.path.join(tmp, "preview.png")
        try:
            token = _require_token(prefs)
            pid = (prefs.project_id or "").strip()
            if not pid:
                raise RuntimeError("请先填写工程 ID")
            _export_glb(glb)
            preview_url = ""
            if _render_preview(png) and os.path.getsize(png) > 0:
                with open(png, "rb") as fp:
                    shot = _raw_upload(
                        _url(prefs, "/dian/api/drama/asset"),
                        token,
                        fp.read(),
                        "image/png",
                        timeout=300,
                    )
                if shot.get("ok"):
                    preview_url = shot.get("url") or ""
            with open(glb, "rb") as fp:
                payload = fp.read()
            out = _raw_upload(
                _url(prefs, "/dian/api/drama/blender/import"),
                token,
                payload,
                "model/gltf-binary",
                headers={
                    "X-XLX-Project": urllib.parse.quote(pid),
                    "X-XLX-Name": urllib.parse.quote(
                        os.path.basename(bpy.data.filepath) or "Blender 白模"
                    ),
                    "X-XLX-Preview": preview_url,
                },
            )
            if not out.get("ok"):
                raise RuntimeError(out.get("error") or "回传失败")
            prefs.return_destination = _site(prefs) + "/dian/#box3d"
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, "白模已导出到铜龙，可继续做多机位与运镜")
        return {"FINISHED"}


class XLX_OT_open_box3d(Operator):
    bl_idname = "xlx.open_box3d"
    bl_label = "回到铜龙 3D-BOX"
    bl_description = "在浏览器打开铜龙 3D-BOX 继续创作"

    def execute(self, context):
        prefs = _prefs(context)
        try:
            target = (prefs.return_destination or "").strip() or (_site(prefs) + "/dian/#box3d")
            webbrowser.open(target)
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        return {"FINISHED"}


class XLX_OT_open_token(Operator):
    bl_idname = "xlx.open_token"
    bl_label = "去铜龙生成令牌"
    bl_description = "打开铜龙插件页，登录后生成插件令牌并粘贴回来"

    def execute(self, context):
        prefs = _prefs(context)
        try:
            webbrowser.open(_site(prefs) + "/dian/#plugin")
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        return {"FINISHED"}


class XLX_AddonPreferences(AddonPreferences):
    bl_idname = __name__

    site_url: StringProperty(
        name="铜龙站点地址",
        description="例如 http://47.108.14.206",
        default="http://47.108.14.206",
    )
    token: StringProperty(
        name="插件令牌",
        description="在铜龙插件页点「生成插件令牌」后粘贴到这里",
        default="",
    )
    project_id: StringProperty(
        name="工程 ID",
        description="要交接的铜龙工程 ID，可在插件页工程列表里复制",
        default="",
    )
    return_destination: StringProperty(name="回流地址", default="", options={"HIDDEN"})

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "site_url")
        layout.prop(self, "token")
        layout.prop(self, "project_id")
        row = layout.row()
        row.operator("xlx.open_token", icon="URL")


class XLX_PT_panel(Panel):
    bl_label = "铜龙 Blender 插件"
    bl_idname = "XLX_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "铜龙"

    def draw(self, context):
        layout = self.layout
        prefs = _prefs(context)
        if not (prefs.token or "").strip() or not (prefs.project_id or "").strip():
            box = layout.box()
            box.label(text="先连接铜龙账户", icon="INFO")
            box.operator("xlx.open_token", icon="URL")
            layout.operator("preferences.addon_show", text="填写站点与令牌").module = __name__
            return
        col = layout.column(align=True)
        col.label(text="工程：%s" % (prefs.project_id or "")[:18], icon="FILE")
        layout.operator("xlx.pull_scenes", icon="IMPORT")
        layout.operator("xlx.export_whitemodel", icon="EXPORT")
        layout.separator()
        layout.operator("xlx.open_box3d", icon="URL")


CLASSES = (
    XLX_AddonPreferences,
    XLX_OT_pull_scenes,
    XLX_OT_export_whitemodel,
    XLX_OT_open_box3d,
    XLX_OT_open_token,
    XLX_PT_panel,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)

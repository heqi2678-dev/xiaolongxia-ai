/* 铜龙电商 · AI 短剧工作台 · 教程与提示 */
/* 内置三个教程：手搓台、半自动台、AI 视频入门（贴合抖音），并给工作台提供上下文小贴士。 */
(function () {
  const D = XLX.drama;
  const U = XLX.util;
  let cssOk = false;

  const CSS = `
.gd-mask{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
.gd-box{background:var(--panel);border:1px solid var(--border);border-radius:14px;max-width:760px;width:100%;padding:18px}
.gd-box h2{margin:0 0 4px;font-size:17px}
.gd-box h3{margin:16px 0 6px;font-size:14px;color:var(--accent2)}
.gd-box p,.gd-box li{font-size:13px;line-height:1.85;color:var(--text2)}
.gd-box ol,.gd-box ul{margin:6px 0;padding-left:20px}
.gd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.gd-tab{font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--bg);cursor:pointer;color:var(--text2)}
.gd-tab.on{border-color:var(--accent);color:var(--accent2);background:rgba(255,90,60,.1)}
.gd-tip{background:var(--bg);border-left:3px solid var(--accent);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:12px;color:var(--text2);line-height:1.8}
.gd-kbd{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:1px 6px;font-size:11px}
`;

  function ensureCss() {
    if (cssOk || document.getElementById("dwGuideCss")) { cssOk = true; return; }
    const s = document.createElement("style");
    s.id = "dwGuideCss";
    s.textContent = CSS;
    document.head.appendChild(s);
    cssOk = true;
  }

  function esc(s) { return U.esc(String(s == null ? "" : s)); }

  const TIP = {
    manual: "先锁角色，再逐镜出图。改台词或运镜后，记得对「需重绘」的镜头重新生成。",
    auto: "四个花钱的动作：出图/出视频、配音、口型、合成。每一关都看清楚了再往下走。",
    realistic: "仿真人剧会先出图当首帧，再生成视频，最后做口型。素材务必是 AI 生成或已获授权的形象。",
    comic: "漫剧只用生图 + 配音 + 字幕合成，成本最低，出片最快，适合批量测试选题。",
    ratio: "抖音竖屏用 9:16，前 3 秒必须抓住人。节奏按每镜 3-5 秒切。",
    compliance: "发布前必须保留「AI 生成」角标。用真人相似形象一定要先做肖像授权确认。",
    cost: "先用少量镜头试题材，数据好再扩镜。别一上来就十条视频全量生成。"
  };

  function tip(key) { return TIP[key] || ""; }

  const TUTORIALS = {
    manual: {
      title: "手搓台「逐镜工坊」使用教程",
      body: `
<p>适合想完全掌控每一镜、慢慢打磨的创作方式。</p>
<h3>第一步 · 建工程</h3>
<ol>
<li>进入「逐镜工坊」，填标题，选剧种（漫剧 / 仿真人）和画风。</li>
<li>「仿真人剧」会走视频生成 + 口型；「AI 漫剧」只出图，成本更低。</li>
</ol>
<h3>第二步 · 角色锁定（关键）</h3>
<ol>
<li>新增角色，把「身份」和「外观」写细：年龄、发型、脸型、服装、气质。</li>
 <li>能上传参考图就上传，参考图会参与每一镜的生成，保证长相前后一致。</li>
 <li>点「锁定」，锁定后外观才写进分镜提示词里。</li>
 <li>满意的角色点「存入角色库」，下次开新剧可以「从角色库添加」，不用重写。</li>
 </ol>
<h3>第三步 · 逐镜生成</h3>
<ol>
<li>每一镜写「画面提示词」（你想要的画面）和「台词」。</li>
<li>选运镜（推拉摇移）和时长，点「生成本镜」。</li>
<li>不满意就改提示词重绘。同一角色尽量保持描述一致。</li>
</ol>
<h3>第四步 · 配音与合成</h3>
<ol>
<li>有台词的镜头点「配音」，会自动生成语音并按语音长度调整镜头时长。</li>
<li>仿真人剧在视频和配音都齐了之后，点「口型」做嘴型同步。</li>
<li>点「合成成片」，会烧入字幕和「AI 生成」角标。</li>
</ol>
<h3>第五步 · 出片</h3>
<ol>
<li>「下载成片」直接拿到 mp4/webm，可原样发布。</li>
<li>想再精修就「导出素材包」：里面有每一镜的画面/视频、配音、字幕.srt、分镜表.csv 和 AI 生成说明，导入剪映即可二次剪辑。</li>
<li>发布前确认成片右下角有「AI 生成」角标。</li>
</ol>
<h3>参数怎么选</h3>
<ul>
<li><b>剧种</b>：先用「漫剧」试题材（只出图，最快最省）；确认选题能打，再上「仿真人」。</li>
<li><b>画风</b>：整部剧只用一个画风，中途换风格会让观众出戏。</li>
<li><b>时长</b>：每镜 3-5 秒。有台词的镜头交给配音自动调时长，别手动硬填。</li>
<li><b>运镜</b>：相邻镜头别用同一个。紧张用「推」，交代环境用「摇」，结尾用「拉」。</li>
</ul>
<h3>省钱又省时的顺序</h3>
<ol>
<li>先把剧本、角色、所有镜头的提示词和台词全部写完并保存草稿。</li>
<li>确认角色已「锁定」，再点「生成所有未完成镜」批量出图。</li>
<li>批量配音，最后一次性合成。避免反复重绘已完成的镜头。</li>
</ol>
<h3>常见问题</h3>
<ul>
<li><b>角色长相不一致？</b>把「外观」写得再具体，并上传参考图；锁定后不要中途改外观。</li>
<li><b>画面跑偏？</b>在提示词里加主体、场景、光线、镜头景别四个要素，一次只改一个变量再重绘。</li>
<li><b>配音太长？</b>把台词改短。镜头时长会跟着语音长度走，台词长成片就拖。</li>
<li><b>合成很久？</b>浏览器合成是实时录制，约等于成片时长。素材都是公网地址时，改用「服务端合成」更快。</li>
</ul>
<div class="gd-tip">提示：${esc(TIP.manual)}</div>`
    },
    auto: {
      title: "半自动台「分镜流水线」使用教程",
      body: `
<p>输入一个点子，AI 帮你出剧本分镜，你只做四道关卡审核。</p>
<h3>输入题材</h3>
<ol>
<li>写一个具体点子，越具体越好。例如「外卖小哥其实是隐形富豪，被女总裁误认成骗子」。</li>
<li>选剧种、画风、分镜数量，点「AI 出剧本分镜」。</li>
<li>没配模型时会用内置模板生成，可以手动润色。</li>
</ol>
<h3>关卡一 · 审剧本</h3>
<p>检查一句话故事、剧情大纲、每一镜的提示词与台词。可直接改、加镜、删镜、调顺序。满意后「通过」。</p>
<div class="gd-tip">通过后才开始花钱生成，剧本不满意别急着往下走。</div>
<h3>角色锁定</h3>
<p>核对每个角色的身份与外观，能传参考图就传，然后「全部锁定」。常用角色可「存入角色库」，之后「从角色库添加」直接复用。</p>
<h3>关卡二 · 逐镜检查</h3>
<p>批量生成后逐镜看。不满意的单镜点「重绘」，失败的镜头可一键重绘。</p>
<h3>配音与合成</h3>
<p>「批量配音」补齐所有台词，然后「合成成片」。仿真人剧会自动补口型。</p>
<h3>关卡三 · 终审发布</h3>
<ol>
<li>系统做合规检查：涉及真人形象时会要求「肖像授权确认」。</li>
<li>「下载成片」直接拿走，或「导出素材包」用剪映二次剪辑。</li>
<li>发布到抖音请保留「AI 生成」标注。</li>
</ol>
<h3>每一关的检查清单</h3>
<ul>
<li><b>关卡一（审剧本）</b>：一句话故事有没有钩子？每一镜的台词是否口语化？分镜数量是否够撑起一个反转？</li>
<li><b>角色锁定</b>：名字、身份、外观是否统一？参考图是否都传上去了？</li>
<li><b>关卡二（逐镜检查）</b>：有没有明显崩脸、多手指、文字乱码的镜头？有就单镜「重绘」。</li>
<li><b>配音字幕</b>：有没有漏配的台词？语速是否跟得上画面？</li>
<li><b>关卡三（终审）</b>：合规是否通过？AI 角标是否保留？</li>
</ul>
<h3>常见问题</h3>
<ul>
<li><b>剧本不像人写的？</b>把题材点子里的人物关系、目标、冲突写清楚，越具体越不模板化；也可以在关卡一直接手改。</li>
<li><b>批量生成有失败镜？</b>属正常，在关卡二点「重绘全部失败镜」即可，不用全部重来。</li>
<li><b>真人剧卡在合规？</b>先登记肖像授权，再回到终审。没有授权的真人形象不要发布。</li>
<li><b>想改已通过的剧本？</b>回到关卡一改完，「通过」后重新进入后续关卡，已生成的镜头不会丢。</li>
</ul>
<div class="gd-tip">提示：${esc(TIP.auto)}</div>`
    },
    basics: {
      title: "AI 视频入门 · 贴合抖音的实战教程",
      body: `
<p>零基础也能上手。核心就三件事：选对题材、稳定形象、把控节奏。</p>
<h3>一、选题材</h3>
<ul>
<li>抖音吃「强钩子 + 快反转」。前 3 秒必须让人停下来。</li>
<li>常见赛道：都市逆袭、情感反转、悬疑惊悚、萌宠拟人、知识科普。</li>
<li>先用 3-5 镜做小样测试，数据好再扩成完整剧集。</li>
</ul>
<h3>二、稳定形象</h3>
<ul>
<li>同一角色，外观描述每次都要一模一样，最好配参考图。</li>
<li>漫剧靠文字描述锁形象，仿真人剧还多一道口型同步。</li>
<li>形象一旦跑偏，整部片的「精致感」就崩了。</li>
</ul>
<h3>三、节奏与画面</h3>
<ul>
<li>竖屏 9:16，每镜 3-5 秒，一部 30-60 秒最适合完播。</li>
<li>运镜别一直静帧，推拉摇移交替，画面才不闷。</li>
<li>字幕必须清晰，抖音用户大量静音刷。</li>
</ul>
<h3>四、配音</h3>
<ul>
<li>用云端 TTS（如火山）而不是浏览器自带，声音更自然。</li>
<li>语速略快于日常说话，情绪跟着剧情走。</li>
</ul>
<h3>五、合规（重要）</h3>
<ul>
<li>所有 AI 生成内容都要标注「AI 生成」，平台会查。</li>
<li>使用真人相似形象，必须先取得本人肖像授权。</li>
<li>不要用真人素材做换脸，本工作台会自动拦截。</li>
</ul>
<h3>六、发布</h3>
<ul>
<li>标题带冲突感，封面用最抓眼的一帧。</li>
<li>保留 AI 标注，完播率和互动率靠内容本身。</li>
<li>固定发布时间：中午 12 点、晚上 19-22 点是抖音的流量高峰。</li>
<li>一条视频只讲一个冲突，别贪多。</li>
</ul>
<h3>七、新手 7 天冷启动</h3>
<ul>
<li>第 1-2 天：用漫剧模式，一天做 2 条 30 秒小样，只测选题，不比质量。</li>
<li>第 3-4 天：挑数据最好的一条，把分镜扩到 6-8 镜，做成完整故事。</li>
<li>第 5 天：换成仿真人剧，同题材再发一版，对比两种剧种的数据。</li>
<li>第 6-7 天：把胜出的选题做成系列，固定片头、固定角色，攒账号辨识度。</li>
</ul>
<h3>八、常见问题</h3>
<ul>
<li><b>画面很假怎么办？</b>提升画风一致性，减少每镜的大幅动作；仿真人剧优先用首帧图 + 视频的方式，比纯文字生成稳。</li>
<li><b>没有播放量？</b>先看前 3 秒。把最有冲突的一句台词放到第一镜，别做铺垫。</li>
<li><b>要被限流吗？</b>只要保留 AI 标注、不用未授权的真人形象，正常发布即可。</li>
<li><b>一条视频成本多少？</b>漫剧主要是生图 + 配音，成本最低；仿真人剧多了视频生成和口型，成本约为漫剧的数倍，先用小样测试再放量。</li>
</ul>
<div class="gd-tip">提示：${esc(TIP.cost)}</div>`
    },
    compliance: {
      title: "合规与授权说明",
      body: `
<h3>五条硬规则</h3>
<ol>
<li><b>显式角标</b>：成片右下角固定「AI 生成」水印，合成时自动烧入。</li>
<li><b>隐式元数据</b>：导出文件附带 AI 生成说明，记录生成参数。</li>
<li><b>肖像授权</b>：涉及真人相似形象时，必须做授权确认并留痕。</li>
<li><b>真人拦截</b>：上传真人素材做换脸会被自动拦截。</li>
<li><b>参数留档</b>：每次生成留档，便于追溯。</li>
</ol>
<h3>你应该怎么做</h3>
<ul>
<li>只用 AI 生成的、或有授权的形象。</li>
<li>发布到任何平台都保留 AI 标注。</li>
<li>被授权人信息只在本地留痕，不上传公网。</li>
</ul>
<div class="gd-tip">${esc(TIP.compliance)}</div>`
    }
  };

  let current = "manual";

  function close() {
    const m = document.getElementById("gdMask");
    if (m) m.remove();
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) { if (e.key === "Escape") close(); }

  function draw() {
    const t = TUTORIALS[current];
    const box = document.getElementById("gdBody");
    if (!box || !t) return;
    box.innerHTML = '<h2>' + esc(t.title) + "</h2>" + t.body;
  }

  function open(which) {
    ensureCss();
    current = TUTORIALS[which] ? which : "manual";
    close();
    const mask = document.createElement("div");
    mask.className = "gd-mask";
    mask.id = "gdMask";
    mask.innerHTML = '<div class="gd-box"><div class="gd-tabs" id="gdTabs"></div><div id="gdBody"></div>' +
      '<div class="dw-bar" style="margin-top:14px"><button class="btn small" id="gdClose">关闭</button></div></div>';
    document.body.appendChild(mask);
    const tabs = document.getElementById("gdTabs");
    tabs.innerHTML = Object.keys(TUTORIALS).map(k =>
      '<span class="gd-tab' + (k === current ? " on" : "") + '" data-tab="' + k + '">' + esc(TUTORIALS[k].title) + "</span>"
    ).join("");
    tabs.querySelectorAll("[data-tab]").forEach(el => el.onclick = () => {
      current = el.dataset.tab;
      tabs.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === el));
      draw();
    });
    mask.onclick = (e) => { if (e.target === mask) close(); };
    document.getElementById("gdClose").onclick = close;
    document.addEventListener("keydown", onKey);
    draw();
  }

  D.guide = { open, close, tip, tutorials: TUTORIALS };
})();

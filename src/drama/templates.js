/* 铜龙电商 · AI 短剧工作台 · 内置题材模板 */
/* 纯数据 + 纯函数：把模板套用到工程上，产出可直接编辑的分镜草案。 */
(function () {
  const D = XLX.drama;

  const TEMPLATES = [
    {
      id: "tpl-counterattack",
      name: "逆袭打脸",
      tag: "都市爽剧",
      genre: "comic",
      style: "cn-manhua",
      logline: "被全城嘲笑的穷小子，其实是隐姓埋名的商业巨鳄，当众亮明身份完成打脸。",
      outline: "开场用羞辱制造强钩子，中段层层加压让主角跌到谷底，结尾在公开场合亮出底牌，一句话完成反转，留一个悬念钩住下集。",
      characters: [
        { name: "林北", identity: "被误认为落魄小工的隐形富豪", appearance: "二十七岁，黑色高领毛衣外披旧工装，短发利落，眼神沉稳藏锋" },
        { name: "苏晚", identity: "当众羞辱主角的集团千金", appearance: "二十四岁，酒红色礼服，长卷发，妆容精致，下颌微抬神情倨傲" }
      ],
      shots: [
        { name: "众目睽睽", prompt: "豪华酒店宴会厅，主角被众人围在中央指指点点，头顶水晶灯,低角度仰拍压迫感", line: "穷鬼也配进这种地方？", motion: "zoom-in", duration: 5 },
        { name: "千金发难", prompt: "酒红礼服女子举着香槟冷笑，杯壁反光扫过主角侧脸，浅景深", line: "把这份合同撕了，我就当没见过你。", motion: "pan-left", duration: 5 },
        { name: "沉默隐忍", prompt: "主角垂眸不辩，指节捏紧牛皮纸袋，背景人群虚化", line: "", motion: "static", duration: 4 },
        { name: "身份惊雷", prompt: "宴会厅大门洞开，黑衣助理快步而入躬身递上文件，全场目光追随", line: "林总，董事会一致通过了。", motion: "zoom-out", duration: 5 },
        { name: "当众摊牌", prompt: "主角缓缓戴上腕表，名牌与灯光同闪，全场表情凝固", line: "这栋楼，我记得是我名下第一百三十七处。", motion: "zoom-in", duration: 6 },
        { name: "逆转收尾", prompt: "千金怔在原地，主角转身走向门外，风衣下摆扬起，背影逆光", line: "下集，我让你把合同亲手送回来。", motion: "pan-right", duration: 5 }
      ]
    },
    {
      id: "tpl-revenge",
      name: "古风复仇",
      tag: "权谋古装",
      genre: "comic",
      style: "ink",
      logline: "满门覆灭的将门遗孤隐姓埋名入宫，只为在朝堂之上取回血债。",
      outline: "以灭门惨案开场立钩子，主角以卑位入局，步步为营接近仇人，最终在大典上以证据与刀锋完成复仇。",
      characters: [
        { name: "沈昭", identity: "将门遗孤，易容入宫的复仇者", appearance: "二十岁，玄色窄袖劲装外罩素白斗篷，束发玉簪，目光冷冽如霜" },
        { name: "萧奕", identity: "权倾朝野的摄政王", appearance: "三十五岁，紫金蟒袍，蓄短须，眉峰凌厉，周身威压" }
      ],
      shots: [
        { name: "灭门雪夜", prompt: "大雪压城的将军府，火光与血迹映在雪地上，镜头缓慢推进破碎的牌匾", line: "", motion: "zoom-in", duration: 5 },
        { name: "十年之约", prompt: "少年跪在雪中握紧断剑，特写眼睛映着火光，雨雪打湿睫毛", line: "此仇不报，誓不为人。", motion: "static", duration: 5 },
        { name: "易容入宫", prompt: "铜镜前主角以指腹抹去易容膏，露出的半张脸眼神骤变", line: "", motion: "pan-left", duration: 4 },
        { name: "朝堂审案", prompt: "金殿之上百官方列，主角跪于丹墀之下，仰拍龙椅阴影压顶", line: "臣，有本启奏。", motion: "zoom-in", duration: 6 },
        { name: "证据惊朝", prompt: "一卷泛黄名册被掷于殿中，纸页翻开，朝臣哗然退步", line: "这是将军府三百口的血，都在这上面。", motion: "pan-right", duration: 5 },
        { name: "刀锋加身", prompt: "主角横剑于仇人颈侧，殿门逆光，飞雪穿堂而入", line: "这一剑，替我沈家满门。", motion: "zoom-in", duration: 6 },
        { name: "血债清", prompt: "长阶尽头主角独立，衣袍染血，晨光刺破阴云", line: "", motion: "zoom-out", duration: 5 }
      ]
    },
    {
      id: "tpl-sweet",
      name: "甜宠反转",
      tag: "都市甜宠",
      genre: "comic",
      style: "jp-anime",
      logline: "相亲被放鸽子的女孩，误把同座的冷面总裁当成拼桌路人，一夜之后才发现身份。",
      outline: "以误会开场制造反差萌，甜度递进，中段用身份揭露制造小冲突，结尾高甜和解并埋下约定。",
      characters: [
        { name: "夏栀", identity: "被放鸽子的甜品师", appearance: "二十三岁，米色针织衫，齐肩短发，笑起来有梨涡，手上有面粉痕迹" },
        { name: "陆时衍", identity: "被误认成路人的集团总裁", appearance: "二十九岁，深灰大氅西装，银框眼镜，神情冷淡但耳尖易红" }
      ],
      shots: [
        { name: "放鸽子", prompt: "雨夜咖啡馆，女孩对着两份甜点发呆，窗外车灯拉出光带", line: "又迟到了……算了，我自己吃。", motion: "zoom-in", duration: 5 },
        { name: "拼桌误会", prompt: "冷面男人在她对面落座翻开文件，女孩警惕地护住蛋糕", line: "先生，这是二人座。", motion: "static", duration: 4 },
        { name: "奶油意外", prompt: "女孩手一滑，奶油蹭到男人西装袖口，两人同时愣住", line: "对不起对不起！我赔你！", motion: "zoom-in", duration: 5 },
        { name: "并肩夜路", prompt: "两人共撑一把伞走在湿漉漉的街道，霓虹倒影碎在水面", line: "", motion: "pan-right", duration: 5 },
        { name: "身份揭晓", prompt: "公司大厅巨屏亮起总裁照片，女孩举着蛋糕僵在原地", line: "陆……陆总？", motion: "zoom-out", duration: 6 },
        { name: "高甜和解", prompt: "男人把西装袖口递到她面前，唇角极浅地弯起，暖光打在两人之间", line: "赔就不必了，用一辈子抵吧。", motion: "zoom-in", duration: 5 }
      ]
    },
    {
      id: "tpl-suspense",
      name: "都市悬疑",
      tag: "反转悬疑",
      genre: "comic",
      style: "3d",
      logline: "深夜电台主播接到一通来自三天后自己的求救电话，追查真相时发现整座城市都在循环。",
      outline: "开场用超自然来电立钩子，线索层层递进并不断推翻前设，结尾揭示循环源头，留开放式悬念。",
      characters: [
        { name: "周迟", identity: "深夜电台主播，线索追查者", appearance: "二十八岁，黑色卫衣，略显疲惫的黑眼圈，指间转着一支笔" },
        { name: "未知来电者", identity: "声音与主角一模一样的神秘人", appearance: "画面中仅见剪影与老式电话听筒，逆光看不清面容" }
      ],
      shots: [
        { name: "午夜来电", prompt: "昏黄直播间，老式电话突然震动，红色指示灯闪烁，收音话筒近景", line: "喂？这里是深夜频道。", motion: "zoom-in", duration: 5 },
        { name: "三日之后", prompt: "听筒特写与主播骤然收缩的瞳孔叠化，屏幕时间码跳动", line: "别出去，三天后的你会死在楼下。", motion: "zoom-in", duration: 5 },
        { name: "监控盲区", prompt: "便利店监控画面雪花噪点，主角的身影在第 47 秒凭空消失", line: "", motion: "pan-left", duration: 4 },
        { name: "同一张脸", prompt: "主角在镜中看到另一个自己回头，镜面出现裂纹", line: "如果那是我……那我是谁？", motion: "static", duration: 5 },
        { name: "循环之城", prompt: "航拍城市夜景，同一盏路灯连续熄灭三次，车流轨迹首尾相接", line: "", motion: "zoom-out", duration: 6 },
        { name: "拨回过去", prompt: "主角颤抖着按下回拨键，听筒里传来自己的呼吸声，黑屏收尾", line: "这一次，换我提醒你。", motion: "zoom-in", duration: 6 }
      ]
    }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function list() { return clone(TEMPLATES); }

  function get(tid) {
    const t = TEMPLATES.find(x => x.id === tid);
    return t ? clone(t) : null;
  }

  /* 把模板写入工程：剧种、画风、剧本、角色、分镜一次性铺好 */
  function apply(project, template) {
    if (!project || !template) throw D.err("NO_TEMPLATE", "题材模板不存在");
    const styleDef = (D.STYLES || []).find(s => s.id === template.style);
    const prefix = styleDef ? styleDef.prompt : "";

    project.templateId = template.id;
    project.genre = template.genre || project.genre;
    project.engine = project.genre === "realistic" ? "video" : "image";
    if (template.style) project.style = template.style;
    project.script = project.script || {};
    project.script.logline = template.logline || "";
    project.script.outline = template.outline || "";

    project.characters = (template.characters || []).map(c => {
      const card = D.project.newCharacter(c.name);
      card.identity = c.identity || "";
      card.appearance = c.appearance || "";
      return card;
    });

    const main = project.characters[0] ? [project.characters[0].id] : [];
    project.shots = (template.shots || []).map((s, i) => {
      const shot = D.project.newShot(i + 1);
      shot.name = s.name || ("分镜 " + (i + 1));
      shot.prompt = [prefix, s.prompt].filter(Boolean).join("，");
      shot.line = s.line || "";
      shot.motion = (D.MOTIONS || []).some(m => m.id === s.motion) ? s.motion : "zoom-in";
      shot.duration = Number(s.duration) || 5;
      shot.roleIds = main.slice();
      return shot;
    });
    if (!project.shots.length) project.shots = [D.project.newShot(1)];
    return project;
  }

  D.templates = { list, get, apply };
})();

(() => {
  const M = window.MOCK;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const STAGES = ["Home", "Panorama", "Trajectories", "Expand", "Dataset", "Splat"];
  const UE_TIP = "Unreal / VotionSplat Export: drag splat.ply into the Content Browser with VotionSplat-UnrealPlugin. No settings. The file keeps the trained splats, and the plugin draws them with the same rule as this viewport.";

  const MODELS = {
    Core: [
      ["Krea 2", "Panorama", "13.14"], ["Krea 2 text encoder", "Panorama", "5.24"], ["VAE", "Panorama", "0.25"],
      ["Krea 2 360 ERP LoRA", "Panorama", "0.23"], ["Krea 2 360 outpaint LoRA", "Panorama", "0.23"], ["RealESRGAN x2", "Panorama", "0.07"],
      ["MoGe", "Panorama", "1.26"], ["Qwen3-VL 8B", "Trajectories", "17.55"], ["ZIM", "Trajectories", "1.26"],
      ["Grounding DINO", "Trajectories", "0.69"], ["MoGe 2", "Trajectories", "1.32"], ["SAM 3", "Trajectories", "3.45"],
      ["WorldStereo", "Expand", "20.36"], ["WorldStereo config", "Expand", "0.00"], ["480P config", "Expand", "0.00"],
      ["720P configs", "Expand", "0.02"], ["VAE config", "Expand", "0.00"], ["UMT5", "Expand", "6.74"],
      ["CLIP vision", "Expand", "1.26"], ["DINOv2", "Expand", "0.35"], ["SeedVR2 3B", "HiRes", "3.39"],
      ["SeedVR2 VAE", "HiRes", "0.50"], ["LPIPS VGG16", "Splat", "0.55"],
    ],
    Optional: [["Difix", "Splat", "5.17"], ["Florence-2", "Panorama", "1.56"]],
  };

  // ---- small builders -------------------------------------------------
  const lab = (t) => `<div class="f-lab">${esc(t)}</div>`;
  const hint = (t, h) => `<div class="f-hint"${h ? ` style="height:${h}px"` : ""}>${esc(t)}</div>`;
  const inp = (v, ph = "") => `<input class="f-in" value="${esc(v)}" placeholder="${esc(ph)}" />`;
  const sel = (items, opts = {}) =>
    `<select class="f-sel"${opts.title ? ` title="${esc(opts.title)}"` : ""}>${items
      .map((it, i) => `<option${opts.disabled && opts.disabled.includes(i) ? " disabled" : ""}>${esc(it)}</option>`)
      .join("")}</select>`;
  const btn = (t, kind = "", dis = false, extra = "") => `<button class="f-btn ${kind}" type="button"${dis ? " disabled" : ""} ${extra}>${esc(t)}</button>`;
  const check = (t, on) => `<div class="f-check${on ? " on" : ""}" data-toggle><i></i>${esc(t)}</div>`;
  const radio = (t, on, group) => `<div class="f-radio${on ? " on" : ""}" data-radio="${group}"><i></i>${esc(t)}</div>`;
  const area = (h, ph = "", v = "", extra = "") => `<textarea class="f-area" style="height:${h}px" placeholder="${esc(ph)}" ${extra}>${esc(v)}</textarea>`;
  const row = (...parts) => `<div class="f-row">${parts.join("")}</div>`;
  const chips = (names, on = 0, key = "") =>
    `<div class="chips">${names.map((n, i) => `<button class="chip${i === on ? " on" : ""}" type="button" data-chip="${key}" data-i="${i}">${esc(n)}</button>`).join("")}</div>`;
  const shot = (name) => `media/shots/${name}.jpg`;
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function listRows(rows, opts = {}) {
    return rows
      .map(([text, fg, chk, selectable], i) => {
        const box = opts.boxes && chk !== null ? `<i class="${chk ? "on" : ""}" data-box></i>` : "";
        const cls = [selectable ? "" : "head", i === (opts.selected ?? -1) ? "sel" : ""].join(" ").trim();
        return `<div class="${cls}" style="${fg ? `color:${fg}` : ""}" data-row="${i}">${box}${esc(text)}</div>`;
      })
      .join("");
  }

  // ---- pages ----------------------------------------------------------
  function home() {
    const cards = Object.entries(MODELS)
      .map(([group, items]) => `<div class="v-lbl">${group}</div>` + items.map(([n, s, gb]) => `<div class="stat"><b>${esc(n)}<br>${s} · ${gb} GB</b><span>READY</span></div>`).join(""))
      .join("");
    return {
      rails: [
        280,
        lab("Scene name") + inp("alpine_02") + lab("Profile") + sel(["Quality", "Fast", "Scout"], { disabled: [1, 2] }) +
          lab("CUDA device") + `<input class="f-in" type="number" value="0" min="0" />` + lab("Download set") +
          radio("Core (required, about 78 GB)", true, "dl") + radio("Core + optional (Difix, captions)", false, "dl") +
          row(btn("Download models", "pri", false, "data-run"), btn("Stop", "", false, "data-stop")),
      ],
      view: `<div class="v-lbl" style="padding:2px 4px 0">Model status</div>
        <div class="stat-scroll" style="padding:4px 4px 0"><div class="stat-grid">${cards}</div></div>
        <div class="f-hint" style="padding:2px 4px 4px">Green is ready. A missing core model blocks that stage.</div>`,
      viewStyle: "padding:10px 8px 8px",
    };
  }

  const P = M.pano;
  function panoPane(mode) {
    if (mode === 0) {
      return (
        lab("2D image") + `<div class="drop" data-drop>Drop 2D photo · double-click to browse</div>` +
        `<div class="fov-row">${lab("h_fov")}<input class="f-in" value="70.0" data-fov />${btn("Detect")}</div>` +
        `<div class="slider" data-slider><b style="left:37.5%"></b></div>` +
        hint("Type or drag. Horizontal field of view, 10–170, step 0.5.") +
        lab("Surroundings") + radio("Type a sentence", true, "surr") + radio("Florence-2 caption, then edit", false, "surr") +
        area(64, "Empty → block Generate", "", "data-surr") + hint(`Always appended: ${P.suffix}`) +
        lab("Seed (IMAGE→PANO)") + inp(P.img_seed) + lab("Seed (seam inpaint)") + inp(P.img_seam) +
        lab("Upscaler prompt") + inp(P.upscaler) +
        row(btn("Generate", "pri", true, "data-run data-gen2d"), btn("Stop", "", false, "data-stop"))
      );
    }
    if (mode === 1) {
      return (
        lab("360 file (2:1 only)") + `<div class="drop" data-drop>Drop ERP · reject non-2:1 · do not letterbox</div>` +
        lab("prompt.txt") + area(56, "Optional") +
        hint("Store as-is even if not 8192. Upscale to 8K when the panorama itself should be 8192 wide.") +
        lab("Upscaler prompt") + inp(P.upscaler) +
        row(btn("Use as pano.png", "pri", false, "data-run"), btn("Upscale to 8K", "", false, "data-run"), btn("Stop", "", false, "data-stop"))
      );
    }
    return (
      lab("Trigger prefix (locked)") + `<div class="prefix">${esc(P.trigger)}</div>` +
      area(64, "scene sentence after the comma", "", "data-sentence") +
      hint("Empty scene → block Generate. No 2D image in this mode.") +
      lab("prompt.txt") + area(56, "", P.trigger, "readonly data-preview") +
      lab("Seed (TEXT→PANO)") + inp(P.text_seed) + lab("Seed (seam inpaint)") + inp(P.text_seam) +
      lab("Upscaler prompt") + inp(P.upscaler) +
      row(btn("Generate", "pri", true, "data-run data-gentext"), btn("Stop", "", false, "data-stop"))
    );
  }
  function panorama() {
    return {
      rails: [300, lab("Input") + `<div class="mode-row">${["2D Images", "360 Images", "text"].map((n, i) => `<button class="chip${i === 0 ? " on" : ""}" type="button" data-panomode="${i}">${n}</button>`).join("")}</div><div class="pane-host" style="display:flex;flex-direction:column;gap:4px">${panoPane(0)}</div>`],
      view: `<div class="v-head" style="padding:2px 4px 0">
          <div style="width:634px;display:flex;align-items:center"><span class="v-lbl">2:1 ERP</span><span class="sp" style="flex:1"></span>${chips(["Fit", "100%"], 0, "fit")}</div>
          <div style="width:8px"></div><span class="v-lbl">360 · drag to look</span></div>
        <img class="v-img" style="height:495px;width:1276px;margin-left:4px" src="${shot("panorama")}" alt="Panorama: 2:1 ERP and spherical view" />
        <div class="f-hint" style="padding:2px 4px">Left is the generated 2:1 ERP. Right is a spherical look — drag to pan and tilt.</div>`,
      viewStyle: "padding:10px 8px 8px",
    };
  }

  function rightRail(title, listHtml, footer) {
    return `${lab(title)}<div class="list" data-list>${listHtml}</div><div class="f-hint" data-foot style="height:13px">${esc(footer)}</div>`;
  }

  function trajectories() {
    const names = ["Panorama", "Sky mask", "Nav map", "Objects", "Paths", "Guide"];
    const rows = M.lists.trajectories;
    const kept = rows.filter((r) => r[2]).length;
    return {
      rails: [
        290,
        lab("Scene type") + sel(["Auto", "Outdoor", "Indoor"]) + check("Navigation paths", true) + check("Upward routes", true) +
          check("Reconstruction loops", true) + check("Start over (archive the old plan)", false) + lab("Extra views per kind") +
          `<input class="f-in" type="number" value="2" min="0" />` +
          hint("Origin views are always kept. A kept wonder, target or reconstruct view keeps all of its paths.", 26) +
          btn("Plan trajectories", "pri", false, "data-run") + btn("Render guides", "", false, "data-run") + btn("Stop", "", true, "data-stop"),
      ],
      view: `<div class="v-head"><span class="v-lbl">Trajectories</span>${chips(names, 0, "trajectories")}</div>
        <img class="v-img" style="height:499px" data-shot="trajectories" src="${shot("trajectories-panorama")}" alt="" />`,
      right: [230, rightRail("Paths", listRows(rows, { boxes: true, selected: 0 }), `${rows.length} paths, ${kept} kept`)],
      chipNames: { trajectories: names },
    };
  }

  function expand() {
    const names = ["Clips", "Aligned cloud", "HiRes"];
    const rows = M.lists.expand;
    return {
      rails: [
        290,
        btn("Profile first path", "", false, "data-run") + btn("Expand kept paths", "pri", false, "data-run") + btn("Regenerate selected", "", false, "data-run") +
          btn("Align", "", false, "data-run") + btn("HiRes all", "", false, "data-run") + btn("HiRes selected", "", false, "data-run") + btn("Stop", "", true, "data-stop") +
          lab("GPU memory") + sel(["Auto (fit this machine)", "Everything on the card", "DiT blocks in RAM", "Blocks and controlnet outputs in RAM", "Blocks, outputs and controlnet in RAM"]) +
          `<div style="height:12px"></div>` + lab("HiRes scale") + sel(["2x (1664x960)", "4x (3328x1920)"]) +
          lab("HiRes memory") + sel(["Auto (fit this machine)", "Whole frame", "Decode tiles 1024", "Decode 768, encode 1024", "Decode 512, encode 768"]) +
          `<div style="height:28px"></div>` + hint("17 paths kept, 17 expanded. One 21-frame sample is the profile.", 26),
      ],
      view: `<div class="v-head"><span class="v-lbl">Expand</span>${chips(names, 0, "expand")}</div>
        <img class="v-img" style="height:499px" data-shot="expand" src="${shot("expand-clips")}" alt="" />`,
      right: [230, rightRail("Queue", listRows(rows, { selected: 0 }), "17 / 17 expanded")],
      chipNames: { expand: names },
    };
  }

  function dataset() {
    const names = ["Image", "Depth", "Normal"];
    return {
      rails: [
        290,
        lab("Panorama density") + `<input class="f-in" type="number" value="2" min="1" />` + lab("Upper polar density") +
          `<input class="f-in" type="number" value="4" min="1" />` + btn("Build dataset", "pri", false, "data-run") + btn("Stop", "", true, "data-stop") +
          `<div style="height:12px"></div>` + hint("Aligned cloud is ready. Dataset images: 451."),
      ],
      view: `<div class="v-head"><span class="v-lbl">Dataset</span>${chips(names, 0, "dataset")}</div>
        <img class="v-img" style="height:479px" data-shot="dataset" src="${shot("dataset-image")}" alt="" />
        <div class="slider" style="margin-top:2px"><b style="left:0"></b></div>
        <div class="f-hint" style="margin-top:4px">1 / 451   panorama_L00_A0000</div>`,
      right: [230, rightRail("Groups", listRows(M.lists.dataset, { selected: 0 }), "")],
      chipNames: { dataset: names },
    };
  }

  function splat() {
    return {
      rails: [
        290,
        lab("Max steps") + inp("8000", "8000") + hint("Train starts over from the dataset. Continue finishes the last run with its own step count.", 26) +
          lab("Training frames") + sel(["Expand frames (832x480)", "HiRes 2x (1664x960)", "HiRes 4x (3328x1920)"]) + `<div style="height:13px"></div>` +
          check("Export mesh at the end (slow)", false) + check("Difix3D+ refine (evaluation only)", false) +
          row(btn("Train", "pri", false, "data-run"), btn("Continue training", "", true)) +
          row(btn("Pause", "", true), btn("Stop", "", true, "data-stop")) +
          hint("Stop saves a checkpoint first. Press Stop twice to kill at once.", 26) +
          lab("Export color space") +
          sel(["Unreal / VotionSplat Export", "3DGS / sRGB (Brush, Postshot, SuperSplat)", "Linear Rec.709, tagged (other engines)"], { title: UE_TIP }) +
          check("Soften like the viewport (no needles)", true) + btn("Export splat.ply", "", false, "data-export") + btn("Open result folder") +
          hint("Checkpoint ckpt_99999_rank0.pt. Exported outputs\\alpine_02\\hyworld\\splat.ply. The last run finished. Press Train. Last run used Difix3D+ (evaluation only).", 52),
      ],
      view: `<div class="v-head" style="height:19px"><span class="v-lbl">Live splat</span><span class="f-hint">Centre</span><span class="sp"></span><button class="mini" type="button">reset view</button></div>
        <img class="v-img" style="height:501px;margin-top:2px" src="${shot("splat")}" alt="Live splat view" />
        <div class="f-hint">Reset is the panorama centre. LMB look, RMB pan, wheel dolly, hold LMB + WASD/QE to fly (Shift sprints). Click a training camera to jump there.</div>`,
      right: [230, rightRail("Training cameras", listRows(M.lists.splat), "680 training views. Click one to jump there.")],
    };
  }

  const PAGES = [home, panorama, trajectories, expand, dataset, splat];

  // ---- shell ----------------------------------------------------------
  const app = $("#app");
  const body = $(".a-body", app);
  const log = $("#log", app);
  const help = $("#help", app);
  const live = $(".a-live", app);
  let timer = null;
  let current = 0;
  let chipNames = {};

  function appendLog(line) {
    log.textContent += "\n" + line;
    log.scrollTop = log.scrollHeight;
  }

  function show(i) {
    current = i;
    history.replaceState(null, "", i ? `#${STAGES[i].toLowerCase()}` : location.pathname);
    $$(".a-stage").forEach((b, j) => b.classList.toggle("on", j === i));
    const page = PAGES[i]();
    chipNames = page.chipNames || {};
    const [lw, lhtml] = page.rails;
    let html = `<div class="a-rail" style="width:${lw}px">${lhtml}</div><div class="a-view" style="${page.viewStyle || ""}">${page.view}</div>`;
    if (page.right) html += `<div class="a-rail r-right" style="width:${page.right[0]}px">${page.right[1]}</div>`;
    body.innerHTML = html;
    help.textContent = M.help[["home", "panorama", "trajectories", "expand", "dataset", "splat"][i]];
    help.scrollTop = 0;
  }

  function $$(sel, root = app) {
    return Array.from(root.querySelectorAll(sel));
  }

  function run(label) {
    clearInterval(timer);
    const bar = $(".a-job .bar i", app);
    const pct = $(".a-job .pct", app);
    const lab = $(".a-job .lab", app);
    live.textContent = "running";
    live.classList.add("busy");
    appendLog(`STATUS // ${label} (mockup, nothing runs)`);
    let p = 0;
    timer = setInterval(() => {
      p = Math.min(100, p + 4);
      bar.style.width = p + "%";
      pct.textContent = p + "%";
      lab.textContent = `${label} · ${p}%`;
      if (p >= 100) {
        clearInterval(timer);
        live.textContent = "idle";
        live.classList.remove("busy");
        appendLog(`STATUS // ${label} finished`);
      }
    }, 60);
  }

  function stop() {
    if (!live.classList.contains("busy")) return;
    clearInterval(timer);
    live.textContent = "idle";
    live.classList.remove("busy");
    appendLog("STATUS // stopped");
  }

  app.addEventListener("click", (e) => {
    const t = e.target;
    const stage = t.closest(".a-stage");
    if (stage) return show(Number(stage.dataset.i));

    const tog = t.closest("[data-toggle]");
    if (tog) return tog.classList.toggle("on");

    const rad = t.closest("[data-radio]");
    if (rad) {
      $$(`[data-radio="${rad.dataset.radio}"]`).forEach((r) => r.classList.toggle("on", r === rad));
      return;
    }

    const mode = t.closest("[data-panomode]");
    if (mode) {
      $$("[data-panomode]").forEach((b) => b.classList.toggle("on", b === mode));
      $(".pane-host", app).innerHTML = panoPane(Number(mode.dataset.panomode));
      return;
    }

    const chip = t.closest(".chip[data-chip]");
    if (chip) {
      $$(`.chip[data-chip="${chip.dataset.chip}"]`).forEach((c) => c.classList.toggle("on", c === chip));
      const key = chip.dataset.chip;
      const img = $(`img[data-shot="${key}"]`, app);
      if (img && chipNames[key]) img.src = shot(`${key}-${slug(chipNames[key][Number(chip.dataset.i)])}`);
      return;
    }

    const drop = t.closest("[data-drop]");
    if (drop) {
      drop.classList.add("loaded");
      drop.textContent = current === 1 && $("[data-panomode].on", app).dataset.panomode === "1" ? "pano_8192.png · 8192 × 4096" : "office.jpg · 4032 × 3024";
      syncGenerate();
      return;
    }

    const box = t.closest("[data-box]");
    if (box) {
      box.classList.toggle("on");
      const all = $$("[data-list] [data-box]");
      const kept = all.filter((b) => b.classList.contains("on")).length;
      $("[data-foot]", app).textContent = `${all.length} paths, ${kept} kept`;
      return;
    }

    const rowEl = t.closest("[data-list] > div");
    if (rowEl && !rowEl.classList.contains("head")) {
      $$("[data-list] > div").forEach((r) => r.classList.toggle("sel", r === rowEl));
      return;
    }

    const exp = t.closest("[data-export]");
    if (exp) {
      appendLog("STATUS // wrote outputs\\alpine_02\\hyworld\\splat.ply (mockup)");
      appendLog(UE_TIP);
      return;
    }

    const go = t.closest("[data-run]");
    if (go && !go.disabled) return run(go.textContent);
    if (t.closest("[data-stop]") || t.closest(".a-job .stop")) return stop();

    const slider = t.closest("[data-slider]");
    if (slider) {
      const r = slider.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      $("b", slider).style.left = f * 100 + "%";
      const fov = $("[data-fov]", app);
      if (fov) fov.value = (10 + Math.round(f * 320) / 2).toFixed(1);
    }
  });

  function syncGenerate() {
    const g2 = $("[data-gen2d]", app);
    if (g2) g2.disabled = !($("[data-drop]", app).classList.contains("loaded") && $("[data-surr]", app).value.trim());
    const gt = $("[data-gentext]", app);
    if (gt) gt.disabled = !$("[data-sentence]", app).value.trim();
  }

  app.addEventListener("input", (e) => {
    if (e.target.matches("[data-sentence]")) {
      const s = e.target.value.trim();
      $("[data-preview]", app).value = s ? `${P.trigger} ${s}` : P.trigger;
    }
    syncGenerate();
  });

  // ---- chrome ---------------------------------------------------------
  $(".a-stages", app).innerHTML = STAGES.map((s, i) => `<button class="a-stage" type="button" data-i="${i}">${s}</button>`).join("");
  log.textContent = "STATUS // idle";
  $$(".a-draw .tg").forEach((b) => b.addEventListener("click", () => {
    const pane = b.nextElementSibling;
    pane.style.visibility = pane.style.visibility === "hidden" ? "" : "hidden";
  }));
  const start = STAGES.findIndex((s) => `#${s.toLowerCase()}` === location.hash);
  show(start > 0 ? start : 0);
  if (start > 0) document.getElementById("app-mockup").scrollIntoView();

  const tbody = document.getElementById("models-body");
  if (tbody) {
    tbody.innerHTML = Object.entries(MODELS)
      .flatMap(([group, items]) => items.map(([n, s, gb]) => `<tr><td>${esc(n)}</td><td>${s}</td><td>${gb}</td><td>${group.toLowerCase()}</td></tr>`))
      .join("");
  }

  const frame = $(".frame");
  function fit() {
    const s = frame.clientWidth / 1600;
    app.style.transform = `scale(${s})`;
    frame.style.height = `${1000 * s}px`;
  }
  new ResizeObserver(fit).observe(frame);
  fit();
})();

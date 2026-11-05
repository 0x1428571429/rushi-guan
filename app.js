/**
 * 如是观
 *
 * 两个练习：
 *   勘 —— 生活情境里，看见每个反应背后的相（不记录，做完就放下）
 *   观 —— 把当下的一次反应，拆成事、念、我、观四步（可存下）
 *
 * 设计上的三条约束：
 *   1. 不打卡、不记分、不排名。勘的结果完全不落盘。
 *   2. 所有文字只存在 localStorage，不发往任何服务器。
 *   3. 没有"正确答案"，只有"看见"。
 */

(() => {
  "use strict";

  // ---------- 常量 ----------

  const STORAGE_KEY = "rushi:entries";
  const STORAGE_VERSION = 1;

  const GUAN_STEPS = [
    {
      key: "event",
      label: "事",
      title: "发生了什么？",
      note: "只写事实，先不写解释。把「他故意」换成「他做了什么」。",
      placeholder: "例：开会时，同事用「我」汇报了我做的项目。"
    },
    {
      key: "thought",
      label: "念",
      title: "心里升起的第一句话是什么？",
      note: "照原话写，不用修饰。那句最不体面、最不敢说的，往往最真。",
      placeholder: "例：凭什么？明明是我做的。"
    },
    {
      key: "self",
      label: "我",
      title: "那个被碰到的「我」，在哪里？",
      note: "是面子，是期待，是某个身份，还是「我应该被公平对待」？",
      placeholder: "例：在「我不能被抹掉」这个地方。"
    },
    {
      key: "view",
      label: "观",
      title: "如果无所住，此刻能做什么？",
      note: "不是要你做得更高尚。是问：松开那个「我」之后，还剩下什么该做的事？",
      placeholder: "例：如果功劳的事真的需要澄清，就澄清；如果只是不甘心，就先放一放。"
    }
  ];

  // ---------- 状态 ----------

  const state = {
    view: "kan",
    questions: [],
    questionIndex: -1,
    picked: null,
    guanStep: 0,
    guan: { event: "", thought: "", self: "", view: "" },
    entries: [],
    loadError: null
  };

  let store = { version: STORAGE_VERSION, entries: [] };

  const app = document.getElementById("app");

  // ---------- 工具 ----------

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}　${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function uid() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // ---------- 存储 ----------

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: STORAGE_VERSION, entries: [] };

      const parsed = JSON.parse(raw);

      // 版本迁移的入口。将来 schema 变化时，在这里按版本转换。
      if (!parsed || typeof parsed !== "object") {
        return { version: STORAGE_VERSION, entries: [] };
      }
      if (parsed.version !== STORAGE_VERSION) {
        return { version: STORAGE_VERSION, entries: [] };
      }
      if (!Array.isArray(parsed.entries)) {
        return { version: STORAGE_VERSION, entries: [] };
      }

      return {
        version: STORAGE_VERSION,
        entries: parsed.entries.filter(
          (e) => e && typeof e === "object" && typeof e.id === "string"
        )
      };
    } catch {
      return { version: STORAGE_VERSION, entries: [] };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.warn("写入 localStorage 失败：", err);
    }
  }

  // ---------- 题库 ----------

  async function loadQuestions() {
    const res = await fetch("data/questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("题库格式不正确");
    }
    return data.questions;
  }

  // ---------- 视图：勘 ----------

  function renderKan() {
    if (state.questionIndex < 0 || !state.questions[state.questionIndex]) {
      app.innerHTML = `<div class="empty"><p>题库是空的。</p></div>`;
      return;
    }

    const q = state.questions[state.questionIndex];
    const picked = state.picked;
    const revealed = picked !== null;

    const optionsHtml = q.options
      .map((opt, i) => {
        const pickedAttr = picked === i ? ' data-picked="true"' : "";
        const dimAttr = revealed && picked !== i ? ' data-dim="true"' : "";
        const disabled = revealed ? " disabled" : "";
        return `
          <li>
            <button class="option" data-action="pick" data-index="${i}"
                    ${pickedAttr}${dimAttr}${disabled}>
              <span>${escapeHtml(opt.text)}</span>
            </button>
          </li>`;
      })
      .join("");

    const developHtml = revealed
      ? `
        <section class="develop">
          <p class="develop-note">
            <strong>选好了。</strong>下面不是判分，是把每个选项背后的相，一个一个照出来。
            你选的那个只是其中之一——看见它，比选对它要紧。
          </p>
          <ol class="reveal-list">
            ${q.options
              .map(
                (opt, i) => `
                <li class="reveal">
                  <div class="reveal-head">
                    <span class="reveal-key">${String.fromCharCode(65 + i)}${picked === i ? " · 你选的" : ""}</span>
                  </div>
                  <p class="reveal-opt">${escapeHtml(opt.text)}</p>
                  <p>${escapeHtml(opt.note)}</p>
                </li>`
              )
              .join("")}
          </ol>
          <p class="coda">
            ${escapeHtml(q.coda)}
            <br><span class="seal">如是观</span>
          </p>
          <div class="actions">
            <button class="btn primary" data-action="next-question">再看一题</button>
            <button class="btn ghost" data-action="goto-guan">把此刻的事写下来</button>
          </div>
        </section>`
      : "";

    app.innerHTML = `
      <div class="view">
        <p class="eyebrow">勘 · 第 ${state.questionIndex + 1} 题</p>
        <div class="scene">
          <p>${escapeHtml(q.scene)}</p>
          <p class="prompt">${escapeHtml(q.prompt)}</p>
        </div>
        ${revealed ? "" : `<p class="hint-line">选一个最像你真实反应的。选完会照见每个选项背后的相。</p>`}
        <ul class="options">${optionsHtml}</ul>
        ${developHtml}
      </div>`;
  }

  // ---------- 视图：观 ----------

  function renderGuan() {
    const step = GUAN_STEPS[state.guanStep];
    const isLast = state.guanStep === GUAN_STEPS.length - 1;

    const stepsHtml = GUAN_STEPS.map((s, i) => {
      const cls = i === state.guanStep ? "active" : i < state.guanStep ? "done" : "";
      return `<span class="step-dot ${cls}">${s.label}</span>`;
    }).join("");

    const value = state.guan[step.key] || "";

    app.innerHTML = `
      <div class="view">
        <p class="eyebrow">观 · ${state.guanStep + 1} / ${GUAN_STEPS.length}</p>
        <div class="steps">${stepsHtml}</div>

        <label class="field-label" for="guan-input">${escapeHtml(step.title)}</label>
        <p class="field-note">${escapeHtml(step.note)}</p>
        <textarea id="guan-input" data-key="${step.key}"
                  placeholder="${escapeHtml(step.placeholder)}">${escapeHtml(value)}</textarea>

        ${
          isLast
            ? `<div class="syllogism">
                 把它收成一句：<br>
                 所谓<span class="fill">〔　〕</span>，即非<span class="fill">〔　〕</span>，是名<span class="fill">〔　〕</span>。
               </div>`
            : ""
        }

        <div class="actions">
          ${state.guanStep > 0 ? `<button class="btn ghost" data-action="guan-prev">上一步</button>` : ""}
          ${
            isLast
              ? `<button class="btn primary" data-action="guan-save">存下这一观</button>`
              : `<button class="btn primary" data-action="guan-next">下一步</button>`
          }
          <button class="btn ghost" data-action="guan-reset">重新开始</button>
        </div>
      </div>`;
  }

  // ---------- 视图：记 ----------

  function renderJi() {
    const entries = state.entries;

    const actionsHtml = entries.length
      ? `<div class="actions">
           <button class="btn" data-action="export">导出为 Markdown</button>
         </div>`
      : "";

    const listHtml = entries.length
      ? `<ul class="record-list">
           ${entries
             .map(
               (e) => `
               <li class="record">
                 <time datetime="${new Date(e.createdAt).toISOString()}">${formatDate(e.createdAt)}</time>
                 <dl>
                   <dt>事</dt><dd>${escapeHtml(e.event)}</dd>
                   <dt>念</dt><dd>${escapeHtml(e.thought)}</dd>
                   <dt>我</dt><dd>${escapeHtml(e.self)}</dd>
                   <dt>观</dt><dd>${escapeHtml(e.view)}</dd>
                 </dl>
                 <button class="delete" data-action="delete" data-id="${escapeHtml(e.id)}">删去这一条</button>
               </li>`
             )
             .join("")}
         </ul>`
      : `<div class="empty">
           <p>这里还没有东西。</p>
           <p>记不是账本——它只是把看见过的，留个影子。</p>
         </div>`;

    app.innerHTML = `
      <div class="view">
        <p class="eyebrow">记 · ${entries.length} 条</p>
        ${listHtml}
        ${actionsHtml}
      </div>`;
  }

  // ---------- 渲染入口 ----------

  function render() {
    if (state.loadError) {
      app.innerHTML = `
        <div class="view empty">
          <p>题库没有加载出来。</p>
          <p>如果你是在本地双击打开的，浏览器会拦截读取 JSON 的请求。</p>
          <p>在这个目录下运行 <code>node scripts/serve.mjs</code>，<br>
             然后访问 <code>http://localhost:4173</code>。</p>
        </div>`;
      return;
    }

    if (state.view === "kan") renderKan();
    else if (state.view === "guan") renderGuan();
    else renderJi();

    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.view === state.view;
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  // ---------- 勘：行为 ----------

  function nextQuestion() {
    const n = state.questions.length;
    if (n === 0) return;

    let idx = state.questionIndex;
    if (n === 1) {
      idx = 0;
    } else {
      while (idx === state.questionIndex) {
        idx = Math.floor(Math.random() * n);
      }
    }

    state.questionIndex = idx;
    state.picked = null;
  }

  function pickOption(index) {
    if (state.picked !== null) return;
    if (!Number.isInteger(index)) return;
    if (index < 0 || index >= state.questions[state.questionIndex].options.length) return;

    state.picked = index;
    render();

    requestAnimationFrame(() => {
      document.querySelector(".develop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ---------- 观：行为 ----------

  function syncGuanInput() {
    const input = document.getElementById("guan-input");
    if (!input) return;
    state.guan[input.dataset.key] = input.value;
  }

  function guanNext() {
    syncGuanInput();
    if (!state.guan[GUAN_STEPS[state.guanStep].key].trim()) {
      document.getElementById("guan-input")?.focus();
      return;
    }
    if (state.guanStep < GUAN_STEPS.length - 1) {
      state.guanStep += 1;
      render();
    }
  }

  function guanPrev() {
    syncGuanInput();
    if (state.guanStep > 0) {
      state.guanStep -= 1;
      render();
    }
  }

  function guanSave() {
    syncGuanInput();

    const lastKey = GUAN_STEPS[GUAN_STEPS.length - 1].key;
    if (!state.guan[lastKey].trim()) {
      document.getElementById("guan-input")?.focus();
      return;
    }

    const entry = {
      id: uid(),
      createdAt: Date.now(),
      event: state.guan.event.trim(),
      thought: state.guan.thought.trim(),
      self: state.guan.self.trim(),
      view: state.guan.view.trim()
    };

    store.entries.push(entry);
    persist();
    state.entries = store.entries.slice().reverse();

    // 存下之后清空，下一次是新的开始
    state.guan = { event: "", thought: "", self: "", view: "" };
    state.guanStep = 0;
    state.view = "ji";
    render();

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function guanReset() {
    state.guan = { event: "", thought: "", self: "", view: "" };
    state.guanStep = 0;
    render();
  }

  // ---------- 记：行为 ----------

  function deleteEntry(id) {
    store.entries = store.entries.filter((e) => e.id !== id);
    persist();
    state.entries = store.entries.slice().reverse();
    render();
  }

  function exportEntries() {
    const lines = ["# 如是观 · 记", ""];

    state.entries.forEach((e) => {
      lines.push(`## ${formatDate(e.createdAt)}`);
      lines.push("");
      lines.push(`- **事**：${e.event}`);
      lines.push(`- **念**：${e.thought}`);
      lines.push(`- **我**：${e.self}`);
      lines.push(`- **观**：${e.view}`);
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `如是观-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- 事件 ----------

  document.querySelector(".masthead").addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (!tab) return;

    const view = tab.dataset.view;
    if (!view || view === state.view) return;

    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
      case "pick":
        pickOption(Number(target.dataset.index));
        break;
      case "next-question":
        nextQuestion();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "goto-guan":
        state.view = "guan";
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "guan-next":
        guanNext();
        break;
      case "guan-prev":
        guanPrev();
        break;
      case "guan-save":
        guanSave();
        break;
      case "guan-reset":
        guanReset();
        break;
      case "delete":
        deleteEntry(target.dataset.id);
        break;
      case "export":
        exportEntries();
        break;
    }
  });

  // 输入时实时同步，避免切步骤丢字
  app.addEventListener("input", (event) => {
    if (event.target.id === "guan-input") {
      state.guan[event.target.dataset.key] = event.target.value;
    }
  });

  // Ctrl/Cmd + Enter 进入下一步或保存
  app.addEventListener("keydown", (event) => {
    if (event.target.id !== "guan-input") return;
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;

    event.preventDefault();
    if (state.guanStep === GUAN_STEPS.length - 1) guanSave();
    else guanNext();
  });

  // ---------- 启动 ----------

  async function init() {
    store = loadStore();
    state.entries = store.entries.slice().reverse();

    try {
      state.questions = await loadQuestions();
      nextQuestion();
    } catch (err) {
      console.warn("题库加载失败：", err);
      state.loadError = err;
    }

    render();
  }

  init();
})();

#!/usr/bin/env node
/**
 * 题库校验
 *
 * 零依赖。用法：
 *   node scripts/validate.mjs
 *
 * 退出码：0 = 通过，1 = 有错误
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, "../data/questions.json");
const sutrasPath = resolve(here, "../data/sutras.json");

const errors = [];
const warnings = [];

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function fail(where, message) {
  errors.push(`${where}  ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}  ${message}`);
}

function checkQuestion(q, index) {
  const at = `questions[${index}]`;

  if (!isPlainObject(q)) {
    fail(at, "不是对象");
    return;
  }

  if (!isNonEmptyString(q.id)) {
    fail(`${at}.id`, "缺少 id");
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id)) {
    warn(`${at}.id`, `「${q.id}」建议使用小写 kebab-case`);
  }

  if (!isNonEmptyString(q.scene)) fail(`${at}.scene`, "缺少场景描述");
  else if (q.scene.length > 220) warn(`${at}.scene`, `偏长（${q.scene.length} 字），手机端会占满屏幕`);

  if (!isNonEmptyString(q.prompt)) fail(`${at}.prompt`, "缺少提问");

  if (!Array.isArray(q.options) || q.options.length < 2) {
    fail(`${at}.options`, "至少需要 2 个选项");
  } else {
    if (q.options.length > 6) warn(`${at}.options`, `选项过多（${q.options.length} 个）`);

    q.options.forEach((opt, j) => {
      const oat = `${at}.options[${j}]`;
      if (!isPlainObject(opt)) {
        fail(oat, "不是对象");
        return;
      }
      if (!isNonEmptyString(opt.text)) fail(`${oat}.text`, "缺少选项文字");
      if (!isNonEmptyString(opt.note)) fail(`${oat}.note`, "缺少显影说明");
      else if (opt.note.length < 20) warn(`${oat}.note`, "显影说明过短，可能只是评判而非照见");
    });
  }

  if (!isNonEmptyString(q.coda)) fail(`${at}.coda`, "缺少收尾一问");

  if (q.sutra === undefined) {
    warn(`${at}.sutra`, "没有配经文，显影之后会少一层「佛怎么说」");
  } else if (!isPlainObject(q.sutra)) {
    fail(`${at}.sutra`, "应为对象 { quote, source, reading }");
  } else {
    if (!isNonEmptyString(q.sutra.quote)) fail(`${at}.sutra.quote`, "缺少经文原句");
    if (!isNonEmptyString(q.sutra.source)) fail(`${at}.sutra.source`, "缺少出处");
    if (!isNonEmptyString(q.sutra.reading)) fail(`${at}.sutra.reading`, "缺少解读");
  }
}

async function validateSutras() {
  let raw;
  try {
    raw = await readFile(sutrasPath, "utf8");
  } catch (err) {
    fail("sutras.json", `无法读取：${err.message}`);
    return { themes: 0, entries: 0 };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail("sutras.json", `JSON 解析失败：${err.message}`);
    return { themes: 0, entries: 0 };
  }

  if (!isPlainObject(data) || !Array.isArray(data.themes)) {
    fail("sutras.themes", "必须是数组");
    return { themes: 0, entries: 0 };
  }

  const ids = new Set();
  let entries = 0;

  data.themes.forEach((theme, i) => {
    const at = `themes[${i}]`;

    if (!isPlainObject(theme)) {
      fail(at, "不是对象");
      return;
    }

    if (!isNonEmptyString(theme.id)) fail(`${at}.id`, "缺少 id");
    else if (ids.has(theme.id)) fail(`${at}.id`, `id 重复：${theme.id}`);
    else ids.add(theme.id);

    if (!isNonEmptyString(theme.title)) fail(`${at}.title`, "缺少标题");
    if (!isNonEmptyString(theme.note)) fail(`${at}.note`, "缺少导语");

    if (!Array.isArray(theme.entries) || theme.entries.length === 0) {
      fail(`${at}.entries`, "至少需要一条经文");
      return;
    }

    theme.entries.forEach((e, j) => {
      const oat = `${at}.entries[${j}]`;
      entries += 1;

      if (!isPlainObject(e)) {
        fail(oat, "不是对象");
        return;
      }
      if (!isNonEmptyString(e.quote)) fail(`${oat}.quote`, "缺少经文原句");
      if (!isNonEmptyString(e.source)) fail(`${oat}.source`, "缺少出处");
      if (!isNonEmptyString(e.reading)) fail(`${oat}.reading`, "缺少解读");
      if (!isNonEmptyString(e.explain)) fail(`${oat}.explain`, "缺少义理解说");

      if (!Array.isArray(e.examples) || e.examples.length === 0) {
        fail(`${oat}.examples`, "至少需要一个生活例子");
      } else {
        e.examples.forEach((ex, k) => {
          if (!isNonEmptyString(ex)) fail(`${oat}.examples[${k}]`, "例子为空");
        });
      }

      if (!isNonEmptyString(e.practice)) fail(`${oat}.practice`, "缺少怎么练");
    });
  });

  return { themes: data.themes.length, entries };
}

async function main() {
  let raw;
  try {
    raw = await readFile(dataPath, "utf8");
  } catch (err) {
    console.error(`\n无法读取 ${dataPath}\n${err.message}\n`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`\nJSON 解析失败：${err.message}\n`);
    process.exit(1);
  }

  if (!isPlainObject(data)) {
    console.error("\n顶层应为一个对象：{ version, updated, questions }\n");
    process.exit(1);
  }

  if (typeof data.version !== "number") fail("version", "缺少数字版本号");
  if (!Array.isArray(data.questions)) {
    fail("questions", "必须是数组");
  }

  if (Array.isArray(data.questions)) {
    if (data.questions.length === 0) fail("questions", "题库为空");

    const seen = new Set();
    data.questions.forEach((q, i) => {
      checkQuestion(q, i);
      if (isPlainObject(q) && isNonEmptyString(q.id)) {
        if (seen.has(q.id)) fail(`questions[${i}].id`, `id 重复：「${q.id}」`);
        seen.add(q.id);
      }
    });
  }

  const qCount = Array.isArray(data.questions) ? data.questions.length : 0;
  const oCount = Array.isArray(data.questions)
    ? data.questions.reduce((n, q) => n + (Array.isArray(q?.options) ? q.options.length : 0), 0)
    : 0;
  const sutraStats = await validateSutras();

  console.log("");
  console.log(`  题库：${qCount} 题，${oCount} 个选项`);
  console.log(`  经文：${sutraStats.themes} 组，${sutraStats.entries} 条`);
  console.log(`  版本：v${data.version ?? "?"}　更新：${data.updated ?? "未标注"}`);
  console.log("");

  if (warnings.length) {
    console.log(`  提醒（${warnings.length}）：`);
    warnings.forEach((w) => console.log(`    · ${w}`));
    console.log("");
  }

  if (errors.length) {
    console.error(`  错误（${errors.length}）：`);
    errors.forEach((e) => console.error(`    ✕ ${e}`));
    console.error("");
    process.exit(1);
  }

  console.log("  校验通过。\n");
}

main();

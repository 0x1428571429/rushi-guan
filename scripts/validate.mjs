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

  console.log("");
  console.log(`  题库：${qCount} 题，${oCount} 个选项`);
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

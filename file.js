/* eslint-disable quotes */
/* eslint-disable no-cond-assign */
/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-escape */
const fs = require("fs");
const path = require("path");
const promisify = require("util").promisify;

const readdir = AsyncFn(fs.readdir);
const stat = AsyncFn(fs.stat);
const open = promisify(fs.open);
const read = promisify(fs.read);

function compose(...fns) {
  if (fns.length == 0) return (args) => args;
  if (fns.length == 1) return fns[0];
  return fns.reduce((a, b) => (...args) => a(b(...args)));
}
function AsyncFn(fn) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      const hookFn = (err, result) => {
        if (err) reject(err);
        resolve(result);
      };
      fn.call(null, ...args, hookFn);
    });
  };
}

function* initGenerator(count, fn = (param) => param) {
  for (let i = 0; i < count; i++) {
    if (fn.constructor.name == "GeneratorFunction") yield* fn(i);
    else yield fn(i);
  }
}

// 语言匹配正则配置
function matchReg(name = "chinese") {
  switch (name) {
    case "chinese":
      return /(([\u4e00-\u9fa5].*[\u4e00-\u9fa5])|[\u4e00-\u9fa5])/g;
    default:
      return null;
  }
}

// 语言匹配转义
function partMatchFn(matchPattern) {
  const matchStr = String(matchPattern);
  return /\/(.+)\//.exec(matchStr)[1];
}

// 去掉尖括号注释
function arrowNote(files) {
  const noteMap = new Map();
  const arrows = files.match(/\<\!\-\-[\s\S]+?\-\-\>/g);
  let newFiles = files;
  if (arrows) {
    for (let i = 0; i < arrows.length; i++) {
      const note = arrows[i];
      newFiles = newFiles.replace(note, `$%${i}%$`);
      noteMap.set(`$%${i}%$`, note);
    }
  }
  return { files: newFiles, noteMap };
}
// 提取vue视图 templete
function vueTemplete({ files, noteMap }) {
  const vueFiles = files.match(/\<template\>[\s\S]+\<\/template\>/g)[0];
  return {
    vueFiles,
    noteMap,
  };
}
// 所有需要国际化字段
function il8nField(matchPattern) {
  return (files) => {
    return files.match(matchPattern);
  };
}
// 国际化字段去重
function noRepeate(files) {
  return [...new Set(files)];
}
// 生成字段表的映射Key
function generateMapKey(variableFn) {
  return (values) => {
    const keys = [...initGenerator(values.length, variableFn)];
    return { keys, values };
  };
}
// 国际化字段映射表 value => key
function il8nReverseMapFn({ keys, values }) {
  const map = new Map();
  for (let i = 0; i < keys.length; i++) {
    map.set(values[i], keys[i]);
  }
  return map;
}
// 函数路径模式 $t(x-y-z.val,origin)
function generatePattern(fnName, ...fnParam) {
  return (il8nName) => {
    return `${fnName}('${fnParam.join("-")}.${il8nName}')`;
  };
}

// 动态属性替换
function attrReplace(matchPattern, partMatch) {
  return ({ vueFiles, il8nReverseMap, fnPattern }) => {
    const reg = eval('/\\S+\\"' + partMatch + '.*?\\"/g');
    const dynamicAttr = vueFiles.match(reg);
    if (dynamicAttr && dynamicAttr.length) {
      for (const attr of dynamicAttr) {
        const name = attr.match(matchPattern)[0];
        const il8n = il8nReverseMap.get(name);
        const replaceName = attr.replace(matchPattern, fnPattern(il8n));
        vueFiles = vueFiles.replace(attr, `:${replaceName}`);
      }
    }
    return { vueFiles, fnPattern, il8nReverseMap };
  };
}
// 内容匹配
function matchContent(partMatch) {
  return ({ vueFiles, fnPattern, il8nReverseMap }) => {
    const reg = eval("/[\\s\\>]" + partMatch + "[\\s\\<]/g");
    let content = null;
    const contents = [];
    while ((content = reg.exec(vueFiles)) != null) {
      contents.push(content[1]);
    }
    return { vueFiles, contents, fnPattern, il8nReverseMap };
  };
}
// 内容替换
function contentReplace({ vueFiles, contents, fnPattern, il8nReverseMap }) {
  if (contents && contents.length) {
    for (const content of contents) {
      const il8n = il8nReverseMap.get(content);
      vueFiles = vueFiles.replace(content, `{{ ${fnPattern(il8n)} }}`);
    }
  }
  return vueFiles;
}
// 注释内容恢复
function noteRestore(noteMap) {
  return (vueFiles) => {
    if (noteMap.size) {
      for (const note of noteMap) {
        vueFiles = vueFiles.replace(note[0], note[1]);
      }
    }
    return vueFiles;
  };
}

// 替换原来templete
function updateOrigin(newTemplete, file) {
  return file.replace(/\<template\>[\s\S]+\<\/template\>/, newTemplete);
}

// 读取vue文件
function readVueFile(path, fileDir, language, variableFn) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, files) => {
      const matchPattern = matchReg(language);
      if (!matchPattern) err("没有对应的匹配规则");
      const partMatch = partMatchFn(matchPattern);
      const { vueFiles, noteMap } = compose(vueTemplete, arrowNote)(files);
      const il8nReverseMap = compose(
        il8nReverseMapFn,
        generateMapKey(variableFn),
        noRepeate,
        il8nField(matchPattern)
      )(vueFiles);
      const fnPattern = generatePattern("$t", ...fileDir);
      const completeVueFiles = compose(
        noteRestore(noteMap),
        contentReplace,
        matchContent(partMatch),
        attrReplace(matchPattern, partMatch)
      )({ vueFiles, il8nReverseMap, fnPattern });
      const finalFile = updateOrigin(completeVueFiles, files);
      resolve({ finalFile, il8nReverseMap });
    });
  });
}
// 获取所有文件路径
async function getFileAllPath(filePath, callback) {
  try {
    let files = await readdir(filePath);
    files = files.map(async (filename) => {
      const filedir = path.join(filePath, filename);
      const stats = await stat(filedir);
      if (stats.isFile()) callback && callback(filedir);
      if (stats.isDirectory()) await getFileAllPath(filedir, callback);
    });
    return Promise.all(files);
  } catch (error) {
    console.warn(error);
  }
}
// 筛选出vue文件
async function filterVueFile(range) {
  const dirList = [];
  let searchRange = [];
  if (range.length) {
    for (const r of range) {
      searchRange.push(path.join(r));
    }
  }
  await getFileAllPath(path.resolve(__dirname, "src"), (dir) => {
    let flag = false;
    if (searchRange.length) {
      for (const promiseDir of searchRange) {
        flag = dir.indexOf(promiseDir) > -1;
        if (flag) break;
      }
    } else {
      flag = true;
    }
    if (flag && path.extname(dir) == ".vue") dirList.push(dir);
  });
  return dirList;
}

// 通过首行标识，获取需要的文件
async function _isIl8nFile(path, il8nTag) {
  const fd = await open(path, "r+");
  const readLen = il8nTag.length;
  const readOptions = {
    buffer: Buffer.alloc(readLen),
    position: 0,
    length: readLen,
  };
  const { buffer } = await read(fd, readOptions);
  return buffer.toString() == il8nTag;
}

// 筛选出带标识的文件
async function filterTagFile(dirList, tag) {
  let dirs = [];
  for (const dir of dirList) {
    const result = await _isIl8nFile(dir, tag);
    result && dirs.push(dir);
  }
  return dirs;
}

// 需要映射的文件目录
function pathJoin(il8nFileDir, paths) {
  const levels = [];
  for (const p of paths) {
    levels.push(path.join(p));
  }
  return { il8nFileDir, levels };
}

// 国际化配置目录映射
function il8nDirMap({ il8nFileDir, levels }) {
  let configPath = [];
  for (const level of levels) {
    const ansLevel = il8nFileDir.map((dir) => {
      const index = dir.indexOf(level);
      if (index > -1) {
        return dir.slice(index);
      }
      return null;
    });
    configPath = configPath.concat(ansLevel.filter((a) => a));
  }
  return configPath;
}

// 生成国际化配置文件目录
function generateConfigDir(rootDirName, languageCategory) {
  return (configPath) => {
    const configDirMap = new Map();
    const relatives = [];
    for (const p of configPath) {
      const relative = path.dirname(p);
      const basename = path.basename(p, ".vue");
      relatives.push(`${relative}\\${basename}`);
      for (const language of languageCategory) {
        const absolute = path.resolve(rootDirName, language, relative);
        if (!configDirMap.has(relative)) configDirMap.set(relative, [absolute]);
        else
          configDirMap.set(
            relative,
            configDirMap.get(relative).concat([absolute])
          );
        fs.mkdirSync(absolute, { recursive: true }, (err) => {
          if (err) throw err;
        });
      }
    }
    return { configDirMap, relatives, languageCategory, rootDirName };
  };
}
// 生成配置入口文件
function generateConfigEntry(configEntryFileName) {
  return ({ configDirMap, relatives, languageCategory, rootDirName }) => {
    const keys = relatives.map((r) => r.split("\\").join("-"));
    const values = relatives.map((r) => r.split("\\").join("/"));
    let entryObj = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = values[i];
      entryObj[key] = `require('./${val}.js')`;
    }
    entryObj = JSON.stringify(entryObj, null, " ");
    const valArr = entryObj.match(/\"require.+\"/g);
    for (let i = 0; i < valArr.length; i++) {
      const val = valArr[i];
      entryObj = entryObj.replace(val, val.slice(1, -1));
    }
    for (const language of languageCategory) {
      const absolute = path.resolve(rootDirName, language);
      const writePath = `${absolute}\\${configEntryFileName}.js`;
      const content = `module.exports = ${entryObj}`;
      fs.writeFile(writePath, content, (err) => {
        if (err) console.warn("配置入口文件写入失败");
      });
    }
    return configDirMap;
  };
}
// 提取映射配置路径
function extractDir(configDirMap, dir) {
  for (const map of configDirMap) {
    if (dir.indexOf(map[0]) > -1) {
      const fileName = path.basename(dir, ".vue");
      const fileDir = map[0].split("\\").concat([fileName]);
      return {
        fileDir,
        mapDir: map[1],
        fileName,
      };
    }
  }
}
// map转换JSON格式化
function mapToJSON(il8nReverseMap) {
  return (obj) => {
    const json = {};
    if (il8nReverseMap.size) {
      for (const map of il8nReverseMap) {
        json[map[1]] = map[0];
      }
    }
    return {
      ...obj,
      jsonConfig: JSON.stringify(json, null, "\t"),
      il8nReverseMap,
    };
  };
}
// 写入映射
function wirteJSONConfig({ mapDir, fileName, jsonConfig }) {
  const content = `module.exports = ${jsonConfig}`;
  for (const dir of mapDir) {
    fs.writeFile(`${dir}\\${fileName}.js`, content, { flag: "w+" }, (err) => {
      if (err) console.warn("配置文件写入失败");
    });
  }
}

// 处理文件
async function handleVueFile(il8nFileDir, callback) {
  for (const dir of il8nFileDir) {
    await callback(dir);
  }
}

function _insertNote(file, il8nReverseMap) {
  let tempFile = file;
  for (const map of il8nReverseMap) {
    let content = [];
    const reg = eval("/\\((\\'.*" + map[1] + ".*\\')\\)/g");
    while ((content = reg.exec(file)) != null) {
      const note = `(${content[1]}, '${map[0]}')`;
      tempFile = tempFile.replace(content[0], note);
    }
  }
  return tempFile;
}

// 添加语言映射注释
function addMapNote({
  finalFile,
  jsonConfig,
  mapNote,
  il8nReverseMap,
  ...obj
}) {
  if (mapNote == "end") {
    finalFile = `${finalFile}
<!--
${jsonConfig}
-->`;
  }
  if (mapNote == "func") {
    finalFile = _insertNote(finalFile, il8nReverseMap);
  }
  return {
    content: finalFile,
    ...obj,
  };
}
// 替换语言标识
function replaceTag(il8nTag, completeTag) {
  return ({ content, ...obj }) => {
    content = content.replace(il8nTag, completeTag);
    return {
      content,
      ...obj,
    };
  };
}

// 写入vue文件
function writeVueFile({ dir, content }) {
  fs.writeFile(dir, content, (err) => {
    if (err) console.warn("文件写入失败");
  });
}

async function entry() {
  // config
  const il8nTag = "<!-- il8n -->"; // 需要转换的文件首行标识
  const completeTag = "<!-- complete -->"; // 转换完成首行标识
  const rootDirName = "il8n"; // 配置文件，根目录命名
  const language = "chinese"; // 选择翻译语言,配置函数matchReg
  const configEntryFileName = "entry"; // 配置文件入口文件名
  const languageCategory = ["zh", "en"]; // 语言种类
  const searchRange = ["views", "components"]; // 文件扫描范围
  /**
   * 替换变量名生成
   * @function 普通函数
   * @generate 生成器函数
   */
  const variableFn = (i) => `il8n_${i}`;
  /**
   * @option1 func 函数体里面添加$t(xxx, name)
   * @option2 end 文件末尾添加映射注释
   * @option3 no 不需要注释
   */
  const mapNote = "func";

  // 筛选范围内所有vue文件
  const vueFileDir = await filterVueFile(searchRange);
  // 筛选标识内所有vue文件
  const il8nFileDir = await filterTagFile(vueFileDir, il8nTag);
  if (!il8nFileDir.length) {
    console.warn("请加头部标识，没有检测到要翻译的文件");
    return;
  }
  // 生成配置目录
  const configDirMap = compose(
    generateConfigEntry(configEntryFileName),
    generateConfigDir(rootDirName, languageCategory),
    il8nDirMap,
    pathJoin
  )(il8nFileDir, searchRange);
  // 处理文件
  handleVueFile(il8nFileDir, async (dir) => {
    const { fileDir } = extractDir(configDirMap, dir);
    // 提取文件转换结果
    const { finalFile, il8nReverseMap } = await readVueFile(
      dir,
      fileDir,
      language,
      variableFn
    );
    // 写入JSON配置
    compose(
      wirteJSONConfig,
      mapToJSON(il8nReverseMap),
      extractDir
    )(configDirMap, dir);
    // 写入vue文件
    compose(
      writeVueFile,
      replaceTag(il8nTag, completeTag),
      addMapNote,
      mapToJSON(il8nReverseMap)
    )({
      dir,
      finalFile,
      mapNote,
    });
  });
}
entry();

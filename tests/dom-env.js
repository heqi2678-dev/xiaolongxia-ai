/* 统一解析 jsdom：优先本地依赖，其次全局安装目录，使 `node --test tests/*.test.js` 无需 NODE_PATH 也能跑。 */
let jsdom;
try {
  jsdom = require("jsdom");
} catch (e) {
  const { execSync } = require("child_process");
  const globalRoot = execSync("npm root -g").toString().trim();
  jsdom = require(require.resolve("jsdom", { paths: [globalRoot] }));
}
module.exports = { JSDOM: jsdom.JSDOM, VirtualConsole: jsdom.VirtualConsole };

# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

## 2026-10-07 依賴升版(dompurify、highlight.js、jsdom、katex、marked、marked-katex-extension、wsemi)

### 升版判斷

- ncu 之建議不可直接照升:先查擴充套件之 peerDependencies(`npm view marked-katex-extension peerDependencies`),再於專案複本以 `npm install --package-lock-only` 驗證能否解析.本次 katex `^0.19.0` 即因 marked-katex-extension 5.1.13 之 peer `katex <0.19` 而 ERESOLVE.
- npm 解析範圍時會避開 deprecated 版本(`^0.18.2` 解析為 0.18.10,而非 deprecated 之 0.18.11);但 lockfile 內已存在且滿足範圍之版本會被保留.驗證解析須從原始 lockfile 或無 lockfile 起算,不可沿用已被試驗污染之 lockfile.
- 0.x 套件之 minor 等同 major(katex 0.17、0.18、0.19 皆有 BREAKING),patch 也可能偷渡破壞性變更(katex 0.18.11 因此被官方 deprecate,其內容後來以 0.19.0 重發).
- 判斷兩版是否實質相同:`npm pack <pkg>@<a> <pkg>@<b>` 解壓後,去除版本字串再 diff dist.本次證實 katex 0.19.0 與 0.18.11 之程式與 CSS 相同.
- 現行 caret 宣告於全新安裝時本就會取得新版(如 marked `^18.0.6` 會裝到 18.1.0),本機 lockfile 會遮蔽此事;評估行為差異以全新解析為準.
- jsdom 之破壞性變更多為 Node 下限;本專案 DOM 用法不受 API 影響,真正要查的是 Node 端轉換之部署環境版本(jsdom 30 須 `^22.22.2 || ^24.15.0 || >=26.0.0`).
- 套件輸出 HTML 又引用 CDN CSS 者,升版時必查 CSS 與 class 是否同步;逐字比對測試只會顯示 class 差異,看不出畫面跑版,須以真瀏覽器量測確認.

### 變更日誌與漏洞來源

- jsdom 倉庫已無 Changelog.md,改用 GitHub Releases API(`https://api.github.com/repos/jsdom/jsdom/releases`);KaTeX 用 raw `CHANGELOG.md`;marked、dompurify、marked-katex-extension 用各自之 releases API.
- `npm audit --omit=dev` 只看 runtime 樹,可直接看出升版清掉哪些 advisory(本次清掉 katex、dompurify、經 jsdom 之 undici 7、經 jsdom→css-tree 之 source-map-js).
- transitive 漏洞之修正版若仍在上游宣告範圍內(source-map-js 1.2.2 落在 css-tree `^1.2.1`),`npm update <pkg>` 刷新 lockfile 即可,不必改 package.json.

### 驗證手法

- 於 `./tmp/` 建專案複本實裝新版(複製 src、test、toolg、package.json、package-lock.json 後 `npm install --prefix <dir>`),不動本體;`npm test --prefix <dir>` 之 cwd 即為該目錄.
- 打包驗證不動專案 dist:複製 src、toolg、babel.config.js、package.json 至 `./tmp/build-check/`,以 `process.chdir` 後動態 import `toolg/gDistRollup.mjs`;模組解析會往上找到專案根之 node_modules.
- `test/reportTrue.html` 逐字比對失敗時,逐行再以標籤切 token 列出差異,以正規化(去 `katex-` 前綴、換版號)證明差異僅限預期項目後才重產.
- 新裝套件後第一次跑測試可能極慢(本次首條 14 秒,平常 1.6 秒),屬冷啟動;以專用量測腳本重複量測後再下結論,不要當成效能退化.
- KaTeX 渲染是否正確用真瀏覽器量:上標 `.msupsub .mtight` 之 fontSize 應為本文之 0.7 倍,`.katex-base` 之 display 應為 inline-block.跨來源樣式表讀 `cssRules` 會 SecurityError,改量套用效果(`.katex` 之 fontFamily 含 KaTeX_Main).
- Playwright 不在本專案依賴內:可以 `pathToFileURL` 動態 import `C:/opensrc/開源-JS-004-5-w-screenctl/w-screenctl/node_modules/playwright/index.mjs`(1.63.0),chromium 已在 `%LOCALAPPDATA%/ms-playwright`.
- 取已安裝版本:dompurify 之 exports 未開放 package.json(require 會 ERR_PACKAGE_PATH_NOT_EXPORTED),改以 fs 讀 `node_modules/dompurify/package.json`;katex 之 exports 有 `./*`,可 `require('katex/package.json')`.
- 下游 bundler 相容性:以 acorn 對各套件 ESM 入口逐一嘗試 ecmaVersion,比較新舊版所需最低語法版本(本次皆未提高).
- 本 shell 之 `rg` 為環境提供之別名,寫進文件之盤點指令改用 `git grep --untracked`.

### 下游與周邊

- 以 src 匯入 md2html 之下游:主系統 `PanelMd.vue`、w-web-api `src/components/MdPanel.vue`(只用 `res.html`,不載 styleSrcs);Node 端轉換(會載入 jsdom):w-md2docx、主系統 `genDocx_R00.01.mjs`.兄弟專案位於 `C:\opensrc\開源-JS-008-4-w-html2docx`、`開源-JS-008-6-w-md2docx`、`開源-JS-411-8-w-web-api`,其原始碼無 KaTeX 內部 class 選擇器.
- w-web-api 之 spec 依賴 md2html「會剝 onerror / javascript: / <script>」之保證,已由 `test/unit-md2html-deps.test.mjs` 鎖住.
- `<docx_br>` 為已廢止語法(見 sgud/rule/rulebook.md R-SYNTAX-01),舊內容若殘留,marked 18.1.0 起會以字面文字顯示.
- `test/reportTrue.html` 本即混用換行,git 之 LF/CRLF 警告為既有且無害(blob 已含 CRLF,checkout 不轉換).

## 2026-10-10 評估下游之 `建議w-md2docx擴充.md`(圖名表名與圖表同頁)

- 下游 docx 之分頁保護在 w-md2docx `src/docxToc.mjs` 之 `prepDocxToc`(keepLines、keepWithObject,1.0.12 起,僅於 toc 開啟且文件有標題時套用);圖名表名以段首「標籤＋編號＋空白」判斷,圖表與其名須相鄰(之間只容空白或書籤).
- w-md2html 之 `<div data-for="br"></div>` 經 w-html2docx 移除零寬佔位後成為真正之空段落(`srcPython/htmlToDocx.py` 移除 U+200B 段);若夾在圖表與圖表名之間,w-md2docx 會判為不相鄰而不套保護.
- 表名之「與下段同頁」來自 md 作者手寫之 `page-break-after:avoid`(經 Word 匯入轉為 keepNext),w-md2html 與 w-html2docx 皆未自動加;圖片段無任何保護.
- w-html2docx 轉檔器之圖片最大高度預留圖名空間為版心高之 0.937 倍(`htmlToDocx.py`),另以 `imgRatioHeightMax` 縮放.
- 對標:pandoc 預設 docx 樣式(`https://raw.githubusercontent.com/jgm/pandoc/main/data/docx/word/styles.xml`)之「Table Caption」與「Captioned Figure」皆帶 keepNext、「Image Caption」不帶,隨樣式一律套用、與目錄無關.
- w-md2docx 所附樣板 `src/templates/temp_tpc.docx` 之 heading 1~9 樣式皆帶 keepNext、皆不帶 keepLines(2026-10-10 實測);曾憑印象以為兩者皆有,寫進文件前須實測.
- 本套件無須配合修改:分頁屬性屬 docx 層,由 w-md2docx 以純 XML 處理即可,不在 HTML 層重複實作圖表名之辨識規則.

## 2026-10-11 清洗移除使用者內容中之 `<style>`(下游 rddmanager 之 `建議w-md2html修正.md`)

- DOMPurify 預設允許 `<style>` 且不檢查其中之 CSS;md2html 輸出外包 `<div class="md">`,故即使 `<style>` 在 markdown 開頭也不會被解析器移到 head 而保留,置入頁面後作用於整頁.`FORBID_TAGS: ['style']` 移除元素後,其內容依預設 `FORBID_CONTENTS`(含 style,`purify.es.mjs` 之 `DEFAULT_FORBID_CONTENTS`)一併捨棄,不會外漏為文字.
- 外層 `contain:layout` 只讓區塊成為 fixed 子元素之定位基準,不裁切:style 屬性之 `position:fixed` 遮罩仍會蓋住區塊右方與下方之其他區塊;`contain: layout paint` 才裁切.w-web-api `MdPanel.vue` 以 `.md >>> .md { contain: none !important }` 解除外層 containment,該處遮罩可蓋滿視窗(見 sgud/rule/rulebook.md R-SANITIZE-01).
- 寫斷言時注意套件自身之 styleDef 含 `background: #eee` 等(冒號後有空白),比對使用者 CSS 須用完整字串(如 `background:red`),不可只比 `background`.
- 確認修法是否進入打包產物:bundle 壓縮後為單行,`grep -c` 計行數無意義,改搜具體設定字串(如 `FORBID_TAGS:["style"]`).
- 修正前後之瀏覽器對照:以專案根之範例頁(載入尚未重建之 `dist`)為修正前、以 `./tmp/build-check` 新打包者為修正後,同一腳本各跑一次.
- 以 sed 對 CRLF 原始檔產生複本會轉為 LF,`diff` 顯示全檔不同;比對語意差異用 `diff --strip-trailing-cr`.

## 2026-10-24~25 圖題與 `<img>` 同行時內文 `{圖名}` 不取代(下游 rddmanager 之 `建議w-md2html修正.md`)

- 成因:`cvItemNum` 逐行以 wsemi `html2str`(底層 html-to-text)取整行純文字當圖表名;html-to-text 把 `<img>` 轉為「alt [src]」文字(`formatImage`:無 src 只輸出 alt),單行寫法的圖名因而夾帶 `[pics/a.png]`.重現不必起服務:`WMd2html` 吃 md 檔路徑,一份含單行/多行圖區塊與 `{圖名}` 內文的 md,`imgConvertToBase64:false` 仍會跑 `cvPicB64`(逐行 `src="` 就讀檔,不存在即丟錯),故夾具須備真圖檔(1x1 png 即可);要避開讀檔就用 `src=x`(不帶雙引號).
- 修法擁有者:`html2str` 是通用函式、其對 `<img>` 之行為屬設計,不改 wsemi;「圖題文字」之語意屬本套件,故在 `WMd2html` 取名前先移除**有 src 且非空**之 `<img>`.**守則:修 bug 的範圍限定在「修前必定出錯」那一類輸入,其餘路徑要能證明與修前逐字相同**.先前試過的每一項「順手清理」都被外審抓到會改變修前已可解析之輸出:`html2str` 後 `slice` 到「圖n」位置(丟掉 `補充：圖n 名` 之前綴、多區塊名 `{前文⏎ 甲}`)、一併移除 svg(圖名在 svg 內)、移除無 src 或 src 為空之 img(`<img alt="圖n 甲" src=''>` 之 alt 本是圖題文字)、一律清除空連結(原本就空之連結要保留其 href 文字).證明「逐字相同」有兩招:程式上讓沒有移除任何 img 的行走同一條路徑(`rm` 旗標);另以差異對照腳本把修前複本與現行 src 對同一份 md 轉換、整份輸出 html 逐字比對(`diff-old-new.mjs`,21 種寫法).
- 取名細節(皆來自外審):①不能用 `/<img\b[^>]*>/` 或 `/\ssrc\s*=/.test(整個標籤)`——屬性值可含 `>`、alt 值內可含「 src=」、其他標籤屬性值或註解內可含「<img」;改以「註解或標籤」為單位由左而右掃描(`/<!--[\s\S]*?(?:-->|$)|<(名)(屬性,引號感知)>/g`),`getAttr` 逐屬性解析.②HTML 空白只有 `[ \t\n\f\r]`,JS 的 `\s` 含 U+00A0(`<img alt="…"`+NBSP+`src=x>` 對解析器不是 src 屬性);無引號屬性值到空白或 `>` 為止(可含 `=`);重複屬性取第一個.③移除 img 後留下的連結:html2str 對沒有文字的 `<a href>` 輸出 href,需一併移除,但只限「內容只剩空白/標籤/註解/被移除之圖片(至少一個)」者——用記號字元 `\u0001` 標示被移除位置再比對(舊作法一律清空連結會動到與圖片無關者).④移除後「圖n」若只剩在 img 或其他元素的屬性內,不可再登記(`{}` 會讓內文任何 `{}` 變成編號,或以他字覆寫真圖題):守門要看 html2str 後的純文字是否仍含「圖n」,不是看標籤字串;僅在有移除圖片時才守門,其餘行維持修前.該行仍佔用編號.
- 偵測殘留 `{…}`:**不要在 md 原文上做排除**——前三輪外審共 31 條,多數證明所有「用 token 或正規式在原文上排除程式碼」的作法都有洞:`marked.lexer` 預設未註冊 katex/footnote 擴充;`walkTokens` 收集之 token `raw` 與 md 文字不盡相同(引用/清單已去除 `> `/縮排前綴、表格內 `\|` 與連結 label 內 `\[` 已還原、CR 已正規化、圖片 alt 由自訂 renderer 直接取 `text` 不渲染 codespan、html 區塊範圍由 marked 判定);自 md 刪除會因相同文字出現於他處、短 raw 先刪破壞長 raw、刪後拼出原文不存在之字串而誤刪,逐 raw 全文掃描亦 O(KN);改「計次差」仍受兩側清理不對稱影響.**最終作法:改看輸出**——對寫檔前的最終 `h`(模板取代後)以 jsdom 解析:文字節點內 HTML 空白折疊為單一空白 → `code, pre, style, script, math, .katex, .katex-error` 以 `\n` 取代 → inline 白名單以外之元素前後插 `\n` → `textContent` 折疊連續空白後取 `{…}`.判準因而明確:「輸出的可見文字中仍殘留之 `{…}`」(逸出之 `\{x\}` 會列出、屬性值不列、軟換行折疊為空白).要在**模板取代後**判定:`replace(h,'{title}',title)` 會把內文的 `{title}` 也換掉,且 `{甲{title}乙}` 取代後才形成新的殘留.
- KaTeX 0.18 輸出結構(實測):`<span class="katex"><span class="katex-mathml"><math>…TeX 原文為 math 內之文字…</math></span><span class="katex-html">…顯示層…`;**顯示層含字面大括號**(`$\{x\}$` 的 `{x}`),所以 `.katex` 與 `math` 都要排除(只排除 `math` 不夠;使用者自寫之 MathML 也靠 `math`).未定義指令(`\badcmd`)是以紅字排版而非錯誤;**真正的 `.katex-error` 只在 ParseError**(如 `x_{1}_{2}` 雙下標、`\frac{a` 括號不成對),其文字是原始式.KaTeX 對 math 內 CJK 字元會 `console.warn` 一行 strict 警告,測試用 ASCII.
- **空白折疊後 `style` 必須排除**:折疊文字節點空白會把套件自身多行 `<style>` CSS 變成單行,`{…}` 立即被正規式取出(變異 D4 使 17 條全敗);`script` 對自訂模板(`htmlTemp`)內之 script 才需要.區塊邊界不能只列常見標籤(article/search/hgroup/menu…會漏):改「inline 白名單以外皆為區塊」(DOMPurify 清洗後只剩標準 html/svg 元素);marked 在區塊間輸出 `\n`,要用使用者 html(`<div>{a</div><div>b}</div>`)才測得到區塊邊界插 `\n` 之必要性.
- 測試手法:警告走 `console.log`(同檔 `walkTokens` 慣例),測試暫換 `console.log` 擷取並於 finally 還原;**警告類斷言要對所列字串做完整相等比對**(`deepEqual` 警告列出之清單,並驗證警告中的數量),不要寫「不包含某字串」——曾有負向斷言查錯字串使排除退化也不會敗.修前紅用 `git show HEAD:src/WMd2html.mjs` 存成複本、把整個 `src/` 與測試檔複製到 `./tmp/<夾>/pre/`(測試之相對 import 指向複本 src),以 mocha 直接指定複本測試檔,不 checkout/stash;變異同法,用 Write 寫一支 `mkmut.mjs` 讀現行 src、逐一套「舊字串→新字串」(要求舊字串恰出現一次,否則略過並印出)產生各變異複本;原始檔為 CRLF,多行舊字串比對前先把原始檔 `\r\n` 正規化為 `\n`;含反斜線的正規式用 `String.raw`.複本在 `./tmp` 之下仍解析得到 repo 根的 `node_modules`.**活下來的變異就是多餘或無測試之程式碼**:本輪以此移除了 `annotation`、`.katex-display` 選擇器,並補了「區塊間無換行字元」「重複屬性」「katex-error」「顯示層大括號」等測試;改測試或改實作後,先前的變異結果就不算數,要全部重跑.測試原始碼不要放字面 U+00A0(用 `String.fromCharCode(0xA0)`),eslint 另有 `no-control-regex`(控制字元用字串 `replaceAll`).
- `test/report.md` 第 140 行標題含正文 `{n}`(說明 `data-style-th-{n}` 語法而未用反引號),加警告後 `test/WMd2html.test.mjs` 會多印一行警告;屬實警告,不改該檔(逐字比對 `reportTrue.html`).
- 外審:C 類免費模型(nemotron-3.5-super-vl-free、beam-free)於 2026-10-24 22:44~22:45 皆回 `Free usage limit reached`(`--print-logs --log-level ERROR` 之 stderr 立即可見,行程不會自行結束,須 `taskkill /T` 並回驗 PID);Claude API 額度之 opus5.5 於 2026-10-25 回 `Credit balance is too low`.只剩 B 類(sol,唯讀沙箱,約 10~15 分鐘/輪,靜態推導)時,靠「送審材料含輸入空間表 + 述語 + 前輪處置摘要」讓它專挑漏格:六輪共 60 條(11/12/8/11/8/10),前幾輪多為真實回歸(改變既有輸出),價值遠高於評價方案;第 6 輪起已多屬畸形輸入與顯示層細節.**每輪修完要重做變異驗證與新舊差異對照再送下一輪**;何時停:發現開始集中在畸形輸入(`<img 'src=x'>`)、罕見元素(`<slot>`、`textarea`)而修法複雜度大於收益時,列入已知限制收尾.
- **`claude -p` 以 `env.ANTHROPIC_API_KEY` 傳金鑰時,有 OAuth 登入則金鑰被忽略**(2026-10-25 實測,Claude Code 本機版):無效金鑰仍回成功,init 事件 `apiKeySource` 為 `none`,實際走登入帳號之訂閱額度;**必須加 `--bare`** 才走 API 金鑰(`apiKeySource` 為 `ANTHROPIC_API_KEY`;無效金鑰回 `Invalid API key`,額度不足回 `Credit balance is too low`).`--bare` 會略過 hooks、CLAUDE.md 自動載入、keychain 與 OAuth,適合審查用.探測時用 `onStdout` 累積完整輸出再解析 stream-json:派工失敗結果之 `stdout` 只留 500 字元,`result` 事件在其後而讀不到.

## 2026-10-29 本機圖片引用(路徑模式、缺圖 reject、base64 總量上限;主控依審計 md2docx-run01 之 `建議w-md2html調整.md`)

- **審計方案「`false` 時把 href 改寫為絕對路徑」直接做會得到沒有 `src` 之 `<img>`**:DOMPurify 視 `C:\…` 為未知通訊協定(`C:` 非白名單、第一字元為字母故 `[^a-z]` 不成立)而移除 `src`(實測 `md2html` 對 `<img src="C:\x.png">` 輸出 `<img>`).審計 E3 之路徑案是自行寫 html 繞過了清洗.解法:登記→佔位符→清洗後才寫入;不要改 `ALLOWED_URI_REGEXP`(會放寬 `<a href>`,動到 R-SANITIZE-01 語意).佔位符同時使 base64 不進 marked/DOMPurify/jsdom,故 base64 模式亦大幅省記憶體(150 張:RSS 4294→649MB、30→5.3s),**順帶把「約 80~100MB 即 OOM」之瓶頸移走**,上限改由字串長度與機器堆積決定.
- **量測上限之手法**:(腳本副本存任務證據夾 `md2html-run01-evidence/scripts/`,`./tmp/` 已清)`meas-gen.mjs`(同審計 `gen-imgs.mjs`:1600x900、上方 112 列隨機位元組,每張 0.52MiB,750 張約 25 秒)+ `meas-run.mjs`(子行程跑 `WMd2html` 回報 `resourceUsage().maxRSS`);**`peakHeapMB` 以 `setInterval` 取樣會被同步工作遮蔽,僅供參考**,堆積需求以 `--max-old-space-size` 階梯(256/384/512/768/1024)判定通過與否(`FATAL ERROR … heap out of memory` 離開碼 134;256 之案曾「印出 ok 後才 FATAL」,以 FATAL 為準).上限常數取保守之 2^27 字元,實測可更高,見規則帳本 R-IMGREF-01.
- **md 語法圖之路徑寫法**:含空白須 `![](<路徑>)`(marked 之角括號目的地);md 目的地內反斜線後接標點會被當逸出(`\.` → `.`),絕對路徑之 md 語法測試要寫正斜線;`marked` 之 renderer(`md2html.mjs:262`)輸出 `${href}` 未逸出,故路徑一律不經 renderer,改由 `fillImgs` 自行逸出 `& " < >`.原始 `<img>` 行以字面讀值(不解碼實體),檔名為 `a&amp;b.png` 者字面比對;測試用 `&amp;` 樣式檔名才抓得到「不逸出 `&`」(單純 `&w` 非實體,逸不逸出解析後相同,變異殺不死).
- **測試手法**:大圖案用稀疏檔(`fs.ftruncateSync`)——預檢發生在轉碼之前,不需真圖;邊界案由訊息取得上限再造 `n=(limit/4)*3` 與 `n+1`,不複製常數;轉碼後實際長度之案用雜訊 JPG(`sharp` 產,555KB → PNG 重編後 base64 約 564 萬字元,估算 74 萬字元),引用 80 次使估算未超而實際超.**修前紅**:舊碼在超限案直接 OOM 使整個 mocha 行程中止(離開碼 134),同檔其他案跟著沒結果,須以 `--grep` 分批(路徑與缺圖類一批、超限類單獨記為行程中止).變異腳本 31 種,多行舊字串須先把工作樹之 CRLF 正規化.
- **工作樹為 CRLF(autocrlf)而 HEAD 為 LF**:`git show HEAD:src/…` 取得之舊檔為 LF,新舊比對用輸出而非原始碼;`git diff --stat` 會因換行顯示全檔變動時,以 `git diff --stat -w` 或 `--ignore-cr-at-eol` 核對實際變動量.
- **測試鎖**:他套件持鎖時 `quiet-run --lock` 常等 1~3 分鐘;一次變異驗證(31 次 mocha)併入同一個指令(`runmut.mjs` 內 spawn)一取一放,比每次各取鎖省時;逾時預設不夠時加 `--timeout`.
- **Word 探測**:審計說 `#`、`%`、`&` 之 Word 解析「未實測」;以本套件路徑模式輸出含這些字元(及 `%20`、`'`、`&amp;` 樣式檔名)之 html,用審計證據夾之 `word-inspect.py`(複本放 `./tmp`)以 Word COM 唯讀開 html、列 `InlineShapes` 之 `LinkFormat.SourceFullName` 與尺寸:10/10 解析為原檔路徑、尺寸為圖原尺寸(破圖為 24x24;圖用 100x50 且尺寸異於 24x24 才分辨得出).探測圖勿用 1x1:破圖與真圖尺寸難分.sharp 以 `create` 產之 100x50 PNG 於 Word 顯示為 283.45x141.7 pt(非 96 dpi 之 75x37.5 pt;疑為 PNG 解析度中繼資料所致,未查證,與判定無關).經 `quiet-run --lock` 取鎖遇 wsemi 負載試驗獨佔雙槽,等了 15 分鐘(背景指令之 `timeout` 10 分鐘會先被收掉,須加 `--lock-wait` 並用 `run_in_background` 與較長 `timeout`,於同回合輪詢).

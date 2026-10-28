# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

## R-CSS-01 輸出引用之第三方 CSS 版本須與產出 HTML 之套件版本一致

- 規則:md2html 回傳之 `styleSrcs`(mergeStyle:true 時內嵌為 `<link>`)所引用之 KaTeX CSS,版本一律由 `katex.version` 組成,不得寫死.why:katex 0.18 起內部 class 加 `katex-` 前綴,CSS 與 JS 版本不符即跑版(2026-10-07 實測:上標字級 19.36px,應為 13.55px).
- 單一擁有者:`src/md2html.mjs` 之 `styleSrcs`;WMd2html 經 `mergeStyle:true` 共用,不另定義.
- 盤點指令:`git grep --untracked -n "cdn" -- src`
- 站點全集與判準(2026-10-07):

| 站點 | 判準 |
|---|---|
| `src/md2html.mjs` KaTeX CSS(`katex@${katex.version}`) | 已套 |
| `src/md2html.mjs` highlight.js github 主題 CSS(cdnjs 11.9.0 寫死) | 刻意不套:hljs 11.x 主題 class 相容,11.12.0 輸出以此 CSS 實測渲染正常;cdnjs 鏡像可能落後,動態版號有 404 風險.若要對齊,改 jsdelivr npm 路徑 `highlight.js@<版>/styles/github.min.css` |

- 測試:`test/unit-md2html-deps.test.mjs` 之「KaTeX CSS 版本與已安裝 katex 一致」3 條(md2html mergeStyle:false、mergeStyle:true、WMd2html).指令:`npx mocha --no-parallel "test/unit-md2html-deps.test.mjs" --timeout 180000`

## R-DEP-01 katex 宣告範圍須落在 marked-katex-extension 之 peerDependencies 內

- 規則:marked-katex-extension 釘精確版本(不得為 5.1.11,其入口為 ts 原始碼,rollup/webpack 無法打包;5.1.12 起提供 `lib/index.esm.js`);katex 宣告範圍須落在該釘選版之 peer 範圍內,且不得解析到 deprecated 版本.
- 現況(2026-10-07):marked-katex-extension `5.1.13`(peer `katex >=0.16 <0.19`、`marked >=4 <19`);katex `^0.18.2`,npm 解析為 0.18.10.已套.
- 裁決紀錄:2026-10-07 不升 katex 0.19(宣告 `^0.19.0` 會 npm ERESOLVE),不以 `--legacy-peer-deps` 或 overrides 繞過,待 marked-katex-extension 放寬 peer 後一併升;0.18.11 被官方標 deprecated,不宣告 `^0.18.11`(0.19.0 程式與 0.18.11 相同,停在 0.18.10 無功能損失).
- 驗證指令:`npm view marked-katex-extension@<釘選版> peerDependencies`;於專案複本 `npm install --package-lock-only` 無 ERESOLVE;`npm view katex@<解析版> deprecated` 應為空.
- 對應紀錄:根目錄 `marked-katex-extension與katex版本限制.txt`.

## R-BUILD-01 src 直接 import 之第三方 runtime 依賴須列為 Node 版 UMD 之 external

- 規則:`toolg/gDistRollup.mjs` 之 w-md2html bundle(Node 版 UMD,package.json main)須將 src 直接 import 之第三方 runtime 依賴列入 `external` 與 `globals`;瀏覽器版 md2html bundle 刻意內嵌(僅 path/fs/sharp/cheerio/jsdom 為 external).
- 盤點指令:`git grep --untracked -nE "^import .* from '[^.]|import\(" -- src`,對照 `toolg/gDistRollup.mjs` 之 external 陣列.
- 站點全集與判準(w-md2html bundle,2026-10-07):

| 依賴 | 判準 |
|---|---|
| path、fs | 已套 external |
| marked、katex、marked-katex-extension、marked-footnote、highlight.js、marked-highlight | 已套 external(katex 於 2026-10-07 新增) |
| jsdom(`md2html.mjs` 以 `import(clib)` 動態載入) | 已套 external |
| sharp(經 w-image-proc) | 已套 external |
| lodash-es、wsemi/src、w-image-proc/src | 刻意內嵌(工具函式與自有套件原始碼) |
| dompurify | 現況內嵌(既有,未裁決):Node 版 UMD 使用打包當下之 dompurify,其安全修正須重新打包發佈才生效;以 src 匯入之下游不受影響 |

- 驗證:打包後 `grep -c "KaTeX parse error" dist/w-md2html.umd.js` 應為 0(2026-10-07 實測 189,552 bytes;未列 katex external 時為 445,229 bytes).

## R-SYNTAX-01 換行與表格樣式標記一律用 data-for

- 規則:換行佔位用 `<div data-for="br"></div>`,表格樣式用 `<div data-for="tab" data-style-th=... data-style-td=...>`.`<docx_br>`(2026-06-22 `4470986` 廢止)與 `for="..."`(2026-07-16 `88da0ce` 改為 `data-for`,因 DOMPurify 3.4.12 起洗掉 div 之 for)不得再用;marked 18.0.12 起含底線之標籤名(如 `<docx_br>`)會以字面文字顯示.
- 盤點指令:`git grep --untracked -nE "docx_br|[^-]for=\"(br|tab)\"" -- src test examples`,應無結果(離開碼 1).
- 站點:處理於 `src/md2html.mjs`(data-for="br"/"tab" 區段);使用於 `test/report.md`、`examples/ex-md2html.html`.已套.
- 測試:`test/md2html.test.mjs`(data-for=br 2 條、data-for=tab 與逐欄樣式 7 條).

## R-EXAMPLE-01 範例頁測試 md 須與 test/report.md 逐字一致

- 規則:`examples/ex-md2html.html` 之 textarea 內容須與 `test/report.md` 逐字一致(textarea 為 RCDATA,內容不可縮排,開標籤後第一個換行會被丟棄);report.md 以相對路徑引用之資產須同步置於 `examples/`(發佈時 `toolg/gDocsExams.mjs` 會複製 examples 下所有檔案至 docs/examples).
- 盤點指令:`node -e "const fs=require('fs');const h=fs.readFileSync('examples/ex-md2html.html','utf8');const m=fs.readFileSync('test/report.md','utf8');const v=h.split('oninput=\"rdr()\">')[1].split('</textarea>')[0].replace(/^\r?\n/,'');const n=s=>s.replace(/\r\n/g,'\n').replace(/\s+$/,'');console.log(n(v)===n(m))"`,應印 true;並確認 `examples/cocktail.svg` 存在.
- 站點:已套(2026-10-07).無自動化測試,驗收以 Playwright 開啟範例頁.

## R-SANITIZE-01 輸出置入頁面後不得影響區塊以外

- 規則:md2html 之輸出以 innerHTML(如 Vue 之 `v-html`)置入頁面一區塊後,不得改變區塊以外之樣式或執行程式;清洗一律經 `src/md2html.mjs` 之 `dp.sanitize(h, { FORBID_TAGS: ['style'] })`,瀏覽器與 Node 共用此一處(WMd2html 經 md2html).
- 單一擁有者:`src/md2html.mjs` 之 sanitize 一行;套件自身樣式(styleDef)於 mergeStyle 為 true 時在清洗之後加入,不受此規則影響.
- 盤點指令:`git grep --untracked -n "sanitize(\|FORBID_TAGS" -- src`,應只有一處 sanitize 且帶 `FORBID_TAGS: ['style']`.
- 站點全集與判準(2026-10-11 實測):

| 途徑 | 判準 |
|---|---|
| `<style>` 元素(開頭、行內、表格內、svg 內、含 `@import`) | 已套:FORBID_TAGS;其內 CSS 依 DOMPurify 預設 FORBID_CONTENTS(含 style)一併捨棄,不外漏為文字 |
| `<link>`、`<base>`、`<meta>` | 已套:DOMPurify 預設即移除 |
| `<script>`、`<iframe>`、on* 屬性、`javascript:` 網址 | 已套:DOMPurify 預設即移除 |
| style 屬性之定位與溢出(`position:fixed/absolute`、負邊距等) | 未套,已知限制:外層 `contain:layout` 只改定位基準不裁切,fixed 遮罩會蓋住區塊右方與下方之其他區塊;下游 w-web-api `MdPanel.vue` 以 `contain:none` 解除後可蓋滿視窗.2026-10-11 決定另案處理;候選作法為外層改 `contain: layout paint`(實測可裁切,但會裁掉寬表格等合法溢出,且對覆寫 contain 之呼叫端無效),須先量測寬內容之影響再決定 |
| `<form>`、`<input>`、`<button>` | 刻意不套:只在區塊內呈現,不影響區塊以外 |

- 測試:`test/unit-md2html-deps.test.mjs` 之 DOMPurify 7 條(on*、script/iframe、javascript:、移除 `<style>`、各位置之 `<style>`、程式碼中之 `<style>` 字樣照常顯示、mergeStyle 只留套件之 `<style>`)與 WMd2html 1 條(只留套件之 `<style>`).

## R-FIGREF-01 圖表名只取「圖n」「表n」所在之文字;取代後對不上之 `{…}` 須警告

- 規則:①`WMd2html` 之 `cvItemNum` 取圖表名一律經 `getItemName`:以「註解或標籤」為單位由左而右掃描該行(註解整段略過;標籤屬性值可含 `<`、`>`,故其他標籤屬性值內的「`<img`」字樣不是圖片),標籤名為 `img` 且 `getAttr` 取得之 `src` 非空者整個移除(`getAttr` 逐屬性解析,名稱與分隔只認 HTML 空白 `[ \t\n\f\r]`、不含 U+00A0,名稱不分大小寫、重複屬性取第一個、值可為雙引號/單引號/無引號且無引號值至空白或 `>` 為止);有移除圖片時,再移除「內容只剩空白、標籤、註解與被移除之圖片(至少一個)」之連結 `<a>…</a>`(否則 html2str 會輸出其 href;原本就沒有文字之連結不動);接著 `html2str`,**有移除圖片且純文字已不含「圖n/表n」**(原本只在被移除之 img 或其他標籤之屬性內)即非圖題、回傳 null 不登記(該行仍照舊佔用編號);其餘照舊去掉「圖n」→ trim → 包成 `{名}`.**無 src 或 src 為空之 img 不移除**(html2str 對其只輸出 alt,同修前);**沒有移除任何 img 之行走與修前逐字相同之路徑**.②寫檔前(模板取代與後處理之後)對最終輸出 `h` 呼叫 `getUnresolvedRefs(h)`,輸出之可見文字中仍有 `{…}` 即 `console.log` 一行 `warning: N reference(s) match no figure/table name: …` 列出(去重、依首次出現順序),不中斷轉換、不改回傳值('ok')、不增選項.
- why(取名):`html2str`(wsemi)把 `<img>` 轉成「alt [src]」文字是通用 html→純文字之設計,不是缺陷;需要的是「圖題文字」,故由呼叫端(本套件)先移除有 src 之 img,不在 wsemi 改(改了影響其他呼叫者,且圖題語意之判斷本就屬本套件).**修 bug 的範圍限定在「修前必定出錯」那一類輸入(同行有 src 之 img),其餘路徑要能證明與修前逐字相同**:截斷「圖n」之前的文字、移除 svg、移除無 src 或 src 為空之 img、一律清除空連結都曾試過,皆改變修前已可解析之輸出(sol 外審實例:`{前文⏎ 甲}`、svg 內文字之圖名、`<img alt="圖n 甲" src=''>`、原本就空之連結).
- why(警告):判準定為「輸出的可見文字中仍殘留之 `{…}`」,即下游 docx 檢查(`checkDocxTables`)會報「大括號殘留」者.以**最終輸出之 DOM**(jsdom,`import(clib)` 動態載入,同 md2html.mjs 慣例)為準:①文字節點內之 HTML 空白(含軟換行)折疊為單一空白;②`code, pre, style, script, math, .katex, .katex-error` 以 `\n` 取代;③inline 元素白名單以外之元素前後插 `\n`;④取 `textContent`(再折疊連續空白)後以 `/\{[^{}\n]*[^{}\s][^{}\n]*\}/g` 取出.**不採「在 md 原文上排除」**:`walkTokens` 收集 token raw 後自 md 刪除或計次差,曾因 token raw 與 md 文字不盡相同(引用/清單已去前綴、表格 `\|` 與 `\[` 已還原、CR 已正規化、圖片 alt 不渲染 codespan、html 區塊範圍由 marked 判定)而漏警或誤報(sol 外審前三輪共 31 條,多數屬此);渲染後 DOM 就是輸出本身,排除範圍即元素.排除 `.katex` 因 KaTeX 同時輸出 MathML 與含字面大括號之顯示層(`\{x\}`);`style` 因套件自身樣式含選項值(`fontFamilies: ['{字型}']`),且折疊空白後多行 CSS 變單行;`script` 因自訂模板(`htmlTemp`)中可有 script(使用者內容中者 md2html 清洗時已移除).代價/語意:逸出之 `\{x\}` 在輸出中是可見文字故會列出;屬性值(alt/title/href)不是可見文字不檢查;軟換行折疊為空白(列 `{跨行 引用}`);區塊邊界依元素種類不依 CSS 實際顯示.警告以 `console.log` 輸出(非致命訊息;缺圖已於 2026-10-29 改為 reject,見 R-IMGREF-01).`getUnresolvedRefs` 於圖片 `src` 寫入之前執行,解析之 html 只含佔位符、不含 base64(R-IMGREF-01),可見文字不受影響.
- 單一擁有者:`src/WMd2html.mjs` 之 `getAttr`、`getItemName`(取名)、`getUnresolvedRefs`(偵測)與寫檔前之警告輸出段.md2html(瀏覽器端)不處理圖表編號.`walkTokens` 只登記 image 之本機圖(R-IMGREF-01),不涉圖表名.
- 盤點指令:`git grep --untracked -n "html2str" -- src`,應只有 `import` 與 `getItemName` 內一處;`git grep --untracked -n "warning:" -- src` 應只有一處;`git grep --untracked -n "import(clib)" -- src` 應有 md2html.mjs 與 WMd2html.mjs 各一.
- 站點全集與判準(2026-10-25):

| 站點 | 判準 |
|---|---|
| 無 img 之圖題寫法(純文字行、單/雙層 `<div>`、全形標點、`**圖n 名**`、標題、清單、表格列、連結、`<b>`、`<table><caption>`、多區塊、圖題內 `<svg>`、同一文字行內「圖n」之前的字、空連結、U+00A0、title 內含 `<img`) | 已套(保持修前行為):21 種寫法整份輸出 html 與修前逐字相同(`diff-old-new.mjs` 組 A),既有 `genNumForPicAndTab` 與 `reportTrue.html` 比對 |
| 多行圖題(img 與圖題分行) | 已套(同修前),有測試 |
| 單行圖題:有 src 之 img 在圖題前/後、帶 alt、alt/title 值含 `>`、未加引號之 `SRC=… ALT=…`、大寫標籤、包在 `<a>`、`<a><span>`、`<a>` 含註解;表區塊同 | 已套,有測試 |
| 無 src(srcset)、src 為空、alt 值內含「 src=」、重複屬性 `src='' src='x'`、屬性間 U+00A0、`data-x=a=src=x`、註解內或其他標籤屬性值內之「<img」,且 alt 為圖題文字 | 已套(保持修前行為),有測試 |
| 有移除圖片之行,與圖片無關且原本就沒有文字之連結 | 已套(不動,同修前取名規則),有測試 |
| 「圖n」只在有 src 之 img 之 alt,或只在其他元素之屬性(`data-note="圖n"`) | 已套:不登記、仍佔用編號(同修前)、不覆寫真圖題,有測試 |
| `href` 內含「圖n」;連結同時包住圖片與圖題文字(名帶 `[href]`);`<img 'src=x'>` 類畸形屬性;img 標籤之屬性跨多行 | 已知限制:html2str 輸出 href 文字或解析器容錯行為與本函式不同;`cvItemNum`、`cvPicRef` 皆逐行處理;無測試 |
| 圖題以 Markdown 修飾字元包住、在標題/清單/表格列/連結內,圖題後同行另有區塊文字(含真 `<table>` 儲存格)或 Markdown 圖片語法/連結 | 已知限制,與修前行為相同(名稱含修飾字元或多餘文字而對不上;對不上時由警告列出) |
| 同行出現兩個「圖n」;純 `圖n`(無名)使內文 `{}` 被取代成編號;同行兩個 `<img src="…">` 使 `cvPicRef` 丟 `size(s)!==2` | 範圍外,修前既有,未動 |
| `getUnresolvedRefs` 排除:`<pre>`(圍欄/縮排/html 區塊/未閉合含外層容器)、`<code>`(行內碼、註腳內、表格內含 `\|`、html 行內)、數學式(`$…$`、含強調字元、單 `$` 跨行、`$$…$$`、顯示層含 `\{x\}`、使用者 `<math>`、無法解析之 `.katex-error`)、套件自身 `<style>`、自訂模板 `<script>` | 已套,有測試 |
| `getUnresolvedRefs` 檢查:段落、標題、引用、清單、表格儲存格、註腳正文、逸出之 `\{x\}`、`{**x**}`(列 `{x}`)、軟換行(列折疊後 `{a b}`)、取代模板符號後才形成者(`{甲{title}乙}`) | 已套,有測試 |
| `getUnresolvedRefs` 不列:屬性值、跨段落/跨區塊/跨 `<br>`/跨程式碼之大括號、`{}`、`{ }`、已被換成檔名之 `{title}`;巢狀 `{{x}}` 列最內層;相鄰文字節點之連續空白折疊後相同者只列一次 | 已套,有測試 |
| `<slot>`/svg `<tspan>` 等預設連續顯示卻不在 inline 白名單內之元素;`textarea`(預設 pre-wrap);`hidden`、svg `<defs>`;`<input value>`;CSS `display:inline` 之 div;使用者自稱 `class="katex-error"` 之正文;註腳標號 CSS 方括號 | 已知限制:依元素種類判定,不依實際顯示;無測試 |
| 取代本身(`replaceAll`)仍作用於整份 md,含程式碼區塊內之 `{圖名}` | 修前既有行為,本輪不改 |

- 測試:`test/unit-genNumRefs.test.mjs`(17 條:圖單行/多行、表單行/多行、單行 img 各種寫法(alt、屬性含 `>`、未加引號、包在連結內、連結含 span/註解)、維持修前取名(svg、前綴、多區塊、無 src、src 為空、alt 含 src=、重複屬性、U+00A0、註解內與屬性值內之 `<img`、無關連結、`data-x=a=src=x`)、img alt 或其他屬性中之「圖n」非圖題、引用不存在之警告、排除位置不誤報、標題/引用/清單/使用者 style script、html 程式碼與未閉合 pre、可見文字判準(逸出列出、屬性不列)、軟換行/跨區塊/跨 br/跨程式碼/巢狀/空白折疊、相同文字他處與表格 `\|`、數學式(含 `\{x\}`)與註腳與 CRLF、MathML 與 fontFamilies、自訂模板 script、模板符號、無誤報;警告以完整相等比對並驗證警告中之數量).指令:`npx mocha --no-parallel "test/unit-genNumRefs.test.mjs" --timeout 180000`.
- 變異驗證(2026-10-25,`./tmp/md2html-run02/mkmut.mjs` 於複本逐一改動 src 後跑上列測試,34 種皆被抓到,括號為失敗條數):A 不移除任何 img(6)、B 拿掉警告(9)、K 警告中數量錯誤(9)、C1 不排除 code(5)、C2 不排除 pre(1)、D1 不排除 katex-error(1)、D2 不排除 math(1)、D3 不排除 .katex(1)、D4 不排除 style(17,全敗)、D5 不排除 script(1)、E 拿掉「有移除圖片且純文字已不含圖n即不登記」(1)、F1 區塊間不插換行(1)、F2 把 div/article/search 當 inline(1)、F3 不折疊文字節點空白(1)、Z 不折疊跨節點連續空白(1)、G 標籤正規式不認屬性值內 `>`(1)、H 被排除元素以空字串取代(1)、I 無 src 之 img 亦移除(1)、J src 為空之 img 亦移除(1)、L 不去重(2)、M 大括號可跨行(1)、N 允許空白內容之大括號(1)、O 屬性分隔認 JS 的 `\s`(1)、P 屬性名稱區分大小寫(1)、Q 不認無引號屬性值(1)、R 重複屬性取最後一個(1)、S1 不移除移除圖片後留下之空連結(6)、S3 空連結只認內容為空白(1)、S4 不要求連結內有被移除之圖片(1)、Y 空連結內不認註解(1)、U 於模板符號取代之前判定(1)、V 只掃描 img 標籤(1)、W 不認註解(1)、X 無引號屬性值遇等號或引號即結束(1).修前(`git show HEAD:src/WMd2html.mjs` 複本)跑同一檔:17 條中 14 條敗,不敗之 3 條為「不應警告」類(MathML 與 fontFamilies、自訂模板 script、只有程式碼與數學式含大括號),修前無警告功能故本就不敗.
- 設計歷程(2026-10-24~25,六輪 sol 外審共 60 條,run01 第 1~3 輪 11/12/8 條、run02 第 4~6 輪 11/8/10 條):初版「token raw 排除 + 計次差」與「`slice` 到圖n所在行」被指出多條回歸與漏警,改為上述兩項簡化;以變異殺不死為準移除了冗餘選擇器(`annotation`、`.katex-display`);第 6 輪起發現已屬畸形輸入與顯示層細節,餘者列入已知限制,不再續審.

## R-IMGREF-01 本機圖片一律先登記為佔位符,於 md 轉 html 完成後才寫入 src;缺圖 reject;base64 有總量上限

- 規則:①md 語法圖(`walkTokens`)與原始 `<img src="…">` 行(`cvPicRef`,逐行,一行須恰有一個 `src="`)之本機圖皆只經 `regImg(ref)` 登記:以 **md 所在資料夾**解析為絕對路徑(絕對路徑照用,不做 cwd 優先回退、不解碼 `%XX`),回傳佔位符 `${phImg}${編號}`(同一檔共用一個)取代 `src`;非本機圖(空值、`^[A-Za-z][A-Za-z0-9+.-]+:` 之協定[至少 2 字元,磁碟代號 `C:\` 不是協定]、`//`、`#` 開頭)回傳 null,維持原值、不檢查、不 reject.②`md2html` 完成並套模板、`getUnresolvedRefs` 偵測後,`fillImgs(h)` 一次處理:掃 `src="${phImg}(\d+)"` 得各圖引用次數(未出現於輸出者不檢查);**任一被引用之圖檔不存在即 reject**,訊息 `N image file(s) do not exist:` 之後逐行列出全部缺圖絕對路徑(去重);`imgConvertToBase64=false` 時寫入路徑原樣(`path.resolve` 之原生形式,Windows 為反斜線,不做百分比編碼,僅逸出屬性值內 `& " < >`),不讀檔不轉碼;`true` 時先以原檔大小估算 `Σ ceil(n/3)*4*引用次數`,超過 `IMG_BASE64_MAX_CHARS`(2^27 字元)即 reject(訊息含張數、檔案 MB、估算字元數、上限與建議改用 `imgConvertToBase64=false`),再依序以 `wi.base64(fp,'png')` 轉碼(各檔一次,同檔多處共用字串),轉碼後累計實際字元數超過上限再 reject(JPG、SVG 轉 PNG 後可能遠大於原檔).③`phImg` 初值 `wmd2htmlimg`,md 或 `htmlTemp` 含該字串即加 `x` 直到不含,使模板內同形之 `src="wmd2htmlimgN"` 不被改寫.
- why 佔位符(不在 `md2html` 之前或 `walkTokens` 內直接寫路徑/base64):①**DOMPurify 會移除值為 Windows 絕對路徑(`C:\…`)之 `src`**(視為未知通訊協定,實測 `<img src="C:\x.png">` 清洗後成 `<img>`),絕對路徑只能於清洗之後寫入——審計 md2docx-run01 §7.2 預期「改寫 href 即可」未涵蓋此點;②base64 資料不進 marked、DOMPurify、jsdom:修前清洗後堆積約為 html 字元數之 35 倍,預設堆積(4288MB)下約 80~100MB 圖片即 OOM 中止行程(離開碼 134,呼叫端收不到 reject);改後 150 張(82MB)RSS 649MB(修前約 4294MB)、耗時 5.3s(修前約 30s).
- 上限常數 `IMG_BASE64_MAX_CHARS = 2 ** 27` 之依據(2026-10-29,Node v24.22.1,1600x900 雜訊 PNG 每張 0.52MiB,量測腳本副本見任務證據夾 `md2html-run01-evidence/scripts/meas-run.mjs`,`./tmp/` 已清):圖片不經 DOM 後峰值記憶體隨 base64 字元數線性成長(RSS 約 4.5~5 倍、堆積約 1~2 倍):150/300/450/600 張(1.09/2.18/3.27/4.36 億字元)RSS 649/1091/1527/1982MB;750 張(5.45 億字元)超過 V8 字串上限(536,870,888)丟 `Invalid string length`;245 張(1.78 億字元)於 `--max-old-space-size=384`(堆積上限 576MB)通過、300 張於同設定 OOM、於 512 通過.取 2^27(約 96MiB 之 PNG,與審計「約 80 MB 量級」一致)於 576MB 堆積上限下有約 1.3 倍餘裕;**可提高**(實測 4288MB 預設堆積下 4.36 億字元仍通過),但小堆積機器風險隨之增加,未經裁示不提高.
- 單一擁有者:`src/WMd2html.mjs` 之 `regImg`、`cvPicRef`、`fillImgs`、`phImg`、`fpsImg`/`kpFpImg` 與常數 `IMG_BASE64_MAX_CHARS`;`wi.base64` 只應出現在 `fillImgs`.`md2html.mjs`(瀏覽器端)不處理檔案路徑,`funWalkTokens` 之契約不變.
- 盤點指令:`git grep --untracked -nE "wi\.base64|path\.resolve\(fdIn|fsIsFile|IMG_BASE64_MAX_CHARS|regImg\(" -- src`:`wi.base64` 應只有 `fillImgs` 內一處;`path.resolve(fdIn` 只有 `regImg`;`regImg(` 呼叫只有 `cvPicRef` 與 `walkTokens`;`fsIsFile` 於 `WMd2html` 為 fpIn 檢查與 `fillImgs` 缺圖檢查.
- 站點全集與判準(2026-10-29):

| 站點 | 判準 |
|---|---|
| md 語法圖(相對、`./`、子夾、`<…>` 包空白、中文、`& # % '`、絕對路徑) | 已套(`regImg`),有測試 |
| 原始 `<img src="…">` 行(相對、中文與空白、絕對路徑、`&amp;` 樣式檔名) | 已套(`cvPicRef`→`regImg`),有測試 |
| 具協定之網址、`data:`、`//`、`#`、空值(md 語法與原始 `<img>`) | 已套(不處理不 reject),有測試;修前原始 `<img>` 行遇網址丟錯 |
| 缺圖(兩處、兩種模式、多個、重複只列一次、不進輸出者不查) | 已套(`fillImgs` reject),有測試 |
| 總量上限(預檢邊界、逐處計、轉碼後實際長度、路徑模式不受限) | 已套,有測試 |
| 原始 `<img>` 單引號/無引號 `src`、同行多個 `src="` | 已知限制(修前既有):只處理雙引號 `src="`;同行兩個丟 `size(s)!==2`;無測試 |
| 程式碼區塊/行內碼內之 `src="…"` 文字 | 已知限制(修前既有):逐行處理不分語境,被登記並於輸出文字中被改寫(缺檔則 reject) |
| 路徑含 `# % %20 & '` 及 `&amp;` 樣式檔名時 Word 是否能解析 | 已實測可解析(見下「Word 探測」);其餘 Word 不可解析之情形(若有)由下游 w-html2docx 之連結檢查報錯 |
| 路徑含 `"` 之逸出 | 有測試但 Windows 無法建此檔名(pending);Ubuntu CI 才會跑 |

- 測試:`test/unit-imgPath.test.mjs`(21 條 + 1 pending:路徑模式[md 語法/原始 img/絕對/原生形式/不以 cwd 解析/特殊字元/實體樣式檔名/多處引用/網址/註解內/模板同形/不讀內容]、缺圖 reject[兩模式]、base64[預設內嵌與 `wi.base64` 同、超限訊息、邊界、逐處計、轉碼後實際長度、路徑模式不受限、無本機圖]).指令:`npx mocha --no-parallel "test/unit-imgPath.test.mjs" --timeout 180000`.大檔以稀疏檔(`ftruncate`)於 `test/_tmp/unit-imgPath/` 產生,執行時產生、測完即刪.上限由訊息取得,測試不複製常數.
- 變異驗證(2026-10-29,`md2html-run01-evidence/scripts/runmut.mjs` 於 src 複本逐一變異後跑上列測試):31 種中 30 種被抓到(括號為失敗條數):網址不排除(2)、不含 `//`(1)、不含 `#`(1)、單字元協定(1)、空值不排除(1)、以 cwd 解析(18)、cwd 優先回退(1)、正斜線(11)、百分比編碼(11)、不逸出 `&`(2)、路徑模式走 base64(11)、base64 走路徑(5)、預設改 false(5)、不查缺圖(3)、只列第一個(2)、缺圖含未進輸出者(1)、張數錯(2)、無預檢(3)、邊界 `>=`(1)、估算不乘次數(1)、無實際長度檢查(1)、實際長度不乘次數(1)、floor 少算(1)、不呼叫 `fillImgs`(19)、`walkTokens` 不登記(12)、`cvPicRef` 不處理(14)、不避模板同形(1)、不共用編號(4)、`s1s[0]` 錯(9)、訊息無建議(1);**存活 1 種:不逸出 `"`**(Windows 無法建含 `"` 之檔名,該測試於 Windows 為 pending,待 Ubuntu CI).
- 修前紅(2026-10-29,`git show HEAD:src` 複本跑同一測試檔):路徑/缺圖/網址等 11 條敗、2 條(預設 base64、無本機圖)綠;超限類 4 條使修前之行程 OOM 中止(離開碼 134),即為紅.
- Word 探測(2026-10-29,Word 16,經 `quiet-run --lock`;`wordprobe-prep.mjs` 以本套件路徑模式輸出 html,`word-inspect.py`[審計證據夾腳本]以 Word 唯讀開啟並列 `InlineShapes`):10 張 100x50 之圖,路徑分別為「中文與空白」「目錄含 `#`」「檔名含 `#`」「目錄含 `%`」「檔名含 `%`」「目錄含 `%20`」「目錄含 `&`」「檔名含 `&`」「檔名含 `'`」「檔名含 `&amp;` 樣式」,`src` 皆為反斜線絕對路徑(`&` 於 html 內逸出為 `&amp;`):**10/10 之 `LinkFormat.SourceFullName` 等於原檔路徑、顯示尺寸為圖之原尺寸(283.45x141.7 pt),非破圖之 24x24**(`InlineShape.Type=4` 為 Word 直開 html 之連結圖,屬預期,下游斷開連結後內嵌).故路徑原樣寫入(不編碼)對上述特殊字元可用;僅逸出 `& " < >` 為 html 屬性語法所需.證據 `md2html-run01-evidence/word-probe.json`.
- 等價(L3):`md2html-run01-evidence/scripts/equiv.mjs` 以 `test/report.md` 加 png/jpg/svg、md 語法圖與原始 `<img>`(含重複引用、網址圖)於預設與 `imgWidthMax` 兩組選項,修前與修後輸出逐字相同(149,678 與 149,794 字元,各 6 個 data URL);修前多印一行 `href[https://example.com/x.png] does not exist`(md 語法網址圖),修後無.

## R-TEST-01 測試清單與基準檔重產規則

| 測試檔 | 涵蓋 | 條數 |
|---|---|---|
| `test/unit-imgPath.test.mjs` | 本機圖片引用:路徑模式、缺圖 reject、base64 總量上限(R-IMGREF-01) | 21(+1 pending) |
| `test/md2html.test.mjs` | DOM 後處理(display:none、data-for=br/tab、逐欄樣式、linkBlank、表格置中) | 13 |
| `test/genNumForPicAndTab.test.mjs` | 圖表自動編號與交叉引用 | 4 |
| `test/unit-genNumRefs.test.mjs` | 圖表名取法(單行/多行)與未解析引用警告(R-FIGREF-01) | 17 |
| `test/WMd2html.test.mjs` | report.md 全文逐字比對 `test/reportTrue.html`(現狀指紋) | 1 |
| `test/unit-md2html-deps.test.mjs` | 依賴契約:KaTeX(CSS 版本、行內、區塊、nonStandard、throwOnError)、highlight(已知/未知/未指定語言)、footnote 屬性、marked renderer 與 async walkTokens、DOMPurify(on*、script/iframe、javascript:、`<style>` 移除與其邊界,見 R-SANITIZE-01)、WMd2html(CSS、`<style>` 移除、Footnotes 標題隱藏、圖片轉 base64) | 23 |

- 指令:`npm test`(2026-10-29 為 76 passing、1 pending[`unit-imgPath` 之 `"` 路徑,Windows 無法建檔],加 `unit-imgPath` 21 條;2026-10-25 為 58 passing;2026-10-11 為 41,加 `unit-genNumRefs` 17 條).`test/report.md` 第 140 行標題含正文 `{n}`,`test/WMd2html.test.mjs` 轉換時會多印一行警告(屬實:該 `{n}` 對不上任何圖表名),不影響逐字比對.
- 基準檔重產:`test/reportTrue.html` 僅在依賴升版造成之預期差異時重產;先列預期差異,以腳本逐行驗證差異僅限預期項目,經使用者授權才覆蓋.2026-10-07 重產,差異 3 行(KaTeX CSS 版本、base/strut/sizing 改名).

## 已知限制

- 瀏覽器端 bundle(`dist/md2html.umd.js`)與下游 bundler 以 src 匯入之路徑無自動化測試,升版時以 Playwright 開啟範例頁驗收.
- dompurify 內嵌於 Node 版 UMD(見 R-BUILD-01).
- style 屬性之定位與溢出可蓋住區塊以外之頁面(見 R-SANITIZE-01,另案處理).
- md2html 與 WMd2html 不對稱(範圍外,未修):隱藏 Footnotes 標題與 li 間距只在 `src/WMd2html.mjs` 處理,瀏覽器端會顯示「Footnotes」標題;WMd2html 以字串取代 `<li>` 加間距,不涵蓋帶屬性之 `<li id="...">`(註腳項目).
- `toolg/gDistRollup.mjs` 之 `getFiles` import 未使用(eslint no-unused-vars,既有).
- `test/genNumForPicAndTab.test.mjs` 以 `./tmp` 為測試暫存(全域規範應為 `test/_tmp/`,既有).

## 破壞性變更紀錄

| 日期 | 變更 | 影響 |
|---|---|---|
| 2026-10-07 | katex 0.16.47 → 0.18.10 | 輸出之 KaTeX 內部 class(base、strut、sizing 等 20 個)加 `katex-` 前綴;styleSrcs 之 KaTeX CSS 改隨安裝版;下游自行載入 KaTeX CSS 或以其內部 class 寫樣式者須同步 |
| 2026-10-07 | jsdom 29.1.1 → 30.1.2 | Node 下限 `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`(Node 端轉換路徑;瀏覽器端不載入 jsdom);程式碼無須改 |
| 2026-10-07 | marked 18.0.10 → 18.1.0 | CommonMark 修正:含底線之自訂標籤以字面顯示、括號不成對之連結目的地不成連結、巢狀連結外層不成連結、硬換行後前導空白去除 |
| 2026-10-11 | 清洗移除 `<style>`(R-SANITIZE-01) | markdown 內容中之 `<style>` 不再出現於輸出(含其 CSS);w-md2docx、w-web-api 與本專案之 md 內容皆無依賴者(grep 實測);一般 markdown 之輸出逐字不變(`test/reportTrue.html` 比對通過) |
| 2026-10-25 | 圖題與有 src 之 `<img>` 同行時圖表名只取圖題文字;輸出可見文字中對不上之 `{…}` 警告(R-FIGREF-01) | 單行寫法(圖題與 `<img src>` 同行)過去靜默不取代之 `{圖名}` 自此取代;不含有 src 之 img 之行取名與修前逐字相同(多行寫法輸出不變,既有測試與 `reportTrue.html` 比對通過);「圖n」只出現在有 src 之 img 屬性內之行不再登記圖表名(仍佔用編號);新增 `console.log` 警告一行(`test/report.md` 之 `{n}` 會觸發),回傳值仍為 'ok';WMd2html 於警告偵測時動態載入 jsdom(本套件既有依賴) |
| 2026-10-29 | 本機圖片引用(R-IMGREF-01):`imgConvertToBase64:false` 時 md 語法圖與原始 `<img>` 一律改寫為以 md 所在資料夾解析之絕對路徑(Windows 反斜線);缺圖兩處兩模式皆 reject 並列全部路徑;base64 模式總量超過 2^27 字元即 reject;原始 `<img>` 行改以 md 所在資料夾解析(不再 cwd 優先);網址圖不處理不 reject | 不保留舊行為(專案原則 14):`false` 之輸出由原 href 變絕對路徑(下游須連帶,w-md2docx 另案);缺圖由「log 後繼續」變 reject;SVG/JPG 於路徑模式保持原檔(Word 內嵌向量/原檔,DPI≠96 之 JPG 顯示尺寸依 96 dpi,主控 2026-10-29 裁定接受);預設 `true` 未超上限者輸出逐字不變;內部改為佔位符流程使圖片不經 DOM(RSS 大幅下降) |

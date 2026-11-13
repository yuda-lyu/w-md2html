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
- 複評(2026-11-09,katex 已有 0.19.1、無 deprecated):結論仍不升,待裁示.①marked-katex-extension 最新仍為 5.1.13,peer 仍 `katex >=0.16 <0.19`;②於複本改宣告 `^0.19.1`:無鎖檔解析 ERESOLVE(離開碼 1);有鎖檔第一次 `npm install` 僅警告 `ERESOLVE overriding peer dependency` 而成功並寫入違規鎖檔,其後任何 `npm install` 即 ERESOLVE(離開碼 1);③消費端安裝以 `npm pack` 之探測包實測:npm 不報錯,但把 katex 0.19.1 巢狀置於本套件之下、頂層提升 katex 0.18.10 供 marked-katex-extension 使用,即渲染(0.18.10)與 `katex.version` 組 CSS 網址(0.19.1)來自兩份 katex,正是 R-CSS-01 要避免之版本分裂;④執行期相容性無虞(0.19.1 隔離複本跑既有測試:僅 `reportTrue.html` 之 CSS 版號一行不同,正規化版號後逐字相同;新增之 R-KATEX-01 三條皆綠).能解之路徑:待 marked-katex-extension 放寬 peer;或改自寫 marked 擴充取代之(範圍擴大,須裁示);`overrides` 只對本套件自身之安裝有效,對消費端無效,不採.

## R-KATEX-01 公式含中文或字型外符號時須仍渲染為公式,不因 KaTeX strict 丟錯或轉為錯誤呈現

- 規則:`src/md2html.mjs` 傳給 marked-katex-extension 之選項為 `throwOnError:false`、`nonStandard:true`,**不明設 `strict`**(依 KaTeX 預設:0.19.1 `src/Settings.ts` 之 `strict` 無 `default`,依該檔規則「未指定時由首個允許型別決定」=列舉首值 `'warn'`;實測行為同 `'warn'`).含中文等非數學字元(`unicodeTextInMathMode`)與不在 KaTeX 字型內之符號(`unknownSymbol`、`symbolNotInFont`,如 emoji、☃、阿拉伯字母)之公式須渲染為公式(`.katex`,字元排入顯示層 `.katex-html`),僅 KaTeX 以 `console.warn` 提示,不丟錯、不轉為 `.katex-error`;只有 TeX 語法錯誤(ParseError,如 `\frac{1`)才以 `.katex-error` 紅字呈現原始碼.若日後要明設 `strict`:不得為 `'error'`,亦不得為對上列錯誤碼回 `'error'`/`true` 之函式;明設須同時於 README 說明.
- why:KaTeX 0.19.0 起缺字元度量改經 `strict` 回報(錯誤碼 `symbolNotInFont`),`strict` 為 `'error'` 時丟 ParseError(0.18.10 該錯誤碼不經 `strict`,實測);本套件 `throwOnError:false` 會把丟錯轉成 `.katex-error`,中文公式將整個變紅字原文.
- 單一擁有者:`src/md2html.mjs` 之 `markedKatex({...})` 選項;marked-katex-extension(`lib/index.esm.js`)以 `katex.renderToString(text, { ...options, displayMode })` 原樣透傳選項,不自設 `strict`(2026-11-09 讀碼).
- 盤點指令:`git grep -n "strict" -- src` 應無結果(離開碼 1;2026-11-09 實測無符合);`git grep -n "markedKatex" -- src` 應只有 `src/md2html.mjs` 之 import 與 `marked.use(markedKatex({` 兩處.
- 站點全集與判準(2026-11-09):

| 站點 | 判準 |
|---|---|
| `src/md2html.mjs` `markedKatex({ throwOnError:false, nonStandard:true })` | 已套(刻意不明設 `strict`) |
| `src/WMd2html.mjs` | 經 md2html,不另呼叫 KaTeX;其 `getUnresolvedRefs` 排除 `.katex`/`.katex-error`/`math`(見 R-FIGREF-01) |

- 實測矩陣(2026-11-09,`katex.renderToString(tex, { throwOnError:false, strict })`,katex 0.18.10 與 0.19.1 各一;`.katex-error` 欄為輸出含 `katex-error`):

| 輸入 | `strict` 未設 | `'warn'` | `'ignore'` | `'error'` |
|---|---|---|---|---|
| `面積 = x^2`(math 內中文) | 公式,warn 2 則 | 同未設 | 公式,0 則 | `.katex-error` |
| `\text{面積} = x^2` | 公式,0 則 | 同未設 | 同未設 | 公式 |
| `x = 😀`、`☃`、`ب` | 公式,warn 2 則(`unknownSymbol`+`symbolNotInFont`) | 同未設 | 公式;0.19.1 為 0 則(0.18.10 仍 1 則 `No character metrics`) | `.katex-error` |
| `\frac{1`(ParseError) | `.katex-error` | 同未設 | 同未設 | 同未設 |
| U+E000(私用區) | `.katex-error` | 同未設 | 同未設 | 同未設 |

  另:`strict` 為回傳 undefined 之函式時,0.19.1 視同未設(警告;與 0.19.0 發布說明「回傳 undefined/null 改為警告」一致),0.18.10 視同 `'ignore'`(中文 0 則警告);兩版皆不丟錯、不轉 `.katex-error`.

- 測試:`test/unit-md2html-deps.test.mjs` 之「含中文字元之公式」、「含不在字型內之符號」、「語法錯誤之公式以 .katex-error 呈現原始碼」3 條(語意斷言:`.katex`/`.katex-display` 在、無 `katex-error`、字元在顯示層、前後文不受影響;警告之有無與文字依版本而異,不斷言).指令:`npx mocha --no-parallel "test/unit-md2html-deps.test.mjs" --timeout 180000`.
- 變異證據(2026-11-09,於 `./tmp` 之 src 複本改 `markedKatex` 選項,0.18.10 與 0.19.1 各跑):`strict:'error'` 兩版皆 3 條轉紅(23 綠);`strict:(code)=>code==='symbolNotInFont'?'error':'ignore'` 於 0.19.1 僅「字型外符號」1 條轉紅(25 綠)、於 0.18.10 全綠(26)——證實 0.19.0 之行為變更;無變異對照組兩版皆 26 全綠.
- 已知限制:未設 `strict` 時,每個中文字元(math 模式)或字型外符號於 Node 端各印一則 `console.warn`(KaTeX 自身,非錯誤);要靜音須明設 `strict:'ignore'`(0.19.1 全靜音,0.18.10 仍有缺度量一則)並於 README 說明,尚未做,待裁示.

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
- 表格標記(`data-for="tab"`)之屬性全集、定位、處理順序與無效值處置見 R-TABLE-01(2026-11-09 起);行內 code 之字級見 R-CODEFONT-01.
- 測試:`test/md2html.test.mjs`(data-for=br 2 條、data-for=tab 與逐欄樣式 7 條;表格標記之擴充見 R-TABLE-01).

## R-TABLE-01 表格標記(data-for="tab")以邏輯欄定位,處理順序固定,無效值視為未給

- 規則:`div[data-for="tab"]` 之屬性套用至其後第一張表格(md 或 html 表格),處理後移除標記;屬性全集、語意與處理順序如下.使用端需求出處:Gitea #112、#113(2026-11-09).單一擁有者:`src/md2html.mjs` 之 data-for="tab" 區段與其上之內部輔助函數(`addStyle`、`getColMap`、`parseCols`、`pickProps`、`cellKey`、`canMerge`、`sameCell`、`mergeCellsH`、`mergeCellsV`).
  1. **逐欄樣式依邏輯欄**:`data-style-th-{n}`/`data-style-td-{n}` 之 n 為 0 起算之欄索引;表內有實際跨列或跨欄之 cell 時,依邏輯欄定位——`getColMap` 計入上方 rowspan 與左方 colspan 所佔之格,rowspan 不跨 thead/tbody/tfoot 區段(超出者截至區段末列,`rowspan=0` 為至區段末列),跨欄之格只在起始欄套用.why:過去以「該列第 n 個 th/td」定位,rowspan 下方各列少了左側之格而錯欄或漏套.
  2. **無跨列跨欄之表維持舊定位**:同列第 n 個同標籤(th 或 td)之 cell,混用 th/td 之列照舊(`data-style-td-0` 為該列第 0 個 td).why:使用端之既有輸出須逐位元組不變(主控裁示);邏輯欄於此類表與舊定位只在「混用 th/td 之列」不同.
  3. **行內 code 繼承儲存格字級**:表內每個 code 取其所在 th/td 最終 style(全域與逐欄套用後)之 `font-size`、`mso-line-height-rule`、`line-height`(同名取最後者,與 CSS 後宣告優先一致),依此順序寫入 code 之 style,置於 code 自帶 style 之前(自帶者優先).why:Word 匯入 html 時 code 不繼承 th/td 之 inline 字級,於固定行高下被裁切.表外之 code 不處理.
  4. **`data-style-code`**:附加於表內全部 code 之 style(位於繼承值之後、code 自帶 style 之前),缺結尾 `;` 者補之.
  5. **`data-merge-h="0,1,2"`**:同一列內,指定欄之間邏輯欄相鄰且 `innerHTML`(去頭尾空白)相同者合併為一格(colspan,刪除右側之格,保留最左格之內容與樣式);thead/tbody/tfoot 之列皆適用;被上方 rowspan 佔住之欄不算相鄰.
  6. **`data-merge-v="0,1"`**:各 tbody 內,指定欄上下相鄰且內容相同者合併為一格(rowspan,刪除下方之格);依列出順序為階層,後列之欄只在前列各欄之同一合併區塊內才合併;僅 tbody(thead/tfoot 刻意不併);各 tbody 獨立.
  7. **`data-merge-keep="true"`**:第一個 `data-merge-v` 欄之各區塊不跨頁——區塊內各列加 `page-break-inside:avoid`(Word 之 cantSplit),非末列各格內容外包 `<div style="page-break-after:avoid;">`(Word 之 keepNext);須有有效之 `data-merge-v`.
  8. **處理順序**:全域樣式 → 逐欄樣式 → code 繼承 → 左右合併 → 上下合併 → 不跨頁.逐欄樣式先於合併,故合併格保留其欄之樣式;左右合併後之格不再參與上下合併,故跨整列之分類列切斷上下合併.標記處理先於 `tableHorizontalAlignmentCenter` 之外包.
  9. **無效值視為未給,不拋錯、不影響其餘處理**(依 `輸入參數之檢測機制.md` K3 之精神:選填之值給了而不合,改用未給;此為 md 內容之標記屬性,非函數 opt):欄索引逗號分隔,各項去頭尾空白後須為 `^\d+$` 且為安全整數,重複者取一次,無效之項略過(含超出欄數者無對應 cell,無作用);`data-merge-keep` 只有去頭尾空白後等於 `true`(全小寫,同 B2 廣義布林)才啟用;標記後無表格者只移除標記.
  10. **合併之保守判準**:空白格(`innerHTML` 去頭尾空白為空)不合併;th 與 td 不互併;已有 rowspan/colspan(含先行左右合併而成之 colspan)之格不參與;內容以 `innerHTML` 比對(含行內 code 已繼承之 style),同字而格式不同者不合併.
- 盤點指令:`git grep --untracked -nE "kpCol|hasSpan|colsH|colsV|mergeKeep" -- src`;表格標記屬性全集:`git grep --untracked -noE "data-(style|merge)-[a-z]+(-\{n\})?" -- src README.md test/report.md`.
- 站點全集與判準(2026-11-09):

| 站點 | 判準 |
|---|---|
| `data-style-th/td-{n}`(有 span 之表) | 已套邏輯欄(`kpCol`) |
| `data-style-th/td-{n}`(無 span 之表) | 刻意不套邏輯欄:(2) 之舊定位,輸出逐位元組不變 |
| 全域 `data-style-th/td` | 不涉定位(`tab.querySelectorAll('th'/'td')`),維持 |
| code 繼承與 `data-style-code` | 已套(`tab.querySelectorAll('code')` 取最近之 th/td,表外與 caption 內之 code 只附加 `data-style-code`) |
| `data-merge-h` | 已套(thead/tbody/tfoot 各列) |
| `data-merge-v`、`data-merge-keep` | 已套(僅 tbody);thead/tfoot 刻意不套(建議以 tbody 資料列之群組為範圍) |
| 巢狀表(cell 內之 table) | 邏輯欄、合併只處理外層 `tab.rows`;全域 `data-style-th/td` 與無 span 之舊定位仍含巢狀表之 th/td/tr(與過去相同,已知限制) |

- 測試(`test/md2html.test.mjs`,2026-11-09 共 35 條,依 R-TABLE-01 條號標註):逐欄樣式依邏輯欄 5 條((1)(2));行內 code 之 code 繼承與 `data-style-code` 5 條((3)(4));合併 22 條((5)~(10));另 3 條 styleDef(R-CODEFONT-01).指令:`npx mocha --no-parallel "test/md2html.test.mjs" --timeout 180000`.
- 驗證(2026-11-09):①修前紅:新測試 35 條對 HEAD 版 `src/md2html.mjs` 之 28 紅(其餘 7 條為「不變」類之守衛:未用字級與 `data-style-code` 時 code 不加 style、表外 code 不受影響、無 span 之表維持舊定位、未指定與不相鄰不合併、已有 span 不參與、空白格與 th/td 不併、標記後無表格不拋),守衛類與其餘以變異驗證:25 種變異全殺(各變異與其被殺之測試見 `sgud/exp/experience.md` 2026-11-09);②等價(L3):無標記之表 60 份、只用既有屬性且無 rowspan/colspan 之表 120 份(含 raw html 混用 th/td、tfoot、caption)、repo 既有 md 6 份,HEAD 版與現行版輸出逐位元組相同(含 code 者僅差 `<code style>`);③轉 docx(Word 16,w-html2docx 1.0.49):建議附錄之表 A~E 與左右合併表 F 共 13 項皆符(`w:sz`、`w:vMerge`、`w:gridSpan`、`w:cantSplit`、`w:keepNext`、`w:shd`、`w:color`、`w:jc`),HEAD 版 13 項皆不符.

## R-CODEFONT-01 行內 code 之字級須明訂為所在元素之字級(styleDef)

- 規則:styleDef 須對 li、table、p、h1~h6 內之行內 code 明訂 `font-size` 為該元素種類之字級選項值(`fontSizeDef`、`fontSizeTab`、`fontSizeP`、`fontSizeH1`~`fontSizeH6`);li、table 內之區塊程式碼(`pre code`)維持 `fontSizeCode`.why:Word 匯入 html 時 `<code>` 不繼承父層字級(`font-size:inherit` 亦無效),其 run 無 `w:sz` 而沿用文件預設字級(12pt),使同表同標題內程式碼與周圍文字不一,固定行高下底線被裁.不採等長字型(w-html2docx 以 `fontFamilies` 強制全文字型,使用端確認不需).
- 順序(同特異度,後宣告優先):li、table 先於 p(td/li 內 p 之文字為 `fontSizeP`,其內 code 須同);pre 規則(`.md li pre code`、`.md table pre code`)後於 li、table 規則.
- 單一擁有者:`src/md2html.mjs` 之 styleDef(R-CSS-01 之同一字串);表格標記內之 code 另依 R-TABLE-01(3) 依儲存格 inline style 明訂.
- 盤點指令:`git grep --untracked -nE "^\.md .*code \{" -- src`;各元素內 code 之父元素鏈以 md2html 轉 `p/li/blockquote/h1/表格/註腳/清單內 pre` 實測(2026-11-09).
- 站點全集與判準(2026-11-09):

| 站點(code 之位置) | 判準 |
|---|---|
| p、li、table(td/th)、h1~h6 | 已套 |
| blockquote | 已套:marked 於 blockquote 內必包 p(實測 `blockquote > p > code`),隨 p |
| 註腳(`section > ol > li > p`) | 已套:隨 p |
| li、table 內之 `pre code`(區塊) | 已套 `fontSizeCode`(與過去之瀏覽器外觀相同:pre 之 `fontSizeCode` 由 code 繼承) |
| 頂層 `pre code`(區塊) | 刻意不套:過去即無 code 規則,維持 |
| raw html 之 div/span 等內之 code | 未套,已知限制:瀏覽器繼承 `.md` 之 `fontSizeDef`,Word 沿用文件預設字級 |
| 元素以手寫 `style` 設字級者之內之 code | 未套,已知限制:瀏覽器改採該元素種類之 `fontSize*`(README〈Upgrade Notes〉已註明);表格請改用 data-style-th/td 標記(R-TABLE-01(3)) |

- 測試:`test/md2html.test.mjs` 之 styleDef 3 條(各元素之規則、後宣告順序與 pre 規則、`mergeStyle:true` 內嵌);`test/reportTrue.html` 之 styleDef 增列 36 行(含 2 行註解與 1 空行)為此規則之標準輸出.

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
- 單一擁有者:`src/WMd2html.mjs` 之 `reTag`(標籤掃描式,與 R-IMGREF-01 之 `cvPicRef` 共用,單一定義)、`findAttr`/`getAttr`(同,2026-10-31 由 `getAttr` 拆出 `findAttr` 回傳位置供 `cvPicRef` 改寫,`getAttr` 行為不變)、`getItemName`(取名)、`getUnresolvedRefs`(偵測)與寫檔前之警告輸出段.md2html(瀏覽器端)不處理圖表編號.`walkTokens` 只登記 image 與 html token 內 `<img>` 之本機圖(R-IMGREF-01),不涉圖表名.
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

- 規則:①md 語法圖(`walkTokens` 之 image token)與原始 `<img>` 標籤之 `src`(`walkTokens` 之 html token,區塊與行內皆是,呼叫 `cvPicRef(token.text)`:以 `reTag` 逐標籤掃描[註解整段略過],只處理標籤名為 `img`[不分大小寫]者,`findAttr` 取第一個名稱完整相等之 `src`[值可為雙引號/單引號/無引號,`data-src` 與他屬性值內之 `src` 字樣皆非],非空且為本機圖時整個屬性改寫為 `src="佔位符"`;一段文字可有任意多個標籤、標籤屬性可跨行;程式碼區塊與行內碼不是 html token 故不處理;不再逐行、不再有 `size(s)!==2`;2026-10-31 由「逐行 `split('src="')` 且須恰一個」改此,見破壞性變更紀錄)之本機圖皆只經 `regImg(ref)` 登記:以 **md 所在資料夾**解析為絕對路徑(絕對路徑照用,不做 cwd 優先回退、不解碼 `%XX`),回傳佔位符 `${phImg}${編號}`(同一檔共用一個)取代 `src`;非本機圖(空值、`^[A-Za-z][A-Za-z0-9+.-]+:` 之協定[至少 2 字元,磁碟代號 `C:\` 不是協定]、`//`、`#` 開頭)回傳 null,維持原值、不檢查、不 reject.②`md2html` 完成並套模板、`getUnresolvedRefs` 偵測後,`fillImgs(h)` 一次處理:掃 `src="${phImg}(\d+)"` 得各圖引用次數(未出現於輸出者不檢查);**任一被引用之圖檔不存在即 reject**,訊息 `N image file(s) do not exist:` 之後逐行列出全部缺圖絕對路徑(去重);`imgConvertToBase64=false` 時寫入路徑原樣(`path.resolve` 之原生形式,Windows 為反斜線,不做百分比編碼,僅逸出屬性值內 `& " < >`),不讀檔不轉碼;`true` 時先以原檔大小估算 `Σ ceil(n/3)*4*引用次數`,超過 `IMG_BASE64_MAX_CHARS`(2^27 字元)即 reject(訊息含張數、檔案 MB、估算字元數、上限與建議改用 `imgConvertToBase64=false`),再依序以 `wi.base64(fp,'png')` 轉碼(各檔一次,同檔多處共用字串),轉碼後累計實際字元數超過上限再 reject(JPG、SVG 轉 PNG 後可能遠大於原檔).③`phImg` 初值 `wmd2htmlimg`,md 或 `htmlTemp` 含該字串即加 `x` 直到不含,使模板內同形之 `src="wmd2htmlimgN"` 不被改寫.
- why 佔位符(不在 `md2html` 之前或 `walkTokens` 內直接寫路徑/base64):①**DOMPurify 會移除值為 Windows 絕對路徑(`C:\…`)之 `src`**(視為未知通訊協定,實測 `<img src="C:\x.png">` 清洗後成 `<img>`),絕對路徑只能於清洗之後寫入——審計 md2docx-run01 §7.2 預期「改寫 href 即可」未涵蓋此點;②base64 資料不進 marked、DOMPurify、jsdom:修前清洗後堆積約為 html 字元數之 35 倍,預設堆積(4288MB)下約 80~100MB 圖片即 OOM 中止行程(離開碼 134,呼叫端收不到 reject);改後 150 張(82MB)RSS 649MB(修前約 4294MB)、耗時 5.3s(修前約 30s).
- 上限常數 `IMG_BASE64_MAX_CHARS = 2 ** 27` 之依據(2026-10-29,Node v24.22.1,1600x900 雜訊 PNG 每張 0.52MiB,量測腳本副本見任務證據夾 `md2html-run01-evidence/scripts/meas-run.mjs`,`./tmp/` 已清):圖片不經 DOM 後峰值記憶體隨 base64 字元數線性成長(RSS 約 4.5~5 倍、堆積約 1~2 倍):150/300/450/600 張(1.09/2.18/3.27/4.36 億字元)RSS 649/1091/1527/1982MB;750 張(5.45 億字元)超過 V8 字串上限(536,870,888)丟 `Invalid string length`;245 張(1.78 億字元)於 `--max-old-space-size=384`(堆積上限 576MB)通過、300 張於同設定 OOM、於 512 通過.取 2^27(約 96MiB 之 PNG,與審計「約 80 MB 量級」一致)於 576MB 堆積上限下有約 1.3 倍餘裕;**可提高**(實測 4288MB 預設堆積下 4.36 億字元仍通過),但小堆積機器風險隨之增加,未經裁示不提高.
- 單一擁有者:`src/WMd2html.mjs` 之 `regImg`、`cvPicRef`(只由 `walkTokens` 呼叫;掃描式 `reTag` 與 `findAttr` 與 R-FIGREF-01 之 `getItemName` 共用)、`fillImgs`、`phImg`、`fpsImg`/`kpFpImg` 與常數 `IMG_BASE64_MAX_CHARS`;`wi.base64` 只應出現在 `fillImgs`.`md2html.mjs`(瀏覽器端)不處理檔案路徑,`funWalkTokens` 之契約不變.
- 盤點指令:`git grep --untracked -nE "wi\.base64|path\.resolve\(fdIn|fsIsFile|IMG_BASE64_MAX_CHARS|regImg\(" -- src`:`wi.base64` 應只有 `fillImgs` 內一處;`path.resolve(fdIn` 只有 `regImg`;`regImg(` 呼叫只有 `cvPicRef` 與 `walkTokens`;`fsIsFile` 於 `WMd2html` 為 fpIn 檢查與 `fillImgs` 缺圖檢查.另 `git grep --untracked -nE "cvPicRef\(|new RegExp\(reTag|split\(.*src=" -- src`:`cvPicRef(` 呼叫只有 `walkTokens` 一處(定義除外);`new RegExp(reTag` 只有 `getItemName` 與 `cvPicRef` 兩處(`reTag` 定義處之註解亦會列出);無 `split(…src=` 之結果(2026-10-31 前逐行 `split('src="')` 之寫法不得復現).
- 站點全集與判準(2026-10-29):

| 站點 | 判準 |
|---|---|
| md 語法圖(相對、`./`、子夾、`<…>` 包空白、中文、`& # % '`、絕對路徑) | 已套(`regImg`),有測試 |
| 原始 `<img>` 之 `src`(雙引號/單引號/無引號、等號兩側空白、標籤與屬性名大小寫、他屬性前後、標籤屬性跨行;相對、中文與空白、絕對路徑、`&amp;` 樣式檔名、單引號值含 `"`、雙引號值含 `'`) | 已套(`walkTokens` html token→`cvPicRef`→`regImg`),有測試(2026-10-31 起通用解析;修前只認雙引號) |
| 具協定之網址、`data:`、`//`、`#`、空值(md 語法與原始 `<img>`) | 已套(不處理不 reject),有測試;修前原始 `<img>` 行遇網址丟錯 |
| 缺圖(兩處、兩種模式、多個、重複只列一次、不進輸出者不查) | 已套(`fillImgs` reject),有測試 |
| 總量上限(預檢邊界、逐處計、轉碼後實際長度、路徑模式不受限) | 已套,有測試 |
| 同一段文字多個 `<img>`(同行、混合引號形態、同圖重複、與 md 語法圖同行混用、區塊 `<div>` 內多個且含圖題) | 已套,有測試;修前同行兩個 `src="` 丟 `size(s)!==2`(2026-10-31 修) |
| 屬性名稱須完整相等(`data-src`、`alt` 等屬性值內之 `src=` 字樣不是 `src`);同一標籤重複 `src` 取第一個 | 已套(`findAttr`),有測試;修前 `data-src` 使同行丟錯、`alt` 內之 `src="…"` 被改寫且佔位符殘留 |
| 非 `<img>` 標籤之 `src`(`<video>`、`<source>` 等) | 刻意不處理(README 契約為 `<img>`),有測試;修前被當圖片(缺檔 reject) |
| 程式碼區塊/行內碼內之 `<img …>` 文字 | 已套(不是 html token,不登記不改寫),有測試;修前:行內碼內被改寫(路徑/整段 base64)或缺檔 reject,上色之區塊內佔位符殘留 |
| 表格儲存格、清單、引用區塊、連結內之行內 `<img>`(單引號/無引號/雙引號);HTML 註解內之 `<img>` | 已套(行內 html token / 註解整段略過),有測試 |
| `srcset`、`<picture><source>`、CSS `url()`、`<input type="image">` | 刻意不處理(修前亦不處理),維持原值 |
| 無引號 `src` 值含 `=`、引號、`<`(如 `a.png?x=1`) | marked(CommonMark)不視為 HTML 標籤而輸出為文字,本套件無從處理;README 已註明請加引號;`<img src=a.png/>` 之值依 HTML 規則為 `a.png/`,`path.resolve` 去尾端分隔符故等同 `a.png`(實測,無測試) |
| 路徑含 `# % %20 & '` 及 `&amp;` 樣式檔名時 Word 是否能解析 | 已實測可解析(見下「Word 探測」);其餘 Word 不可解析之情形(若有)由下游 w-html2docx 之連結檢查報錯 |
| 路徑含 `"` 之逸出 | 有測試但 Windows 無法建此檔名(pending);Ubuntu CI 才會跑 |

- 測試:`test/unit-imgPath.test.mjs`(45 條 + 1 pending:21 條為路徑模式[md 語法/原始 img/絕對/原生形式/不以 cwd 解析/特殊字元/實體樣式檔名/多處引用/網址/註解內/模板同形/不讀內容]、缺圖 reject[兩模式]、base64[預設內嵌與 `wi.base64` 同、超限訊息、邊界、逐處計、轉碼後實際長度、路徑模式不受限、無本機圖];2026-10-31 新增 24 條為 `describe('原始<img>之src屬性解析…')`:引號形態[雙/單/無引號、等號兩側空白、大小寫、他屬性]×2 模式、同行多個×2、md 語法圖與 `<img>` 混合×2、缺圖列全部×2、屬性名稱完整相等×2、重複 src、引號內含另一種引號與中文空白、標籤屬性跨行×2、非本機圖×2、註解內、非 img 標籤×2、程式碼內×2、表格/清單/引用/連結內×2、圖題與同行多個 img 之交叉引用.各檔以 `sharp` 產內容不同之 1x1 PNG,使 base64 模式下可區分各圖).指令:`npx mocha --no-parallel "test/unit-imgPath.test.mjs" --timeout 180000`.大檔以稀疏檔(`ftruncate`)於 `test/_tmp/unit-imgPath/` 產生,執行時產生、測完即刪.上限由訊息取得,測試不複製常數.
- 變異驗證(2026-10-29,`md2html-run01-evidence/scripts/runmut.mjs` 於 src 複本逐一變異後跑上列測試):31 種中 30 種被抓到(括號為失敗條數):網址不排除(2)、不含 `//`(1)、不含 `#`(1)、單字元協定(1)、空值不排除(1)、以 cwd 解析(18)、cwd 優先回退(1)、正斜線(11)、百分比編碼(11)、不逸出 `&`(2)、路徑模式走 base64(11)、base64 走路徑(5)、預設改 false(5)、不查缺圖(3)、只列第一個(2)、缺圖含未進輸出者(1)、張數錯(2)、無預檢(3)、邊界 `>=`(1)、估算不乘次數(1)、無實際長度檢查(1)、實際長度不乘次數(1)、floor 少算(1)、不呼叫 `fillImgs`(19)、`walkTokens` 不登記(12)、`cvPicRef` 不處理(14)、不避模板同形(1)、不共用編號(4)、`s1s[0]` 錯(9)、訊息無建議(1);**存活 1 種:不逸出 `"`**(Windows 無法建含 `"` 之檔名,該測試於 Windows 為 pending,待 Ubuntu CI).
- 修前紅(2026-10-29,`git show HEAD:src` 複本跑同一測試檔):路徑/缺圖/網址等 11 條敗、2 條(預設 base64、無本機圖)綠;超限類 4 條使修前之行程 OOM 中止(離開碼 134),即為紅.
- Word 探測(2026-10-29,Word 16,經 `quiet-run --lock`;`wordprobe-prep.mjs` 以本套件路徑模式輸出 html,`word-inspect.py`[審計證據夾腳本]以 Word 唯讀開啟並列 `InlineShapes`):10 張 100x50 之圖,路徑分別為「中文與空白」「目錄含 `#`」「檔名含 `#`」「目錄含 `%`」「檔名含 `%`」「目錄含 `%20`」「目錄含 `&`」「檔名含 `&`」「檔名含 `'`」「檔名含 `&amp;` 樣式」,`src` 皆為反斜線絕對路徑(`&` 於 html 內逸出為 `&amp;`):**10/10 之 `LinkFormat.SourceFullName` 等於原檔路徑、顯示尺寸為圖之原尺寸(283.45x141.7 pt),非破圖之 24x24**(`InlineShape.Type=4` 為 Word 直開 html 之連結圖,屬預期,下游斷開連結後內嵌).故路徑原樣寫入(不編碼)對上述特殊字元可用;僅逸出 `& " < >` 為 html 屬性語法所需.證據 `md2html-run01-evidence/word-probe.json`.
- 等價(L3):`md2html-run01-evidence/scripts/equiv.mjs` 以 `test/report.md` 加 png/jpg/svg、md 語法圖與原始 `<img>`(含重複引用、網址圖)於預設與 `imgWidthMax` 兩組選項,修前與修後輸出逐字相同(149,678 與 149,794 字元,各 6 個 data URL);修前多印一行 `href[https://example.com/x.png] does not exist`(md 語法網址圖),修後無.

- 變異驗證(2026-10-31,於 src 複本逐一變異後跑新增之 24 條,對照組無變異 0 失敗):17 種全被抓到(括號為失敗條數):標籤名區分大小寫(2)、屬性名區分大小寫(2)、不認單引號值(17)、不認無引號值(16)、重複 `src` 取最後(1)、屬性名只比後綴使 `data-src` 視為 `src`(2)、不限 `<img>` 標籤(2)、`walkTokens` 不處理 html token(20)、改寫時丟棄 `src` 之前屬性(20)、丟棄之後屬性(2)、掃描式不認單引號值(19)、只處理區塊 html token(10)、`cvPicRef` 非全域(1)、等號兩側不容空白(2)、無引號值於 `/` 截止(16)、非本機圖亦改寫(2)、另對整份 md 文字先做一次 `cvPicRef`(22).未列入:掃描式拿掉註解分支(等價變異:註解內之圖雖被登記,但註解不進輸出,`fillImgs` 只查輸出中被引用者,輸出相同).
- 修前紅(2026-10-31,`git archive HEAD src` 解到 `./tmp/` 之複本,以 mocha 跑新測試檔之新 describe):24 條中 22 條敗、2 條綠(非本機圖×2 模式,屬保護「不處理」不被破壞之案).
- 等價(L3,2026-10-31,以 HEAD 複本與現行 src 轉同一批 md,各 `imgConvertToBase64` 兩值):`test/report.md`、`SECURITY.md`、`sgud/exp/experience.md` 輸出逐字相同;`README.md`、`sgud/rule/rulebook.md`、`sgud/state/state.md`(文中說明含 `src="` 字樣)修前丟 `size(s)!==2`,現可轉換.

## R-JSDOM-01 Node 端對 jsdom 之依賴限於下列面向;輸出不得隨 jsdom 之 CSS 引擎序列化而變

- 規則:①`tableHorizontalAlignmentCenter` 將 table 設 inline-table 時,只於 `style` 屬性末尾附加 `display: inline-table;`(`setInlineTable`,前值未以 `;` 結尾先補;既有 display 帶 `!important` 則附加之宣告亦帶;已為 `inline-table` 不重複),**不得以 `el.style.xxx = …` 賦值**(賦值會使整串 style 由 DOM 實作重新序列化);外包 div 以 `setAttribute('style', 'text-align: center;')`.②`new JSDOM(html)` 只用預設選項(不設 `runScripts`、`resources`),建構子回傳即視為完整解析,不讀 `readyState`、不等 `load`、不用 `getComputedStyle`、不用 canvas.③`rowSpan`/`colSpan` 直接用 DOM 之 IDL 值(已夾限),不自行 `parseInt`.
- why①:jsdom 31 之 CSS 引擎重寫,對 `el.style` 賦值後整串 style 之序列化結果與 30.x 不同:`page-break-*` 被改寫為 `break-*`(Word 匯入只認 `page-break-*`)、`-webkit-` 前綴被移除、字型名引號被拿掉、簡寫重排與值正規化;30.x 則靜默丟棄大寫屬性名、`mso-*`、`filter`、不合法宣告(31 同樣丟 `mso-*`、`filter`).改以字串附加後,輸出與 jsdom 版本、瀏覽器引擎皆無關(同一份 src 於 jsdom 30.1.3、31.0.0 之輸出逐字相同;HeadlessChrome 156 與 Node 端相同).
- 單一擁有者:`src/md2html.mjs` 之 `setInlineTable`(含其呼叫處);`src/WMd2html.mjs` 之 `getUnresolvedRefs`.
- 盤點指令:①`git grep -n -E "\.style(\.[A-Za-z]+)* *=[^=]" -- src`,判準:`.style` 賦值 0 處(`.style` 只出現在 `setInlineTable` 之讀取 `.style.display`、`.style.getPropertyPriority`,及說明註解);②`git grep -n -E "getComputedStyle|runScripts|resources *:|readyState|createCanvas|getContext|fromURL|fromFile|\.serialize\(" -- src`,判準:0 命中;③`git grep -n "new JSDOM" -- src`,判準:恰 2 處(`md2html.mjs` `new JSDOM('')`、`WMd2html.mjs` `new JSDOM(html)`),皆無第二個引數(預設選項).
- 站點全集與判準(2026-11-14,jsdom 31.0.0):

| 站點 | 依賴之 jsdom 行為 | 31 破壞性變更之影響 | 判準 |
|---|---|---|---|
| `src/md2html.mjs:736-740` `new JSDOM('')`、`DOMPurify(window)`、`window.document` | 空文件、DOM API | 無 | 不受影響 |
| `src/md2html.mjs:753、892` `box.innerHTML` 解析片段與序列化 | parse5 片段解析與序列化 | 無(序列化 13 型探測輸出不變;片段解析不經非同步) | 不受影響 |
| `src/md2html.mjs:756-872` `querySelectorAll`(`[style*="display:none"]`、`div[data-for=…]`、`th`、`td`、`tr`、`code`、`a[href]`、`table`)、`closest('th, td')`、`getAttribute/setAttribute` | 選擇器、屬性 | CSS 引擎重寫含選擇器;9 組選擇器探測輸出不變 | 不受影響 |
| `src/md2html.mjs:51-227` `getColMap`、`cellKey`、`canMerge`、`mergeCellsH/V`:`tab.rows`、`tr.cells`、`rowSpan`、`colSpan`、`innerHTML` | IDL 夾限(rowspan=0 回 0、colspan=0 回 1、無效回 1、colspan 上限 1000、rowspan 上限 65534) | 無 | 不受影響 |
| `src/md2html.mjs:36-47、883-886` `setInlineTable`、外包 div(原為 `el.style.display=`、`wrap.style.textAlign=`) | CSSOM 賦值後整串序列化 | **受影響**(見上 why①) | 已調適 |
| `src/WMd2html.mjs:225-248` `getUnresolvedRefs`:`new JSDOM(html)` 後同步 `createTreeWalker`、`querySelectorAll`、`replaceWith/before/after`、`textContent`、`window.close()` | 建構子回傳完整解析 | HTML 解析改非同步(遇阻塞式 script 暫停);預設選項下 script 不載入不執行,實測 8 型含外部阻塞式 script/async/defer/module/document.write/link/@import/iframe 皆回傳即完整(`readyState` 30.x 為 `loading`、31 為 `interactive`,不屬契約) | 不受影響,測試鎖定 |
| `test/unit-imgPath.test.mjs:63、544` `new JSDOM(html)` | 測試端解析輸出 | 同上 | 不受影響 |

- 測試:`test/unit-md2html-jsdom.test.mjs` 27 條——table 之 style 不改寫與 display 覆寫 13 條(①)、jsdom 行為契約 6 條(②③:預設選項即完整解析 8 型、片段解析、rowSpan/colSpan 夾限、畸形跨度不丟錯、宣告主版號與已安裝一致且 Node 符合 engines、1000 層巢狀)、未解析引用警告於含 script/外部資源之自訂模板 8 條(②);另 `test/md2html.test.mjs` 之 table 置中既有案.指令:`npx mocha --no-parallel "test/unit-md2html-jsdom.test.mjs" --timeout 180000`
- 驗證紀錄(2026-11-14,jsdom 30.1.3 → 31.0.0):①**修前紅**:未調適之 src(以 el.style 賦值)配 jsdom 31 跑新測試 10 敗、17 綠(綠者為 jsdom 行為與警告之守衛案).②**變異**:`setInlineTable` 拿掉 `!important` 分支、拿掉已為 inline-table 之早退、改為「已有 display 即不覆寫」、`getUnresolvedRefs` 於首個 `<script` 截斷,4 種全被抓到(1、1、3、6 條敗).③**等價比對**(L3):同一份輸入(md 207 份×2 組選項=414、WMd2html 26、jsdom 探測 133,共 573)於 30.1.3 與 31.0.0 各跑兩次,同版兩次逐位元組相同(決定性);調適後 src 於兩版輸出 0 差異(md 414、WMd2html 26);調適前 src 兩版差異 24/414,皆僅 `<table style>` 屬性值(其餘逐位元組相同).④**瀏覽器端**:以 w-package-tools 之 `rollupFile` 將 src 打包至暫存夾,headless Chromium 156 載入實跑 9 案與 Node 端預期逐字相同.⑤`npm audit --omit=dev` 0 vulnerabilities.
- 已知限制:巢狀深度——轉換遞迴上限在 jsdom/parse5 之 `innerHTML` 序列化(`serializeElement` 遞迴),未預熱行程約 2200 層通過、2300 層丟 `Maximum call stack size exceeded`(30.1.3 與 31.0.0 相同,每次新行程階梯探測各 3 次);已預熱行程可更深(6000 層邊界成敗不定);屬既有限制,範圍外未修.

## R-TEST-01 測試清單與基準檔重產規則

| 測試檔 | 涵蓋 | 條數 |
|---|---|---|
| `test/unit-imgPath.test.mjs` | 本機圖片引用:路徑模式、缺圖 reject、base64 總量上限、原始 `<img>` 之 `src` 屬性解析(R-IMGREF-01) | 45(+1 pending) |
| `test/md2html.test.mjs` | DOM 後處理(display:none、data-for=br/tab、逐欄樣式、linkBlank、表格置中) 13 條;表格標記擴充 35 條(R-TABLE-01、R-CODEFONT-01:行內 code 字級 8、逐欄樣式依邏輯欄 5、合併儲存格 22) | 48 |
| `test/genNumForPicAndTab.test.mjs` | 圖表自動編號與交叉引用 | 4 |
| `test/unit-genNumRefs.test.mjs` | 圖表名取法(單行/多行)與未解析引用警告(R-FIGREF-01) | 17 |
| `test/WMd2html.test.mjs` | report.md 全文逐字比對 `test/reportTrue.html`(現狀指紋;4.1.3、4.1.4 為表格標記之範例,與 `examples/ex-md2html.html` 同步,R-EXAMPLE-01) | 1 |
| `test/unit-md2html-deps.test.mjs` | 依賴契約:KaTeX(CSS 版本、行內、區塊、nonStandard、throwOnError、含中文與字型外符號之公式不因 strict 變錯誤呈現,見 R-KATEX-01)、highlight(已知/未知/未指定語言)、footnote 屬性、marked renderer 與 async walkTokens、DOMPurify(on*、script/iframe、javascript:、`<style>` 移除與其邊界,見 R-SANITIZE-01)、WMd2html(CSS、`<style>` 移除、Footnotes 標題隱藏、圖片轉 base64) | 26 |
| `test/unit-md2html-jsdom.test.mjs` | jsdom 依賴契約(R-JSDOM-01):table 置中時 style 宣告不改寫與 display 覆寫、預設選項下建構子回傳即完整解析、rowSpan/colSpan 夾限、含 script/外部資源之模板之未解析引用警告、宣告主版號與已安裝一致、1000 層巢狀 | 27 |

- 指令:`npm test`(2026-11-14 jsdom 30.1.3 → 31.0.0 升版與 R-JSDOM-01 新增 27 條後為 168 passing、1 pending,升版前後既有 141 條皆綠[修前 jsdom 30.1.3 與升版後 31.0.0 配未調適 src 各為 141 passing、1 pending、0 failing];2026-11-09 之 R-KATEX-01 新增 3 條後為 141 passing、1 pending[見 state.md];同日稍早為 138 passing、1 pending,其中 `md2html.test.mjs` 48 條[13+35];2026-10-31 為 103 passing、1 pending,其中 `unit-imgPath` 45 條、其餘各檔合計 58 條[13+4+17+1+23];2026-10-29 為 76 passing、1 pending[`unit-imgPath` 之 `"` 路徑,Windows 無法建檔],加 `unit-imgPath` 21 條;2026-10-25 為 58 passing;2026-10-11 為 41,加 `unit-genNumRefs` 17 條).`test/report.md` 第 140 行標題含正文 `{n}`,`test/WMd2html.test.mjs` 轉換時會多印一行警告(屬實:該 `{n}` 對不上任何圖表名),不影響逐字比對.
- 基準檔重產:`test/reportTrue.html` 僅在依賴升版造成之預期差異時重產;先列預期差異,以腳本逐行驗證差異僅限預期項目,經使用者授權才覆蓋.2026-10-07 重產,差異 3 行(KaTeX CSS 版本、base/strut/sizing 改名).2026-11-09 重產(主控授權,Gitea #112、#113):分兩階段驗證——① report.md 不動、僅 styleDef 增列行內 code 規則(R-CODEFONT-01),輸出差異為單一處純新增 36 行(0 刪除);② report.md 新增 4.1.3、4.1.4 兩節範例後,與修前之總差異為兩處純新增(styleDef 36 行、新增兩節 65 行,0 刪除),其餘 459 行逐字不變.重產指令:以 `test/WMd2html.test.mjs` 相同選項(`imgWidthMax:'500px'`)對 `test/report.md` 呼叫 `WMd2html` 寫至暫存路徑,與現行 `reportTrue.html` 以 `git diff --no-index -U0` 比對,確認僅新增後覆蓋.

## 已知限制

- 瀏覽器端 bundle(`dist/md2html.umd.js`)與下游 bundler 以 src 匯入之路徑無自動化測試,升版時以 Playwright 開啟範例頁驗收.
- dompurify 內嵌於 Node 版 UMD(見 R-BUILD-01).
- style 屬性之定位與溢出可蓋住區塊以外之頁面(見 R-SANITIZE-01,另案處理).
- md2html 與 WMd2html 不對稱(範圍外,未修):隱藏 Footnotes 標題與 li 間距只在 `src/WMd2html.mjs` 處理,瀏覽器端會顯示「Footnotes」標題;WMd2html 以字串取代 `<li>` 加間距,不涵蓋帶屬性之 `<li id="...">`(註腳項目).
- `toolg/gDistRollup.mjs` 之 `getFiles` import 未使用(eslint no-unused-vars,既有).
- `test/genNumForPicAndTab.test.mjs` 以 `./tmp` 為測試暫存(全域規範應為 `test/_tmp/`,既有).
- 表格標記(R-TABLE-01、R-CODEFONT-01)之已知限制:①巢狀表只處理外層之邏輯欄與合併;②合併以 `innerHTML` 比對,同字而行內 code 樣式因欄而異者不合併;③超出區段末列之 rowspan 截至區段末列(依 HTML 表格模型,未以瀏覽器實測);④raw html 之 div/span 內之 code 與手寫 `style` 設字級之元素內之 code 不在 styleDef 之 code 規則內(見 R-CODEFONT-01 站點表);⑤Word 實測僅 Word 16 與 w-html2docx 1.0.49 一組.

## 破壞性變更紀錄

| 日期 | 變更 | 影響 |
|---|---|---|
| 2026-11-14 | jsdom 30.1.3 → 31.0.0(R-JSDOM-01;由外部依賴升級原則觸發,使用端無對應 Gitea 編號):canvas 後端、CSS 引擎、HTML 解析非同步三項破壞性變更;`tableHorizontalAlignmentCenter` 改以字串附加 `display: inline-table;`,不再經 `el.style` 賦值 | Node 下限不變(`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`);本套件未用 canvas、`getComputedStyle`、`runScripts`、`resources`、`readyState`;**行為變更一處**:md 內手寫帶 `style` 之 `<table>` 且啟用置中者,其 style 屬性文字改為使用者所寫之原樣(過去為 jsdom 序列化形態,如 `width: 100%;`、`#666`→`rgb(102, 102, 102)`),宣告語意不變,過去被丟棄之宣告(大寫屬性名、`mso-*`、`filter`、不合法者)現保留;未帶 style 之 table、其他輸出逐字不變(等價比對 md 414 筆之修前修後差異 102 筆中,97 筆僅 `<table style>` 屬性值不同、5 筆為 6000 層巢狀邊界之堆疊雜訊[兩版上限相同],見 R-JSDOM-01);新增依賴 bcp-47、bcp-47-match、parse5-parser-stream,移除 css-tree、@asamuzakjp/*、@csstools/* 等 |
| 2026-11-09 | 表格標記擴充(R-TABLE-01、R-CODEFONT-01;Gitea #112、#113):styleDef 增列行內 code 依所在元素之字級;標記表內 code 繼承儲存格字級行高、`data-style-code`;逐欄樣式於有 rowspan/colspan 之表改依邏輯欄;新增 `data-merge-h`、`data-merge-v`、`data-merge-keep` | 新增屬性,未使用者不受影響;未使用新屬性且無 rowspan/colspan 之表輸出逐位元組不變(差異比對 180 份 + repo 既有 md 6 份,含 code 者僅差 `<code style>`);行為變更三處:①styleDef 多 36 行(`mergeStyle:true` 之 `<style>` 同);②元素以手寫 `style` 設字級者,其內行內 code 於瀏覽器改採該元素種類之 `fontSize*`;③有 rowspan/colspan 之表之逐欄樣式由「該列第 n 個」改為邏輯欄(過去錯欄/漏套者自此正確).下游 w-md2docx/w-html2docx 不需改(轉 docx 實測 13 項皆符) |
| 2026-10-07 | katex 0.16.47 → 0.18.10 | 輸出之 KaTeX 內部 class(base、strut、sizing 等 20 個)加 `katex-` 前綴;styleSrcs 之 KaTeX CSS 改隨安裝版;下游自行載入 KaTeX CSS 或以其內部 class 寫樣式者須同步 |
| 2026-10-07 | jsdom 29.1.1 → 30.1.2 | Node 下限 `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`(Node 端轉換路徑;瀏覽器端不載入 jsdom);程式碼無須改 |
| 2026-10-07 | marked 18.0.10 → 18.1.0 | CommonMark 修正:含底線之自訂標籤以字面顯示、括號不成對之連結目的地不成連結、巢狀連結外層不成連結、硬換行後前導空白去除 |
| 2026-10-11 | 清洗移除 `<style>`(R-SANITIZE-01) | markdown 內容中之 `<style>` 不再出現於輸出(含其 CSS);w-md2docx、w-web-api 與本專案之 md 內容皆無依賴者(grep 實測);一般 markdown 之輸出逐字不變(`test/reportTrue.html` 比對通過) |
| 2026-10-25 | 圖題與有 src 之 `<img>` 同行時圖表名只取圖題文字;輸出可見文字中對不上之 `{…}` 警告(R-FIGREF-01) | 單行寫法(圖題與 `<img src>` 同行)過去靜默不取代之 `{圖名}` 自此取代;不含有 src 之 img 之行取名與修前逐字相同(多行寫法輸出不變,既有測試與 `reportTrue.html` 比對通過);「圖n」只出現在有 src 之 img 屬性內之行不再登記圖表名(仍佔用編號);新增 `console.log` 警告一行(`test/report.md` 之 `{n}` 會觸發),回傳值仍為 'ok';WMd2html 於警告偵測時動態載入 jsdom(本套件既有依賴) |
| 2026-10-29 | 本機圖片引用(R-IMGREF-01):`imgConvertToBase64:false` 時 md 語法圖與原始 `<img>` 一律改寫為以 md 所在資料夾解析之絕對路徑(Windows 反斜線);缺圖兩處兩模式皆 reject 並列全部路徑;base64 模式總量超過 2^27 字元即 reject;原始 `<img>` 行改以 md 所在資料夾解析(不再 cwd 優先);網址圖不處理不 reject | 不保留舊行為(專案原則 14):`false` 之輸出由原 href 變絕對路徑(下游須連帶,w-md2docx 另案);缺圖由「log 後繼續」變 reject;SVG/JPG 於路徑模式保持原檔(Word 內嵌向量/原檔,DPI≠96 之 JPG 顯示尺寸依 96 dpi,主控 2026-10-29 裁定接受);預設 `true` 未超上限者輸出逐字不變;內部改為佔位符流程使圖片不經 DOM(RSS 大幅下降) |
| 2026-10-31 | 原始 `<img>` 之 `src` 解析通用化(R-IMGREF-01,排程第 173 項):`src` 值可為雙引號/單引號/無引號,同一段文字可有任意多個 `<img>`;只處理 `<img>` 標籤(`data-src`、`alt` 內 `src=` 字樣、`<video src>` 等不處理);改於 `walkTokens` 對 html token 處理,程式碼區塊/行內碼內文字不再被當圖片 | 不保留舊行為(專案原則 14):同行多個 `<img src>` 不再丟 `size(s)!==2`;單引號/無引號之本機圖由「保持原值」變「登記並填入」(路徑模式為絕對路徑、base64 模式內嵌,缺檔 reject);`<video src>` 等非 img 標籤之本機檔由「被當圖片(缺檔 reject)」變「保持原值」;程式碼內之 `<img src="…">` 文字由「改寫/reject/佔位符殘留」變「原樣」;只含雙引號且每行一個 `<img src>` 之文件輸出逐字不變(`report.md` 兩模式實測);下游 w-md2docx、w-html2docx 以 `imgConvertToBase64:false` 取得之 html 中單引號/無引號圖自此為絕對路徑(過去為相對路徑,Word 端解析不到由 w-html2docx 之連結檢查報錯) |

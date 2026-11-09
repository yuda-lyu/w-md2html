# 狀態(現況)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本.只記現況,不寫過程(過程寫入 `sgud/exp/experience.md`).接續工作先讀本檔.

## 版本與驗證

- 套件版本:`package.json` 為 1.1.21(本輪不改;1.1.12 起之本機圖片引用等變更已含於其中——HEAD 之 `src/md2html.mjs` 與使用端取得之 1.1.21 發布版一致).發布由使用者/主控處理.
- 最近一次驗證:2026-11-09 `npm test` 138 passing、1 pending(`test/md2html.test.mjs` 48 條,其中表格標記新增 35 條;pending 1 條為 `unit-imgPath` 路徑含 `"` 之案,Windows 無法建此檔名);`npx eslint src/md2html.mjs test/md2html.test.mjs` 無輸出;新增 35 條之修前紅 28/35(其餘 7 條為守衛)、變異驗證 25 種殺 25、無標記之表輸出與 HEAD 逐位元組相同(180 份 + 既有 md 6 份)、轉 docx(Word 16)13 項皆符,見規則帳本 R-TABLE-01、R-CODEFONT-01.2026-10-31 之驗證(`unit-imgPath` 45 條、變異 17 種殺 17,R-IMGREF-01)仍適用.
- 依賴升版(2026-11-09 外部依賴跨主版號升級輪):`package.json` 已改 jsdom `^30.1.3`、marked `^18.1.2`、dompurify `^3.4.17`(由主控改,未提交);**katex 維持 `^0.18.2`(解析 0.18.10),不升 0.19.1**——marked-katex-extension 5.1.13(最新)之 peer `katex <0.19` 使宣告 `^0.19.1` 於無鎖檔時 ERESOLVE、消費端會版本分裂,見 R-DEP-01 複評,待裁示.katex 0.19.1 之執行期相容性已於隔離複本驗證(既有測試全過,僅 `reportTrue.html` CSS 版號一行不同),`strict` 契約見 R-KATEX-01(src 無須改,不明設 `strict`).
- 最近一次驗證(本輪):2026-11-09 `npm test` 141 passing、1 pending(新增 `unit-md2html-deps` 3 條,R-KATEX-01:含中文之公式、含字型外符號之公式、語法錯誤之公式分界;0.18.10 與 0.19.1 隔離複本皆綠,`strict:'error'` 變異兩版皆殺 3/3).
- 未發布之變更(自 1.1.21 起):表格標記擴充(styleDef 增列行內 code 依所在元素字級、標記表內 code 繼承儲存格字級行高與 `data-style-code`、逐欄樣式於有 rowspan/colspan 之表依邏輯欄、新增 `data-merge-h`/`data-merge-v`/`data-merge-keep`;見下表「表格標記」,README〈Behavior change after 1.1.21〉與〈Table Markup〉已寫);`test/reportTrue.html` 重產(styleDef 36 行、範例 65 行,純新增);`dist/`、`docs/` 未重建(發布時自動產製).下游 w-md2docx、w-html2docx 不需改(轉 docx 實測符合),待其以新版 w-md2html 為相依後方生效.

## 功能現況

| 功能 | 做到哪裡 | 規則帳本 | 測試 |
|---|---|---|---|
| Markdown 轉 HTML(`src/md2html.mjs`,瀏覽器與 Node 共用) | 完成:marked + KaTeX + highlight.js + footnote,DOMPurify 清洗(移除 `<style>`),DOM 後處理(display:none、data-for=br/tab、linkBlank、表格置中) | R-CSS-01、R-DEP-01、R-KATEX-01、R-BUILD-01、R-SYNTAX-01、R-SANITIZE-01 | `test/md2html.test.mjs`、`test/unit-md2html-deps.test.mjs`(26) |
| 表格標記(`data-for="tab"`)(2026-11-09;使用端 Gitea #112、#113) | 完成:全域樣式 `data-style-th/td`、逐欄樣式 `data-style-th/td-{n}`(有 rowspan/colspan 之表依邏輯欄,無者維持舊定位含混用 th/td 之列)、`data-style-code`、行內 code 繼承所在儲存格之 `font-size`/`mso-line-height-rule`/`line-height`、`data-merge-h`(左右合併 colspan,thead/tbody/tfoot)、`data-merge-v`(上下合併 rowspan,僅 tbody,依列出順序為階層)、`data-merge-keep`(區塊不跨頁);處理順序固定,無效值視為未給;styleDef 行內 code 依所在元素(li、table、p、h1~h6)明訂字級,li/table 內 pre code 維持 `fontSizeCode` | R-TABLE-01、R-CODEFONT-01、R-SYNTAX-01 | `test/md2html.test.mjs`(新增 35)、`test/WMd2html.test.mjs`(`report.md` 4.1.3、4.1.4) |
| Markdown 檔轉 HTML 檔(`src/WMd2html.mjs`,Node) | 完成:讀檔、圖表編號、本機圖片引用(見下列)、套模板、Footnotes 標題隱藏、li 間距、輸出檔名函數 | R-TEST-01 | `test/WMd2html.test.mjs`(逐字比對 `test/reportTrue.html`)、`test/unit-md2html-deps.test.mjs` |
| 本機圖片引用(`WMd2html` 之 `regImg`、`cvPicRef`、`fillImgs`)(2026-10-29;原始 `<img>` 解析通用化 2026-10-31) | 完成:md 語法圖(image token)與原始 `<img>` 標籤之 `src`(html token,`cvPicRef`:`reTag` 逐標籤掃描、`findAttr` 取第一個完整相等之 `src`,值可為雙引號/單引號/無引號,同一段文字任意多個,標籤屬性可跨行,只處理 `<img>`,程式碼區塊與行內碼不處理)之本機圖先登記為佔位符,md2html 完成後才寫入 `src`(DOMPurify 會移除 `C:\` 絕對路徑之 src,base64 亦不再進 DOM);`imgConvertToBase64:false` 寫入以 md 所在資料夾解析之絕對路徑(Windows 反斜線,不轉碼不編碼);缺圖兩處兩模式皆 reject 並列全部路徑;`true` 時 base64 字元總量上限 `IMG_BASE64_MAX_CHARS`=2^27(預檢估算+轉碼後實際長度);網址/`data:`/`//`/`#`/空值不處理 | R-IMGREF-01 | `test/unit-imgPath.test.mjs`(45+1 pending) |
| 圖表編號與交叉引用(`WMd2html` 之 `cvItemNum`) | 完成:「圖n」「表n」依出現順序編號(圖、表各自計數),內文 `{圖表名}` 取代為編號;圖題與有 src 之 `<img>` 同行時圖表名只取圖題文字(單行與多行寫法一致,`getItemName` 只移除有 src 之 img,其餘與修前相同);寫檔前最終輸出之可見文字中仍對不上之 `{…}` 以 console.log 警告(`getUnresolvedRefs`,以最終 HTML 經 jsdom 判定,排除 code/pre/數學式/style/script)(2026-10-25) | R-FIGREF-01 | `test/genNumForPicAndTab.test.mjs`(4)、`test/unit-genNumRefs.test.mjs`(17) |
| 範例頁(`examples/ex-md2html.html`) | 完成,內容與 `test/report.md` 逐字一致 | R-EXAMPLE-01 | 無自動化,Playwright 開頁驗收 |

## 已知缺口與待辦

- **待裁示:katex 0.19.1 升版被 marked-katex-extension 之 peer 範圍阻擋**(R-DEP-01 複評):可待上游放寬 peer,或改自寫 marked 擴充取代 marked-katex-extension(範圍擴大);`overrides` 對消費端無效不採.未裁示前維持 `^0.18.2`.
- 未設 katex `strict` 時,Node 端轉含中文之 math 會於 console 印 KaTeX 之 warn(非錯誤,R-KATEX-01 已知限制);是否改明設 `'ignore'` 靜音待裁示.

- 圖表名限制(與修前相同,見 R-FIGREF-01):圖題以 Markdown 修飾字元包住(`**圖n 名**`)或位於標題/清單/表格列/連結內、圖題後同行另有區塊文字、圖題後同行之 Markdown 圖片語法或連結文字,圖表名會含多餘字元而對不上(由警告列出);取代作用於整份 md 字串(含程式碼區塊內之 `{圖名}`);純 `圖n`(無名)使內文 `{}` 被取代成編號(皆既有,範圍外未修;同一行兩個 `<img src>` 丟 `size(s)!==2` 已於 2026-10-31 修正,見 R-IMGREF-01);`<img>` 標籤屬性跨多行時,圖題行只見標籤尾端,其前綴併入圖表名(`cvItemNum` 逐行處理,已知限制).
- 圖表名另有畸形或罕見寫法之已知限制(見 R-FIGREF-01):`href` 內含「圖n」、連結同時包住圖片與圖題文字(名帶 `[href]`)、`<img 'src=x'>` 類畸形屬性.
- 警告以最終輸出之可見文字為準:逸出之 `\{x\}` 列出、屬性值(alt/title/href)不檢查、軟換行折疊為空白;區塊邊界依元素種類不依 CSS 實際顯示,`<slot>`/svg `<tspan>`、`textarea`、`hidden`、svg `<defs>`、`<input value>`、註腳標號 CSS 方括號等為已知限制(見 R-FIGREF-01).
- 本機圖片引用之已知限制(見 R-IMGREF-01):原始 `<img>` 之 `srcset`、`<picture><source>`、CSS `url()`、`<input type="image">` 不處理(維持原值);無引號 `src` 值含 `=`、引號或 `<`(如 `a.png?x=1`)時 marked 不視為 HTML 標籤而輸出文字,須加引號(README 已註明);`<img src=a.png/>` 之值依 HTML 規則為 `a.png/`,解析為路徑時去尾端分隔符故等同 `a.png`(實測,無測試);`%XX` 與實體不解碼;路徑含 `"` 之逸出測試於 Windows 為 pending(Ubuntu CI 才跑);上限 2^27 字元為保守值(實測 4288MB 預設堆積下 4.36 億字元仍通過,見規則帳本),未經裁示不提高;路徑含 `# % %20 & '` 時 Word(16)已實測可解析(規則帳本「Word 探測」)。
- 表格標記之已知限制(見 R-TABLE-01、R-CODEFONT-01):巢狀表只處理外層之邏輯欄與合併;合併以 `innerHTML` 比對,同字而行內 code 樣式因欄而異者不合併;raw html 之 div/span 內之 code、以手寫 `style` 設字級之元素內之 code 不在 styleDef 之 code 規則內(README 已註明瀏覽器外觀之例外);`data-merge-keep` 未對跨整列之分類列加與下一列同頁(建議 #113 列為不含);轉 docx 實測僅 Word 16 與 w-html2docx 1.0.49 一組.
- `test/report.md` 第 140 行標題含正文 `{n}`,轉換時印出一行警告(屬實,不影響比對).
- 瀏覽器端 bundle 與下游 bundler 以 src 匯入之路徑無自動化測試(見規則帳本〈已知限制〉).
- md2html 與 WMd2html 不對稱、`toolg/gDistRollup.mjs` 未使用 import、`genNumForPicAndTab` 測試以 `./tmp` 為暫存:見規則帳本〈已知限制〉(既有,範圍外).

## 下游與依賴

- 下游:使用端之文件產製腳本(已先改多行寫法因應,修正後單行寫法亦可);w-md2docx;w-web-api。
- 自有依賴 wsemi(`html2str`、`replace` 等)與 w-image-proc(`base64`)由開發者統籌升版,本套件不補裝.

# w-md2html
A tool for Markdown to Html.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-md2html.svg?style=flat)](https://npmjs.org/package/w-md2html) 
[![license](https://img.shields.io/npm/l/w-md2html.svg?style=flat)](https://npmjs.org/package/w-md2html) 
[![npm download](https://img.shields.io/npm/dt/w-md2html.svg)](https://npmjs.org/package/w-md2html) 
[![npm download](https://img.shields.io/npm/dm/w-md2html.svg)](https://npmjs.org/package/w-md2html) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-md2html.svg)](https://www.jsdelivr.com/package/npm/w-md2html)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-md2html/global.html).

## Example
To view some examples for more understanding, visit examples:
> **convertCoordinate:** [ex-md2html.html](https://yuda-lyu.github.io/w-md2html/examples/ex-md2html.html) [[source code](https://github.com/yuda-lyu/w-md2html/blob/master/docs/examples/ex-md2html.html)]

## Upgrade Notes

### Behavior change with the jsdom 31 upgrade：`tableHorizontalAlignmentCenter` 不再改寫 table 既有之 `style` 宣告

**行為變更**（`md2html`／`WMd2html`；僅影響 md 內手寫帶 `style` 之 `<table>` 且啟用 `tableHorizontalAlignmentCenter`〔`WMd2html` 預設為 `true`〕者）。
- **依賴**：`jsdom` 由 30.1.3 升為 31.0.0（只在 Node 端轉換時載入，瀏覽器端不載入）。Node 下限與 30.x 相同：`^22.22.2 || ^24.15.0 || >=26.0.0`；jsdom 31 之 canvas 後端改為 `@napi-rs/canvas`、CSS 引擎重寫、HTML 解析改非同步，本套件皆未用到（不使用 canvas、`getComputedStyle`、`runScripts`、`resources`、`readyState`／`load`，`new JSDOM(html)` 於預設選項下回傳即為完整解析）。
- **table 之 `style` 屬性原樣保留**：過去置中時以 DOM 之 CSS 引擎設 `display` 並整串重新序列化 `<table>` 之 `style`，結果隨 jsdom 版本而異（jsdom 31 起 `page-break-*` 會被改寫為 `break-*`、`-webkit-` 前綴被移除，而 Word 匯入只認 `page-break-*`；30.x 則會丟棄大寫之屬性名與 `mso-*`、`filter`、不合法之宣告）。現改為只在 `style` 末尾附加 `display: inline-table;`（前值未以 `;` 結尾則先補 `;`），使用者之其他宣告（含 `page-break-*`、`mso-*`、大小寫、引號、`#666` 等色彩寫法、`!important`）一律原樣輸出，與 DOM 實作無關，瀏覽器端與 Node 端輸出相同。
- 使用者於 `<table>` 已設其他 `display` 者，附加之 `display: inline-table;` 後宣告覆寫之（該 `display` 帶 `!important` 時，附加之宣告亦帶 `!important`）；已為 `inline-table` 者不重複附加；`display:none`（無空白）之 table 仍先被移除。外包之 `<div>` 仍為 `style="text-align: center;"`。
- **不變**：未帶 `style` 之 `<table>`（含 md 語法表格）輸出逐字不變（`style="display: inline-table;"`）；`tableHorizontalAlignmentCenter:false` 時 table 不動。
- **影響**：帶 `style` 之 table 其屬性文字改為使用者所寫之原樣（過去為引擎序列化形態，如 `width: 100%;`、`border: 1px solid rgb(102, 102, 102);`），宣告之語意不變；過去被丟棄之宣告（大寫屬性名、`mso-*` 等）現會保留。

### Behavior change after 1.1.21：表格標記擴充（行內程式碼字級、逐欄樣式依邏輯欄、合併儲存格）

**行為變更**（`md2html`／`WMd2html`；使用端需求見 Gitea #112、#113；新增標記屬性，未使用者不受影響）。
- **styleDef 增列行內程式碼依所在元素明訂字級**：`.md li code`（`fontSizeDef`）、`.md table code`（`fontSizeTab`）、`.md p code`（`fontSizeP`）、`.md h1 code`～`.md h6 code`（`fontSizeH1`～`fontSizeH6`）；清單與表格內之區塊程式碼（`pre code`）維持 `fontSizeCode`。原因：Word 匯入 html 時 `<code>` 不繼承父層字級（`font-size:inherit` 亦無效），其 run 沿用文件預設字級，使同一表格、標題內程式碼與周圍文字字級不一，固定行高之表格並裁掉底線。`mergeStyle:true` 之輸出其 `<style>` 多出此 36 行（含註解，`mergeStyle:false` 則在 `styleDef`）；含程式碼之文件於瀏覽器之外觀不變（程式碼原即繼承所在元素字級）。**例外**：元素之字級若是以手寫 `style` 設定（而非 `fontSize*` 選項或 `data-style-th`／`data-style-td` 標記），其內行內程式碼於瀏覽器改採該元素種類之 `fontSize*` 選項值（如手寫 `style="font-size:9pt"` 之儲存格，其內程式碼為 `fontSizeTab`），請改用標記。
- **`data-for="tab"` 之標記表內，行內程式碼繼承所在 th／td 最終 style 之 `font-size`、`mso-line-height-rule`、`line-height`**（同名取最後者，與 CSS 後宣告優先一致），寫入其內 `<code>` 之 `style`（置於 `<code>` 自帶 style 之前，自帶者優先）。過去無此處理，儲存格設 9pt 時程式碼於 Word 仍為 12pt。
- **逐欄樣式（`data-style-th-{n}`／`data-style-td-{n}`）於含 `rowspan`／`colspan` 之表改依邏輯欄定位**（計入上方 rowspan 與左方 colspan 所佔之格；跨欄之格只在起始欄套用）：過去以「該列第 n 個 th／td」定位，rowspan 下方各列少了左側之格，樣式會錯欄或漏套。**無 `rowspan`／`colspan` 之表定位不變**（含混用 th／td 之列：`data-style-td-0` 仍為該列第 0 個 td）。
- **新增標記**：`data-style-code`、`data-merge-h`、`data-merge-v`、`data-merge-keep`，見下方 Table Markup。
- **影響**：未使用新屬性且無 `rowspan`／`colspan` 之表，輸出逐位元組不變（含 `data-style-*` 之標記表，僅其內行內程式碼於儲存格設字級時多一個 `style`）；`test/reportTrue.html` 因 styleDef 增列與範例新增而重產。

### Breaking changes after 1.1.12：原始 `<img>` 之 `src` 解析（引號形態、同行多個、處理範圍）

**行為變更**（`WMd2html`；不保留舊行為，下游須連帶評估）。以下取代 after 1.1.11 與 Behavior change after 1.1.9 兩節末尾所列「同一行多個 `<img src>` 丟 `size(s)!==2`」「只處理雙引號 `src`」之已知限制。
- **原始 `<img>` 之 `src` 值可為雙引號、單引號或無引號**，等號兩側可有空白，標籤名與屬性名不分大小寫，與雙引號寫法走同一流程（先登記，轉換完成後依 `imgConvertToBase64` 寫入絕對路徑或內嵌 base64，缺圖 reject 並列全部路徑）。過去只處理雙引號 `src="…"`，單引號與無引號之本機圖保持原值（路徑模式留相對路徑、base64 模式不內嵌）。無引號之值依 HTML 解析器規則至空白或 `>` 為止（`<img src=a.png/>` 之值為 `a.png/`，解析為路徑時尾端分隔符被去除，等同 `a.png`）；無引號之值若含 `=`、引號或 `<`（如 `a.png?x=1`），Markdown 不視為 HTML 標籤而以文字輸出，請加引號；`%XX` 與 HTML 實體不解碼（同過去）。
- **同一行（同一段文字）可有任意多個 `<img>`**，各自登記，亦可與 md 語法圖 `![](…)` 混用於同一行；標籤之屬性可跨行。過去同一行含兩個以上 `src="` 會丟 `size(s)!==2`（`imgConvertToBase64` 兩種值皆然）。
- **只處理 `<img>` 標籤之 `src` 屬性**：屬性名稱須完整相等，`data-src`、`alt` 等屬性值內之 `src="…"` 字樣、其他標籤（如 `<video src>`、`<source src>`）之 `src` 不處理，HTML 註解內之 `<img>` 亦不處理。過去只要一行含 `src="` 字樣即被當圖片：缺檔使整個轉換 reject（`<video src>` 指向之本機檔亦然）、`alt` 值內之 `src="…"` 字樣被改寫、`data-src` 與 `src` 同行即丟 `size(s)!==2`；本機媒體檔（`<video>`、`<audio>`）自此保持原值，不寫成絕對路徑亦不內嵌。
- **程式碼區塊與行內程式碼內之 `<img …>` 文字不視為圖片引用**：不登記、缺檔不 reject、輸出之程式碼文字原樣。過去（以雙引號寫法為例）：行內程式碼內者缺檔時使整個轉換 reject，存在時文字被改寫為絕對路徑（`false`）或整段 base64（`true`）；經語法上色之程式碼區塊內者，內部佔位符 `wmd2htmlimgN` 殘留於輸出。
- **影響**：只含雙引號且每行一個 `<img src="…">` 之既有文件，輸出逐字不變（`test/report.md` 於兩種 `imgConvertToBase64` 值，修前修後輸出逐字相同）。依賴「單引號或無引號 `src` 保持原值」「`<video src>` 被當圖片處理」者須改寫。**未處理（維持原值）**：`srcset`、`<picture><source>`、CSS `url()`、`<input type="image">`。

### Breaking changes after 1.1.11：本機圖片之引用（路徑模式、缺圖 reject、base64 總量上限）

**破壞性變更**（`WMd2html`；不保留舊行為，下游須連帶修正）。
- **`imgConvertToBase64: false`：md 語法圖與原始 `<img src="…">` 行之本機圖，一律改寫為以 md 所在資料夾解析之絕對路徑**（Windows 為反斜線形式，如 `C:\docs\圖 資料夾\a b.png`；路徑原樣寫入，不做百分比編碼，僅逸出屬性值內之 `& " < >`），不讀取、不轉碼。Word 只能解析反斜線絕對路徑，正斜線絕對路徑與百分比編碼皆不可解析，故不採用。輸出之 html 含本機路徑而不可攜，僅供同機之後續處理（如轉 Word 之中介 html）；要自足 html 請用預設（`true`）。過去：md 語法圖保留原 `href`，原始 `<img>` 行不受此選項控制，仍被轉為 base64（給 `false` 仍可能因字串過長而失敗）。
- **路徑模式下 SVG 與 JPG 保持原檔**：不再經 `sharp` 重新編碼（過去 SVG 以 96 dpi 點陣化為 PNG、JPG 轉為 PNG），由後續處理讀取原檔（轉 Word 時 SVG 以向量、JPG 以原檔內嵌）。DPI 不為 96 之 JPG，Word 依 96 dpi 計顯示尺寸，與瀏覽器之 CSS px 一致（過去轉 PNG 時保留原 DPI，顯示尺寸不同）。
- **圖片檔不存在一律 reject**（兩種模式；md 語法圖與原始 `<img>` 行皆然）：訊息為 `N image file(s) do not exist:` 之後逐行列出全部缺圖之絕對路徑（同一缺圖只列一次）。過去 md 語法圖缺圖只 `console.log` 後保留原 `href`，原始 `<img>` 行缺圖則丟出只含第一個缺圖之錯誤。只檢查輸出中實際引用之圖（如 HTML 註解內之 `<img>` 不進輸出，不檢查）。
- **本機圖一律以 md 所在資料夾解析**（絕對路徑照用）：過去原始 `<img>` 行先以工作目錄（cwd）解析，cwd 下恰有同名檔時會誤用。`%XX` 不解碼，檔名須與引用之字面一致。
- **非本機圖不處理、不 reject**：具通訊協定之網址（`https:`、`data:`、`file:` 等）、協定相對網址（`//host/x.png`）、錨點（`#x`）與空值維持原樣（過去原始 `<img>` 行遇網址會丟 `fp[…] does not exist`，md 語法圖則 `console.log` 後保留）。
- **`imgConvertToBase64: true`（預設）：圖片總量過大時明確 reject**：轉換前依原檔大小估算內嵌之 base64 字元總量（同一圖多處引用逐處計），超過上限（2^27 字元＝134,217,728，約 96 MiB 之 PNG）即 reject，訊息指出張數、檔案總量、估算字元數、上限與「改用 `imgConvertToBase64: false` 或減少圖片」；轉碼後再依實際長度檢查一次（JPG、SVG 重新編碼為 PNG 後可能遠大於原檔）。過去超過約 80～100 MB（預設堆積）時行程直接中止（離開碼 134，呼叫端收不到 reject）或丟出 `Invalid string length`（訊息指向 marked）。未超過上限者之輸出與過去逐字相同（各圖重新編碼為 PNG 內嵌）。
- **處理方式之改變（輸出不變）**：圖片改為先登記、待 md 轉 html 完成後才寫入 `src`，base64 資料不再經過 marked、DOMPurify 與 jsdom（過去其記憶體約為 html 字元數之 35 倍）。實測 150 張（82 MB）之 md 轉換，峰值 RSS 由約 4294 MB 降為 649 MB。
- **遷移**：依賴 `imgConvertToBase64: false` 保留相對路徑者（例如把輸出 html 放在別處再載入）須改為預設 `true`，或自行處理路徑；缺圖由「記錄後繼續」改為 reject，呼叫端須處理；下游 w-md2docx 以 `imgConvertToBase64: false` 產生中介 html、並由 w-html2docx 內嵌圖片（另案連動）。已知限制（與本版前相同）：同一行寫兩個以上 `<img src="…">` 仍會丟 `size(s)!==2`；原始 `<img>` 只處理雙引號之 `src="…"`（單引號與無引號寫法不處理）。

### Behavior change after 1.1.9：圖題與 `<img>` 同一行時圖表名之取法，以及對不上圖表名之 `{…}` 警告

**行為變更**（`WMd2html`，兩處）。
- **圖題與 `<img>` 同一行時圖表名之取法**：過去單行寫法之圖表名會被併入 `<img>` 轉成之文字（如 `[pics/a.png]`），與內文之 `{圖名}` 對不上，引用靜默不取代、原樣留在輸出；本版起取名前先移除同一行中有 `src`（值非空）之 `<img>`（屬性值可含 `>`；包在 `<a href>` 內者連同變空的連結一併移除），單行與多行寫法得到相同之圖表名與編號，引用皆取代。沒有 `src`（含 `src` 為空）之 `<img>` 維持過去行為（其 `alt` 視為文字）；不含有 `src` 之 `<img>` 的行，取名與過去逐字相同。若「圖n」只出現在被移除之 `<img>` 的屬性內（例如 `<img alt="圖n" src="…">`），該行不視為圖題、不登記圖表名（仍佔用編號，同過去）。
- **轉換後輸出中仍殘留對不上任何圖表名之 `{…}` 時輸出警告**：以 `console.log` 輸出一行 `warning: N reference(s) match no figure/table name: {a}, {b}`（重複者只列一次、依輸出內首次出現順序），轉換照常完成，回傳值仍為 `'ok'`、輸出檔照常寫出，不增加選項。判準是「輸出的可見文字中仍有 `{…}`」：程式碼區塊與行內程式碼（輸出為 `<pre>`、`<code>`）、數學式內之大括號不檢查；模板符號 `{title}`（隨後會被換成檔名）不列；連結 title、圖片 alt 等屬性值不是可見文字不檢查；以反斜線逸出之 `\{x\}` 在輸出中是可見文字，會列出；被 Markdown 修飾字元包住者（`{**x**}`）列其可見文字（`{x}`）；跨行（含跨段落、跨區塊、跨行內碼）之大括號不檢查，巢狀大括號列最內層；以 HTML 元素種類判定區塊邊界，不依 CSS 實際顯示（如 `display:inline` 之 `div`）。
- **影響與遷移**：多行寫法之輸出不變。單行寫法過去殘留於輸出之 `{圖名}` 自此被取代為圖號；若您依賴「輸出中仍有 `{…}`」做檢查，請改依警告。正文中本就含大括號者（例如以 `{n}` 說明語法而未用反引號包住）會多一行警告，不影響輸出，可改用行內程式碼 `` `{n}` `` 避免。已知限制（與本版前相同）：以 Markdown 修飾字元包住整個圖題（`**圖n 名**`）、圖題後同行另有區塊文字、圖題後同行之 Markdown 圖片語法或連結、圖題文字本身包在連結內（圖表名會帶 `[連結位址]`）、`<img>` 標籤之屬性跨多行，其文字仍會併入圖表名（對不上時由警告列出），請改以 HTML 寫圖題並將 `<img>` 寫在同一行內；同一行寫兩個以上 `<img src="…">` 仍會於轉 Base64 時丟錯（`size(s)!==2`），請將圖片分行。

## Figure and Table Numbering

`WMd2html` 於轉換前先為圖題、表題自動編號並解析內文交叉引用：

- 圖題、表題以「圖n」「表n」開頭（可包在 `<div>` 等標籤內），依出現順序編為「圖1」「圖2」…、「表1」「表2」…（圖、表各自獨立計數）。
- 圖表名＝「圖n」「表n」之後之文字（去頭尾空白）；內文以 `{圖表名}` 引用，轉換時取代為對應編號（含前向引用與重複引用）。
- 圖片與圖題可寫在同一行或分多行，兩種寫法得到相同之圖表名與編號。
- 轉換後輸出之可見文字中仍對不上任何圖表名之 `{…}`（程式碼區塊、行內程式碼、數學式除外）會以 `console.log` 輸出警告並列出該字串，轉換不中斷，回傳值不變。

```alias
單行之架構如{單行圖}所示，多行之架構如{多行圖}所示。

<div style="text-align:center;"><img src="pics/a.png" /><div>圖n 單行圖</div></div>

<div style="text-align:center;">
    <img src="pics/a.png" />
    <div>圖n 多行圖</div>
</div>
```

## Table Markup

於表格前以空 `<div data-for="tab" …></div>`（與表格間可隔空行，md 與 html 表格皆可）標記，屬性套用至其後第一張表格，處理後標記自動移除。欄索引一律 0 起算。

| 屬性 | 作用 |
|---|---|
| `data-style-th`、`data-style-td` | 附加於全部 th、td 之 style |
| `data-style-th-{n}`、`data-style-td-{n}` | 附加於第 n 欄之 th、td（於全域之後，可覆寫）；有 rowspan／colspan 之表依邏輯欄，否則為該列第 n 個同標籤之格 |
| `data-style-code` | 附加於表內全部行內程式碼之 style（置於繼承之字級之後） |
| `data-merge-h="0,1,2"` | 同一列內，指定欄之間左右相鄰且內容相同者合併為一格（colspan，保留最左格之內容與樣式），thead／tbody／tfoot 之列皆適用 |
| `data-merge-v="0,1"` | 各 tbody 內，指定欄上下相鄰且內容相同者合併為一格（rowspan）；依列出順序為階層，後列之欄只在前列各欄之同一合併區塊內才合併 |
| `data-merge-keep="true"` | 第一個 `data-merge-v` 欄之各區塊不跨頁（轉 docx 時區塊內各列不斷開、非末列與下一列同頁） |

- 處理順序：全域樣式 → 逐欄樣式 → 行內程式碼繼承（儲存格之 `font-size`、`mso-line-height-rule`、`line-height`）→ 左右合併 → 上下合併 → 不跨頁。逐欄樣式先於合併，故合併格保留其欄之樣式；左右合併後之格不再參與上下合併，故跨整列之分類列會切斷上下合併。
- 「內容相同」以儲存格 `innerHTML`（去頭尾空白）比對，同字而格式不同者不合併；空白格不合併；th 與 td 不互併；已有 `rowspan`／`colspan` 之格不參與；「相鄰」以邏輯欄連續判定，被上方 rowspan 佔住之欄不算相鄰。
- 欄索引以逗號分隔，各項去頭尾空白後須為非負整數，重複者只取一次，無效之項略過（不拋錯、不影響其餘處理）；`data-merge-keep` 只有值為 `true`（去頭尾空白、全小寫）才啟用，且須有有效之 `data-merge-v`。

```alias
<div data-for="tab" data-style-td="font-size:9pt;" data-style-td-0="text-align:center; vertical-align:middle;" data-merge-h="0,1,2" data-merge-v="0" data-merge-keep="true"></div>

| 系統 | 內容 | 內容 |
|------|------|------|
| 第一類 | 第一類 | 第一類 |
| 系統甲 | `unit01` | 說明一 |
| 系統甲 | `unit02` | 說明二 |
```

## Installation

### Using npm(ES6 module):
```alias
npm i w-md2html
```

#### Example:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-md2html/blob/master/g.mjs)]
```alias
import w from 'wsemi'
import WMd2html from './src/WMd2html.mjs'
//import WMd2html from 'w-md2html/src/WMd2html.mjs'
//import WMd2html from 'w-md2html'

async function test() {

    let fpIn = `./test/report.md`
    let fpOut = `./test/report.html`
    let opt = {
        imgWidthMax: '500px',
        funProcFpOut: (msg) => {
            console.log('msg', msg)
            return msg.fpOut
        },
    }

    let r = await WMd2html(fpIn, fpOut, opt)
    console.log(r)
    // => ok

    w.fsDeleteFile(fpOut)

}
test()
    .catch((err) => {
        console.log('catch', err)
    })
```

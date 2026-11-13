# 回饋

任務中發現之自有套件、全域技能、全域設定之調整與抽提提案;只增不改,處置結果另記一列.

| 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|
| 2026-11-14 | 全域技能 | update-pks(或 role-coder-for-validate) | 升相依主版後之「修前/修後等價比對」宜有固定作法:①修前環境不動 repo,於 `./tmp/<夾>/env-old/` 以 `npm i --prefix` 另裝舊版並複製 src;②同一輸入先各跑兩次確認決定性,再比兩版;③輸出差異以腳本分類(是否僅某一屬性不同、經輕度正規化是否相同),人工只看剩餘者;④堆疊/深度類差異以「每次新行程」階梯探測判定,不憑同行程內單次成敗(JIT 預熱使邊界成敗不定,曾造成前一輪誤報);⑤被依賴套件之序列化結果若直接成為輸出(如 DOM 之 `el.style` 賦值後之 `style` 屬性),升版時盤點全部賦值站點 | `sgud/exp/experience.md` 2026-11-14;`sgud/rule/rulebook.md` R-JSDOM-01 驗證紀錄(573 輸入、深度階梯 30.1.3 與 31.0.0 皆 2200 過、2300 敗) |
| 2026-11-14 | 自有套件 | w-fetch-web | 升 jsdom 31 時,`src/parseArticle.mjs` 交 Readability 之文件含 CSS 引擎重寫之影響:本套件實測 31 對 `style` 屬性之解析與序列化有差異(大寫屬性名如 `DISPLAY:NONE` 30.x 不認、31 認;`el.style` 賦值後整串重新序列化;簡寫與值正規化不同),Readability 之可見性判斷讀 `style` 者可能因而改變抽取結果;建議以含 `style="DISPLAY:NONE"`、`display: none !important` 等樣本做修前/修後比對.另:預設選項(未設 `runScripts`/`resources`)下 `new JSDOM(html)` 回傳即完整解析(含外部阻塞式 script、async/defer/module、`document.write` 8 型實測),主控調研報告所列「部分解析」風險於預設選項下不成立 | `sgud/rule/rulebook.md` R-JSDOM-01 驗證紀錄;`test/unit-md2html-jsdom.test.mjs` 之「(4)預設選項…」案;探測 P2(`style` 屬性)30.1.3 與 31.0.0 之輸出差異 23 項(探測 133 項中 P1 14 項為 `readyState`、P2 23 項為 `style`) |
| 2026-11-09 | 全域技能 | update-pks | 升相依套件(尤其 0.x 之 peer 受限者)前,宜納入「peer 衝突三面向驗證」:①無鎖檔解析;②鎖檔被改後再次解析;③以 `npm pack` 探測包模擬消費端安裝(檢查是否巢狀出第二份被依賴套件).有鎖檔之 `npm install` 對 peer 衝突只警告而成功,易被誤判為「可升」,且會把違規寫入鎖檔 | `sgud/rule/rulebook.md` R-DEP-01 複評(2026-11-09);katex `^0.19.1` 於 npm 12.1.0 之實測:有鎖檔第一次成功、其後與無鎖檔皆 ERESOLVE,消費端不報錯但版本分裂 |

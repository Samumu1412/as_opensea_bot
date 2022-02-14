# opensea-bot

## 目標

1. 當有人掛賣的 NFT 比地板價低很多的時候，自動把它買下來

## OpenSea API申请秘诀

Opensea审核很松，申请中需要填写项目网址信息，其实填什么都可以，twitter，FB group或者是IG，只要follower数多就能通过。（大家可以找一些知名的账号，自圆其说即可）

## 開發步驟

1. 複製 `.env.example` 至 `.env`，設定必要的變數：

   - `OPENSEA_API_KEY`: Opensea 提供的 API Key，需自行申請
   - `CONTRACT_ADDRESS`: 要監聽的合約地址
   - `COLLECTION_ID`: 監聽的合約地址在 Opensea 上對應的 ID，可在 collection 頁面的網址列找到
   - `INFURA_PROJECT_ID`: Infura 提供的 key，需自行申請
   - `PRIVATE_KEY_HEX`: 錢包私鑰，格式為不帶 `0x` 開頭的 hex （如 `1234...`）
   - `WALLET_ADDRESS`: 錢包的地址（如 `0xabcd...`）
   - `GAS_PRICE`: 要設多少 max gas price 去搶低價 NFT
   - `FLOOR_UNDERPRICED_RATIO`: 低於地板價的幾倍時自動買入（如 `0.2`）

2. 安裝套件： `yarn install`
3. 編譯並執行： `tsc && node dist/index.js`
4. 修改時自動編譯： `tsc -w`

## 使用步驟

1. 下載最新版程式碼 (`.zip`)，並解壓縮，得到 `opensea-bot` 資料夾
2. 使用 VS Code 開啟 `opensea-bot` 資料夾
3. 在 `opensea-bot` 資料夾下複製檔案 `.env.example` 至 `.env`
4. 在 `.env` 中按照開發步驟相同的方式設定各個參數
5. 執行 `node dist/index.js` 開始監聽

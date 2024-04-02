# Clasp Gas LIFF

## 專案目的：

* 搭配 Siyplybook 預約系統 / LINE OA / Google Apps Script
* 加上 CRM 客戶明細表
* 最終想打造 預約 & LINE 預約 & LINE 流量池經營 & LINE Message API 傳訊息給客戶 & 提醒預約…等功能

## 流程

### LINE OA & LIFF 使用情景

```mermaid
sequenceDiagram
    participant A as 客人
    participant AA as LINE OA
    participant B as LIFF
    participant C as Google Apps Script
    participant D as Google Sheet
    participant E as Other Side
    A->>AA: 加入好友
    AA->>A: 歡迎訊息
    A->>AA: click 預約 btn
    AA->>B: 打開 LIFF 瀏覽器
    B->>C: 收集 LINE ID & LINE NAME ※1
    C->>D: Save data
    D->>C: 
    C->>B: Response
    B->>E: 轉址
```

#### ※ 1
LIFF 中繼，使用 Github Page 當做中轉站

例：三種尺寸的 html
https://liff.github.io/tall
https://liff.github.io/full
https://liff.github.io/compact

GET 參數

https://liff.github.io/{size}?goto={redirect_url}

goto 要轉址到的 url

### Simplybook Webhook 通知

```mermaid
sequenceDiagram
    participant A as 客人
    participant B as SimplyBook
    participant C as Google Apps Script
    participant D as Google Sheet
    note left of A: Case 1 Create
    A->>B: 建立新預約
    B->>C: Post Request to GAS <br> status = create (※1)
    C->>D: Take record <br> insert data (booking_id & status)
    D->>C: 
    C->>B: RestAPI get detail
    B->>C: 
    C->>D: Update data <br>(customer name / date ...)
    note left of A: not equal to create
    A->>B: Update / Cancel
    B->>C: Post Request to GAS <br> status = change / cancel
    C->>D: Update data <br>(status / booking_date / time)
```

#### ※1

Can get booking_id / booking_hash / status

### Google Apps Script

```mermaid
flowchart
    A[GAS doPost] --> B([From Simplybook Webhook or LIFF<br>judge by booking_id is exist])
    B -->|LIFF| C[Save to log sheet]
    B -->|SimplyBook & status = create| E[Use Booking id request to Simplybook to get Cusomter info]
    E --> S[Edit Google Calendar content]
    B --->|SimplyBook & status != create| F[Edit booking sheet order status]
```

## Todo

- Google Apps Script
  - [ ] doPost API
  - [ ] LIFF save to log sheet
  - [ ] Simplybook create
    - [ ] Save log
    - [ ] Save data to Google Sheet
    - [ ] Use booking_id to request detail info
    - [ ] Update google calendar content
  - [ ] Simplybook others
    - [ ] Save log
    - [ ] Use booking id to find row number
    - [ ] Edit it
- LIFF
  - [ ] LIFF html css
  - [ ] LIFF javascript code
    - [ ] If isLogined is false then exexute `LIFF.login()`
    - [ ] getLineToken `LIFF.getDecodedIDToken()`
    - [ ] send request to google apps script
    - [ ] redirect to url from url pramas goto
- Others
  - [ ] deploy
  - [ ] Register LIFF URL
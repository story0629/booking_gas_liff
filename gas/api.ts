
type typeNotificationType = 'create' | 'cancel' | 'new_client' | 'change' | 'create_invoice';
type typePostType = 'Simplybook' | 'LIFF';
interface typePostContent {
    // Simplybook
    // {"booking_id":"8","booking_hash":"f3653d531e887a0be2cd4b3c0ba686b7","company":"akashictommy","notification_type":"create"}
    booking_id: string;
    booking_hash: string;
    company: string;
    notification_type: typeNotificationType;
    // LIFF
    // {"iss": "https://access.line.me", "sub": "U1234567890abcdef1234567890abcdef", "aud": "1234567890", "exp": 1504169092, "iat": 1504263657, "amr": ["pwd"], "name": "Taro Line", "picture": "XXXXXXXXXXXXXXXXXXXXXXXXXX"}
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    amr: string[];
    name: string;
    picture: string;
    email?: string;
    goto: string; // 要轉址去的網址
}

interface typeSimplyBookDetail {
    id: number;
    client_id: number;
    code: string;
    status: string;
    start_datetime: string;
    end_datetime: string;
    invoice_datetime: string; // UTC+8
    payment_received: boolean;
    invoice_payment_received: boolean;
    invoice_payment_processor: string;
    service: typeSimplyBookService;
    client: typeSimplyBookClient;
    log: typeSimplyBookLog[];
    additional_fields: typeSimplyBookAdditionalFields[];
}

interface typeSimplyBookService {
    id: number;
    name: string;
    price: number;
}

interface typeSimplyBookClient {
    id: number;
    name: string;
    email: string;
    phone: string;
}

interface typeSimplyBookAdditionalFields {
    id: number;
    field_name: string;
    value: string;
}

interface typeSimplyBookLog {
    id: number;
    datetime: string;
    type: string;
}

const ws = SpreadsheetApp.getActiveSpreadsheet();
const timeZone = Session.getScriptTimeZone();


const doGet = (e: GoogleAppsScript.Events.DoGet) => {
    return ContentService.createTextOutput(JSON.stringify(e))
        .setMimeType(ContentService.MimeType.JSON);
}

// Google Apps Script Post Endpoint
// Step1：get post content
// Step2：Judeg type by content, if booking_id is exist then type is Simplybook else type is LIFF
// Step3：Save to content to google sheet (name is webhook_log), content is current_datetime, type, post content, need to insert row in top
// Step4：Save data to google Sheet
// Step4：return ok
const doPost = (e: GoogleAppsScript.Events.DoPost) => {

    // judge content is string or not, if string then JSON.parse()
    let content: typePostContent = e.postData.contents;
    if (typeof e.postData.contents === 'string') {
        content = JSON.parse(e.postData.contents);
    }

    const type: typePostType = content.hasOwnProperty('booking_id') ? 'Simplybook' : 'LIFF';
    savePostDataToSheet(type, content);

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
        .setMimeType(ContentService.MimeType.JSON);
}

interface typeRequestOptions {
    method: 'get' | 'post';
    headers?: {
        [key: string]: string;
    },
    payload?: string;
}

// Refresh Token 的 Response
interface typeRefreshResponse {
    token: string;
    refresh_token: string
}

const sendRequest = async (endpoint: string, options: typeRequestOptions) => {
    try {
        const response = await UrlFetchApp.fetch(endpoint, options);
        return response;
    } catch (error) {
        console.log(error);
        return null;
    }
}

// Use rest api to get booking detail
// Step1：define setting_sheet (sheet_name is Settings)
// Step2：get api_key and secret_key from setting_sheet
// Step3：use booking_id & key to send get request
// Step4：return response
const getSimplyBookDetail = async (booking_id: string) => {
    const setting_sheet = ws.getSheetByName('Settings')!;

    // todo: range 位置需要確認
    const url: string = setting_sheet.getRange("B2").getValue();
    const api_token: string = setting_sheet.getRange("B4").getValue();
    const company: string = setting_sheet.getRange("B3").getValue();
    // get request, need set key into header
    const endponint = `${url}/admin/bookings/${booking_id}`;
    const options: typeRequestOptions = {
        method: 'get',
        headers: {
            "Accept": "*/*",
            "X-Token": api_token,
            "X-Company-Login": company
        }
    }
    let result: typeSimplyBookDetail | null = null;

    console.log("GET DETAIL DATA Start")
    const response: GoogleAppsScript.URL_Fetch.HTTPResponse | null = await sendRequest(endponint, options)

    // if response == null, 則要 refresh_token
    // 若得得 response，則丟入下一階段
    if (response) {
        result = JSON.parse(response.getContentText());
    } else if (!response) {
        console.log("GET DETAIL DATA ERROR, Refresh Token Start")
        // token 已過期
        await refreshSimplybookToken(booking_id);
        result = null
    }

    return result;
}

const refreshSimplybookToken = async (booking_id: string) => {
    const setting_sheet = ws.getSheetByName('Settings')!;

    const url: string = setting_sheet.getRange("B2").getValue();
    const company: string = setting_sheet.getRange("B3").getValue();
    const refresh_endpoint = `${url}/admin/auth/refresh-token`;
    const refresh_token: string = setting_sheet.getRange("B5").getValue();
    const refresh_options: typeRequestOptions = {
        method: 'post',
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        },
        payload: JSON.stringify({
            company,
            refresh_token
        })
    }

    const refresh_response: GoogleAppsScript.URL_Fetch.HTTPResponse | null = await sendRequest(refresh_endpoint, refresh_options);
    if (refresh_response) {
        console.log("Refresh Token OK")
        // update setting_sheet with new token
        const body: typeRefreshResponse = JSON.parse(refresh_response.getContentText());
        const { token, refresh_token } = body
        setting_sheet.getRange("B4").setValue(token);
        setting_sheet.getRange("B5").setValue(refresh_token);
        // 再次執行一次取得資料
        await getSimplyBookDetail(booking_id);
    } else {
        // 如果 refresh_response 錯了
        // 重新取得 token
        console.log("Refresh Token ERROR, Get Token Start")
        await getSimplybookToken(booking_id);
    }
}

const getSimplybookToken = async (booking_id: string) => {
    // refresh_token 又錯了，重頭來申請 token
    const setting_sheet = ws.getSheetByName('Settings')!;

    const url: string = setting_sheet.getRange("B2").getValue();
    const company: string = setting_sheet.getRange("B3").getValue();
    const token_endpoint = `${url}/admin/auth`;
    const login: string = setting_sheet.getRange("B6").getValue();
    const password: string = setting_sheet.getRange("B7").getValue();
    const token_options: typeRequestOptions = {
        method: 'post',
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json"
        },
        payload: JSON.stringify({
            company,
            login,
            password
        })
    }
    const token_response: GoogleAppsScript.URL_Fetch.HTTPResponse | null = await sendRequest(token_endpoint, token_options);
    if (token_response) {
        console.log("Get Token OK")
        // 確定得到新的 token，則更新
        const body: typeRefreshResponse = JSON.parse(token_response.getContentText());
        const { token, refresh_token } = body
        setting_sheet.getRange("B4").setValue(token);
        setting_sheet.getRange("B5").setValue(refresh_token);
        // get data one more time
        await getSimplyBookDetail(booking_id);
    } else {
        console.log("Get Token ERROR")
        console.log('Simplybook login / password 錯了');
        // Todo: mail to tommy
    }
}

// create / update in booking_list sheet
const simplybookLog = (type: typeNotificationType, detail: typeSimplyBookDetail) => {
    const sheet = ws.getSheetByName('Booking_List')!
    // type 共有 'create' | 'cancel' | 'new_client' | 'change' | 'create_invoice'
    // create_invoice 應該是已收款
    if (type === 'new_client') return;

    // 如果 type 不是 create，需要先找到之前預約的 row number
    let booking_row = -1
    const booking_id = detail.id.toString();
    const last_row = sheet.getLastRow()

    if (type !== 'create') {
        const booking_ids_original: string[][] = sheet.getRange("C:C").getValues();
        const booking_ids = booking_ids_original.map((d: string[]) => d[0].toString())
        booking_row = booking_ids.indexOf(booking_id) + 1 // 得到的是 index，從 0 開始，但 sheet 從 1 開始
    } else {
        booking_row = last_row + 1 // last_row 是目前最後一行有資料，我要在他的下一行
    }


    // Step1：INSERT INTO booking_list

    const { log, additional_fields } = detail;
    // 想詢問的內容 - id = 1
    // 從哪裡知道 tommy - id = 2
    // LINE ID - id = ˇ
    // 匯款後 5 碼 - id = 4

    const take_booking_date = log.find(field => field.type === 'create') ? log.find(field => field.type === 'create')!.datetime : '';
    const ask_content = additional_fields.find(field => field.id === 1) ? additional_fields.find(field => field.id === 1)!.value : '';
    const how_to_know_tommy = additional_fields.find(field => field.id === 2) ? additional_fields.find(field => field.id === 2)!.value : '';
    const line_id = additional_fields.find(field => field.id === 3) ? additional_fields.find(field => field.id === 3)!.value : '';
    const payment_number = additional_fields.find(field => field.id === 4) ? additional_fields.find(field => field.id === 4)!.value : '';

    const booking = []
    if (type === 'create') booking.push(""); // customer_id
    if (type === 'create') booking.push(detail.id); // booking_id
    if (type === 'create') booking.push(detail.client.id); // simplybook client id
    if (type === 'create') booking.push(detail.client.name); // simplybook client name
    if (type === 'create') booking.push(detail.client.email); // simplybook client email
    if (type === 'create') booking.push(detail.client.phone); // simplybook client phone
    if (type === 'create') booking.push(line_id); // LINE id
    if (type === 'create') booking.push(""); // LINE sub
    booking.push(detail.service.name); // simplybook service name
    booking.push(take_booking_date); // 預約下單日期
    booking.push(detail.start_datetime); // simplybook start 
    booking.push(detail.end_datetime); // simplybook end
    booking.push(ask_content); // 詢問內容
    booking.push(how_to_know_tommy); // 從哪裡知道 tommy
    booking.push(detail.service.price); // simplybook service price
    booking.push(detail.invoice_payment_processor); // payment_method 
    booking.push(payment_number); // 後 5 碼
    booking.push(detail.invoice_payment_received); // 收款狀態 不知道是不是用這個
    booking.push(detail.status); // 訂單狀態 不知道是不是用這個
    booking.push(false); // 設定成已入金的 checkbox，固定為 false，由使用者 check

    const current_datetime: string = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss")
    const create_at = type === 'create' ? current_datetime : sheet.getRange(booking_row, 21).getValue();

    booking.push(create_at) // create_at
    booking.push(current_datetime) // update_at

    // fill booking to sheet Booking_List
    const start_column = type === 'create' ? 1 : 9 // 只更新後面的資訊

    console.log(type, booking_row, start_column)
    console.log(booking)

    sheet.getRange(booking_row, start_column, 1, booking.length).setValues([booking]);
    // 設定為 checkbox
    sheet.getRange(booking_row, 20).insertCheckboxes();

    // Step2：INSERT INTO customer_list if customer_id is not exist
    // content like ["", "", customer_id, customer_name, email, phone, ]
    // Todo: 還不確定 mappling customer_id 的方式，先 skip
    // 1. 確認 customer 是不是 exist, 確認的方式
    // email > line name > simplybook client_id > name
    // 2. 如果 customer_id 不存在，就新增 customer_list
    // TODO: 之後上線再來處理
}

const liffCreate = (sheet: GoogleAppsScript.Spreadsheet.Sheet, content: typePostContent) => {
    // Step1：INSERT INTO LINE_OA_List sheet
    // content like [current datetime utc+8, sub, name, picture, email, goto]
    const { sub, name, picture, email, goto } = content;

    const date = new Date();
    const current_datetime = Utilities.formatDate(date, timeZone, "yyyy-MM-dd HH:mm:ss");
    const data = [current_datetime, sub, name, picture, email, goto];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, data.length).setValues([data]);

    // Step2：Mapping with customer_list，
    // if customer_list.line_name is equal to name, then set sub to customer_list
    // else if customer_list.email is equal to email, then set sub to customer_list
    // else if customer_list.phone is equal to phone, then set sub to customer_list
    // else ignore it

    // TODO: 之後上線再來處理
}

// save post data to google sheet
// Step1：type: Simplybook or LIFF
// Step2：if type is Simplybook and use booking_id secret_key to send get request to get detail info
// Step3：if type is Simplybook and notification_type is create then save [index, booking_id, ... , created_at, updated_at] to booking_list
// Step4: if type is Simplybook and notification_type is not equal create then user booking_id to get row number and update column
// if tyle is LIFF and sub is not isit in sheet then save [sub, customer_name, aud, exp, email] to cutomer_list
const savePostDataToSheet = async (type: typePostType, content: typePostContent) => {
    // Step1
    if (type === 'Simplybook') {
        // Step1 記錄
        const { booking_id, notification_type } = content;


        const date = new Date();
        const current_datetime = Utilities.formatDate(date, timeZone, "yyyy-MM-dd HH:mm:ss");
        const data = [current_datetime, booking_id, notification_type];
        const sheet = ws.getSheetByName('SimblyBook_Notify')!;
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, data.length).setValues([data]);

        // Step2 先取得 Simplybook 的 詳細資料
        const booking_detail: typeSimplyBookDetail | null = await getSimplyBookDetail(booking_id);

        if (!booking_detail) {
            return 'booking_detail is null';
        }

        simplybookLog(notification_type, booking_detail);
        // 其他 notification_type 例：new_client / create_invoice 因該不用做任何事，放著
    } else if (type === 'LIFF') {
        // Step5 LIFF 的情況
        const sheet = ws.getSheetByName('LINE_OA_List')!;
        liffCreate(sheet, content);
    }
}
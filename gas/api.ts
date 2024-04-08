
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

interface typeRequestOptions {
    method: 'get' | 'post';
    headers?: {
        [key: string]: string;
    },
    payload?: {
        [key: string]: string;
    }
}

// Refresh Token 的 Response
interface typeRefreshResponse {
    token: string;
    refresh_token: string
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

    const response = await sendRequest(endponint, options)

    // if response.code = 401, need to refresh token and get data one more time
    if (response.getResponseCode() === 200) {
        result = JSON.parse(response.getContentText());
    } else if (response.getResponseCode() === 401) {
        // token 已過期
        const refresh_endpoint = `${url}/admin/auth/refresh-token`;
        const refresh_token: string = setting_sheet.getRange("B5").getValue();
        const refresh_options: typeRequestOptions = {
            method: 'post',
            payload: {
                company,
                refresh_token
            }
        }
        const refresh_response = await sendRequest(refresh_endpoint, refresh_options);
        if (refresh_response.getResponseCode() === 200) {
            // update setting_sheet with new token
            const body: typeRefreshResponse = JSON.parse(refresh_response.getContentText());
            const { token, refresh_token } = body
            setting_sheet.getRange("B4").setValue(token);
            setting_sheet.getRange("B5").setValue(refresh_token);
            // get data one more time
            const response = await sendRequest(endponint, options)
            response.getResponseCode() === 200 ? result = JSON.parse(response.getContentText()) : result = null;
        }
    }

    return result;
}

const sendRequest = async (endpoint: string, options: typeRequestOptions) => {
    const response = await UrlFetchApp.fetch(endpoint, options);
    return response;
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

    if (type !== 'create') {
        const booking_ids_original: string[][] = sheet.getRange("C:C").getValues();
        const booking_ids = booking_ids_original.map((d: string[]) => d[0])
        booking_row = booking_ids.indexOf(booking_id)
    } else {
        booking_row = sheet.getLastRow() + 1
    }


    // Step1：INSERT INTO booking_list
    // [index, customer_id, booking_id, client_id, name, service_name, start date, end_date, price, payment_method, 後 5 碼, 確定付款, 訂單status, notion連結, create_at, update_at]
    // content like [row id -1, "", booking_id, service.name, start_datetime, end_datetime, service.price, ]

    const { log, additional_fields } = detail;
    // 想詢問的內容 - id = 2
    // 從哪裡知道 tommy - id = 3
    // LINE 名稱 - id = 4
    // 匯款後 5 碼 - id = 7
    // 匯款日期 id = 8

    const take_booking_date = log.find(field => field.type === 'create')!.datetime;
    const ask_content = additional_fields.find(field => field.id === 2)!.value;
    const how_to_know_tommy = additional_fields.find(field => field.id === 3)!.value;
    const line_name = additional_fields.find(field => field.id === 4)!.value;
    const payment_number = additional_fields.find(field => field.id === 7)!.value;

    const booking = []
    booking.push(""); // index
    booking.push(""); // customer_id
    booking.push(detail.id); // booking_id
    booking.push(detail.client.id); // simplybook client id
    booking.push(detail.client.name); // simplybook client name
    booking.push(detail.client.email); // simplybook client email
    booking.push(detail.client.phone); // simplybook client phone
    booking.push(line_name); // LINE 名稱 name
    booking.push(detail.service.name); // simplybook service name
    booking.push(take_booking_date); // 預約的日期
    booking.push(detail.start_datetime); // simplybook start 
    booking.push(detail.end_datetime); // simplybook end
    booking.push(ask_content); // 詢問內容
    booking.push(how_to_know_tommy); // 從哪裡知道 tomm
    booking.push(detail.service.price); // simplybook service price
    booking.push(""); // payment_method 不知道資料在哪
    booking.push(payment_number); // 後 5 碼
    booking.push(detail.invoice_payment_received); // 收款狀態 不知道是不是用這個
    booking.push(detail.status); // 訂單狀態 不知道是不是用這個

    const current_datetime: string = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss")
    const create_at = type === 'create' ? current_datetime : sheet.getRange(booking_row, 20).getValue();

    booking.push(create_at) // create_at
    booking.push(current_datetime) // update_at

    // fill booking to sheet Booking_List
    sheet.getRange(booking_row, 1, 1, booking.length).setValues([booking]);

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
interface typePostContent {
    // Simplybook
    // {"booking_id":"8","booking_hash":"f3653d531e887a0be2cd4b3c0ba686b7","company":"akashictommy","notification_type":"create"}
    booking_id: string;
    booking_hash: string;
    company: string;
    notification_type: 'create' | 'cancel' | 'new_client' | 'change' | 'create_invoice';
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

type typePostType = 'Simplybook' | 'LIFF';

interface typeSimplyBookDetail {
    id: number;
    client_id: number;
    code: string;
    start_datetime: string;
    end_datetime: string;
    invoice_datetime: string; // UTC+8
    payment_received: boolean;
    service: typeSimplyBookService;
    client: typeSimplyBookClient;
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

const ws = SpreadsheetApp.getActiveSpreadsheet();
const timeZone = AdsApp.currentAccount().getTimeZone();


// Google Apps Script Post Endpoint
// Step1：get post content
// Step2：Judeg type by content, if booking_id is exist then type is Simplybook else type is LIFF
// Step3：Save to content to google sheet (name is webhook_log), content is current_datetime, type, post content, need to insert row in top
// Step4：Save data to google Sheet
// Step4：return ok
const doPost = (e: GoogleAppsScript.Events.DoPost) => {
    const content: typePostContent = JSON.parse(e.postData.contents);

    const type: typePostType = content.hasOwnProperty('booking_id') ? 'Simplybook' : 'LIFF';
    const sheet = ws.getSheetByName('Webhook_Log')!;
    sheet.insertRowBefore(2);
    sheet.getRange(1, 1).setValue(new Date());
    sheet.getRange(1, 2).setValue(type);
    sheet.getRange(1, 3).setValue(content);

    savePostDataToSheet(type, content);
    return ContentService.createTextOutput('OK');
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
        // Step2 先取得 Simplybook 的 詳細資料
        const { booking_id, notification_type } = content;
        const booking_detail: typeSimplyBookDetail | null = await getSimplyBookDetail(booking_id);

        if (!booking_detail) {
            return 'booking_detail is null';
        }

        const sheet = ws.getSheetByName('Booking_List')!
        if (notification_type === 'create') {
            // Step3 新增至 Google Sheet
            simplybookCreate(sheet, booking_detail);
        } else if (notification_type === 'change') {
            // Step4 更新 Google Sheet
            simplybookUpdate(sheet, booking_detail);
        } else if (notification_type === 'cancel') {
            // Step4 更新 Google Sheet
            simplybookCancel(sheet, booking_detail);
        }
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

// TODO: 之後上線再來處理
// create new row in booking_list sheet
const simplybookCreate = (sheet: GoogleAppsScript.Spreadsheet.Sheet, detail: typeSimplyBookDetail) => {
    // Step1：INSERT INTO booking_list
    // [index, customer_id, booking_id, client_id, service_name, start date, end_date, price, payment_method, 後 5 碼, 確定付款, 訂單status, notion連結, create_at, update_at]
    // content like [row id -1, "", booking_id, service.name, start_datetime, end_datetime, service.price, ]

    // Step2：INSERT INTO customer_list if customer_id is not exist
    // content like ["", "", customer_id, customer_name, email, phone, ]
}
const simplybookUpdate = (sheet: GoogleAppsScript.Spreadsheet.Sheet, detail: typeSimplyBookDetail) => {
    // Step1：UPDATE booking_list
}
const simplybookCancel = (sheet: GoogleAppsScript.Spreadsheet.Sheet, detail: typeSimplyBookDetail) => {
    // Step1：UPDATE booking_list
    // let order status = cancel, payment_status = refund, update_at = now
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
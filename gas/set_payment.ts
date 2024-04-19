const setSimplyBookPayment = async (data: any[]) => {
    // Step1：Get token from Settings;
    const setting_sheet = ws.getSheetByName('Settings')!;
    // todo: range 位置需要確認
    const url: string = setting_sheet.getRange("B2").getValue();
    const api_token: string = setting_sheet.getRange("B4").getValue();
    const company: string = setting_sheet.getRange("B3").getValue();
    // get request, need set key into header

    // Step2：Send Request;

    const invoice_id = data[2];
    const endponint = `${url}/admin/invoices/${invoice_id}/accept-payment`;
    const options: typeRequestOptions = {
        method: 'put',
        headers: {
            "Accept": "*/*",
            "X-Token": api_token,
            "X-Company-Login": company
        },
        payload: JSON.stringify({ "payment_processor": "ATM轉帳收款" })
    }
    // send request
    const response: GoogleAppsScript.URL_Fetch.HTTPResponse | null = await sendRequest(endponint, options)

    return new Promise((resolve, reject) => {
        if (!response) {
            reject(null);
        } else {
            const response_code = response.getResponseCode();
            response_code == 200 ? resolve(true) : reject(null);
        }
    })
}


const setPayment = async () => {
    // Step1：Get Booking_List sheet data
    const sheet = ws.getSheetByName('Booking_List')!;
    const datas = sheet.getDataRange().getValues();
    // Step2：Filter data[19] == true
    const filterData = datas.filter(item => item[19] === true && item[17] === false);
    const filterDelayData = filterData.filter(item => item[15] === 'delay');
    // Step3：Parse payment method = 'delay' data to setSimplyBookPayment function

    if (!filterData.length) {
        throw new Error('No data');
    }

    const date = new Date();
    const current_datetime = Utilities.formatDate(date, timeZone, "yyyy-MM-dd HH:mm:ss");

    for (const data of filterDelayData) {
        const booking_id = data[1];
        console.log(booking_id);
        const booking_row = datas.indexOf(data) + 1; // to number
        console.log(booking_row);
        try {
            const res = await setSimplyBookPayment(data)
            console.log(res);
            res ? sheet.getRange("R" + booking_row).setValue(true) : '';
            res ? sheet.getRange("V" + booking_row).setValue(current_datetime) : '';
            sheet.getRange("T" + booking_row).setValue(false);
        } catch (error) {
            try {
                await refreshSimplybookToken(booking_id)
                const res = await setSimplyBookPayment(data)
                console.log(res);
                res ? sheet.getRange("R" + booking_row).setValue(true) : '';
                res ? sheet.getRange("V" + booking_row).setValue(current_datetime) : '';
                sheet.getRange("T" + booking_row).setValue(false);
            } catch (error) {
                await getSimplybookToken(booking_id)
                const res = await setSimplyBookPayment(data)
                console.log(res);
                res ? sheet.getRange("R" + booking_row).setValue(true) : '';
                res ? sheet.getRange("V" + booking_row).setValue(current_datetime) : '';
                sheet.getRange("T" + booking_row).setValue(false);
            }
        }
    }

    // Step4：send line message, execute sendLineMessage function()
    // 針對 ATM & 信用卡的人
    for (const data of filterData) {
        const to = data[7]
        const meeting_time = data[10]
        const format_meeting_time = Utilities.formatDate(meeting_time, timeZone, "yyyy-MM-dd HH:mm");
        if (!to) {
            continue;
        }
        const messages: typeLinePayload = {
            to,
            messages: [{ type: "text", text: `Hello你好，您的款項已經確認收到了，謝謝你。\n ${format_meeting_time} 線上見。` }]
        }
        await sendLineMessage(messages);
    }

}
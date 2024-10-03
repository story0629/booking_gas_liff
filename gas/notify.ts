// 前一天提醒
// Step1 get data from Booking_List sheet
// Step2 get booking date
// Step3 get current date
// Step4 compare booking date and current date
// Step5 if booking date is before current date, send notification
type typeNotifyType = '一天前' | '兩個月後';

const sendLineReminder = async (type: typeNotifyType) => {
    const booking_sheet = ws.getSheetByName('Booking_List')!;
    const booking_datas = booking_sheet.getRange(2, 1, booking_sheet.getLastRow() - 1, booking_sheet.getLastColumn()).getValues();

    for (const data of booking_datas) {
        const booking_date = new Date(data[10]);
        booking_date.setHours(0, 0, 0, 0);
        const to = data[7]
        const meeting_time = new Date(data[10])
        const format_meeting_time = Utilities.formatDate(meeting_time, timeZone, "HH:mm");
        let message_text = null

        if (!to) {
            continue;
        }

        if (type === '一天前' && calDate(-1, booking_date)) {
            // send line notify
            message_text = `Hello 晚安， 明天 ${format_meeting_time} 就是阿卡西紀錄解讀時間啦!! \n 今天晚上早點睡，明天見。`

        } else if (type === '兩個月後' && calDate(60, booking_date)) {
            message_text = `Hello， 兩個月不見了，你最近還好嗎??? \n 想關心一下上次解讀的內容，你覺得如何呢?? 有什麼新的覺察嗎??`
        }

        if (!message_text) {
            continue;
        }

        const messages: typeLinePayload = {
            to,
            messages: [{ type: "text", text: message_text }]
        }
        console.log(data);
        console.log(messages);
        // await sendLineMessage(messages);
    }
}

function calDate(daysDiff: number, date: Date): boolean {
    // 獲取當天 0 點的日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const today_time = today.getTime();
    const date_time = date.getTime();

    // 將傳入的日期字符串轉換為 Date 對象

    // 計算天數差
    const diffInDays = Math.floor((today_time - date_time) / (1000 * 60 * 60 * 24));

    // 判斷是否符合指定天數差
    return diffInDays === daysDiff;
}

const tomorrow_booking_date = async () => {
    await sendLineReminder('一天前')
}
const sixty_booking_date = async () => {
    await sendLineReminder('兩個月後')
}
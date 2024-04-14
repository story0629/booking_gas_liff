const getCalendarEvents = () => {
    // 获取日历服务

    const calendarService: GoogleAppsScript.Calendar.Calendar = CalendarApp.getCalendarById("primary");

    // 获取未来7天的日期范围
    const startDate = new Date(2023, 11, 1);
    const endDate = new Date(2024, 7, 1);

    const events = calendarService.getEvents(startDate, endDate);

    const sheet = ws.getSheetByName('CalendarData')!;

    const datas = [];

    for (const event of events) {
        const title = event.getTitle();

        if (!title.includes('阿卡西紀錄解讀預約')) {
            continue
        }
        const start_time = Utilities.formatDate(event.getStartTime(), timeZone, "yyyy-MM-dd HH:mm:ss");
        const end_time = Utilities.formatDate(event.getEndTime(), timeZone, "yyyy-MM-dd HH:mm:ss");
        const description = event.getDescription();

        const lines = description.split("\n");
        const name = lines[1];
        const mail = lines[2].includes('<a href') ? extractEmail(lines[2]) : lines[2];

        const line_index = lines.findIndex(str => str.includes('<br><b>LINE ID'));
        const line_id = line_index === -1 ? '' : "'" + lines[line_index + 1];


        const data = [name, mail, line_id, start_time, end_time]
        datas.push(data);

    }

    sheet.getRange(2, 1, datas.length, datas[0].length).setValues(datas);
}

const extractEmail = (htmlStr: string): string => {
    const emailRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(mailto:\/\/|mailto:)([^\"]+)\1/i;
    const match = htmlStr.match(emailRegex);
    return match ? match[3] : '';
};


const updateCalendarContent = () => {
    const calendarService = CalendarApp.getCalendarById("primary");
    const start_datetime = new Date(2024, 3, 25);
    const end_datetime = new Date(2024, 3, 26);

    const events = calendarService.getEvents(start_datetime, end_datetime, {
        search: '阿卡西紀錄解讀師 Tommy'
    });
}
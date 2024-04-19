interface typeLinePayload {
    to: string;
    messages: { type: string, text: string }[];
}


const sendLineMessage = async (messages: typeLinePayload) => {

    const setting_sheet = ws.getSheetByName('Settings')!;
    const url = setting_sheet.getRange('B11').getValue();
    const access_token = setting_sheet.getRange('B12').getValue();
    if (!url || !access_token) {
        throw new Error('url or access_token is empty');
    }

    const options: typeRequestOptions = {
        method: 'post',
        headers: {
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${access_token}`
        },
        payload: JSON.stringify(messages)
    }

    await sendRequest(url, options)
}
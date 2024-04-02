function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  sheet.getRange("1:1").insertCells(SpreadsheetApp.Dimension.ROWS);
  sheet.getRange(1, 1).setValue((new Date).toLocaleString('ja-JP'));
  sheet.getRange(1, 2).setValue(e);
  sheet.getRange(1, 3).setValue(JSON.stringify(e.postData.contents));

  return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify(e))
    .setMimeType(ContentService.MimeType.JSON);
}
const onOpen = () => {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu('GAS功能');
    menu.addItem('設定付款', 'setPayment');
    menu.addToUi();
};
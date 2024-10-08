(async () => {
  // STEP1 Init LIFF

  let liffId = "2004166882-GX8KoO4m"; // LIFF FULL
  // let liffId = "2004166882-6k5LZylq"; // LIFF TEST

  await liff.init({ liffId });
  // console.log("Step1: ", "LIFF INIT");

  // STEP2 check is logined or not
  const isLogined = await liff.isLoggedIn();
  // console.log("Step2: ", isLogined);
  const goto = getFullGotoParam();

  if (!isLogined) {
    // 轉址的網址 目前網址加上 goto
    const redirectUri = location.href;
    liff.login({
      redirectUri,
    });
  }

  // STEP3 Get user info
  const user_info = await liff.getDecodedIDToken();

  // console.log("Step3: ", user_info);
  // console.log("Step3: ", goto);

  // STEP4 Sent post request
  // payload is user_info & goto concat
  user_info.goto = goto;
  // console.log(user_info);

  try {
    await sendPostRequest(user_info);
  } catch (error) {
    console.log(error);
  }
  // STEP4 Redirect to goto
  if (typeof goto === "string") location.href = goto;
})();

const sendPostRequest = (payload) => {
  try {
    // use xhr
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        "https://hooks.zapier.com/hooks/catch/3479556/2mj4uuk/",
        true
      );
      xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.setRequestHeader("Accept", "*/*");
      xhr.onprogress = function () {
        resolve();
        // if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        //   // 請求成功,可以在這裡處理回應
        //   resolve(xhr.responseText);
        // }
      };
      xhr.onerror = function () {
        // 請求發生錯誤
        reject(xhr.statusText);
      };
      xhr.send(JSON.stringify(payload));
      // fetch 後不需要得到 response，直接 return
    });
  } catch (error) {
    return error;
  }
};

const getFullGotoParam = () => {
  const url = new URL(window.location.href);
  const goto = url.searchParams.get("goto");
  const hashPart = url.hash;

  return decodeURIComponent(goto) + hashPart;
};

(async () => {
  // STEP1 Init LIFF

  let liffId = "2004166882-GX8KoO4m"; // LIFF FULL
  // let liffId = "2004166882-6k5LZylq"; // LIFF TEST

  await liff.init({ liffId });
  console.log("Step1: ", "LIFF INIT");

  // STEP2 check is logined or not
  const isLogined = await liff.isLoggedIn();
  console.log("Step2: ", isLogined);
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

  console.log("Step3: ", user_info);
  console.log("Step3: ", goto);

  // STEP4 Sent post request
  // payload is user_info & goto concat
  user_info.goto = goto;
  console.log(user_info);
  sendPostRequest(user_info);
  // STEP4 Redirect to goto
  // if (typeof goto === "string") location.href = goto;
})();

const sendPostRequest = async (payload) => {
  try {
    // use xhr
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://script.google.com/macros/s/AKfycbz0wJxN7J8_5pJU18i4lg8rJl2HcdZVhk4W8QUyv8ICaW7j-7IiBP3TryXaEq3P96xh8A/exec",
      true
    );
    xhr.setRequestHeader("Content-Type", "text/plain");
    xhr.setRequestHeader("Accept", "*/*");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        // 請求成功,可以在這裡處理回應
        console.log(xhr.responseText);
      }
    };
    xhr.onerror = function () {
      // 請求發生錯誤
      console.error(xhr.statusText);
    };
    xhr.send(JSON.stringify(payload));
    // fetch 後不需要得到 response，直接 return
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

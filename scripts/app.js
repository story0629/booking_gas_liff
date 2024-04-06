(async () => {
  // STEP1 Init LIFF

  // need to judge 3 types
  // if url pathname "tall" line liffID = aaaa
  // if url pathname "full" line liffID = bbbb
  // if url pathname "compact" line liffID = cccc

  //   let liffID = "XXXXXXXXXXXXXXXXXXX";
  //   if (new URL(location).pathname.includes("tall")) liffID = "aaa";
  //   if (new URL(location).pathname.includes("full")) liffID = "bbb";
  //   if (new URL(location).pathname.includes("compact")) liffID = "ccc";

  const liffID = "2004166882-p8e0rDvx";
  await liff.init({ liffId: liffID });
  console.log("Step1: ", "LIFF INIT");

  // STEP2 check is logined or not
  const isLogined = await liff.isLoggedIn();
  console.log("Step2: ", isLogined);

  if (!isLogined) {
    // 轉址的網址 目前網址加上 goto
    const redirectUri = location.href;
    liff.login({
      redirectUri,
    });
  }

  // STEP3 Get user info
  const user_info = await liff.getDecodedIDToken();
  const goto = new URL(location).searchParams.get("goto");

  console.log("Step3: ", user_info);
  console.log("Step3: ", goto);

  // STEP4 Sent post request
  // payload is user_info & goto concat
  sendPostRequest(user_info);

  //   // STEP4 Redirect to goto
  //   if (typeof goto === "string") location.href = new URL(goto, location).href;
})();

const sendPostRequest = async (payload) => {
  const res = await fetch(
    "https://script.google.com/macros/s/AKfycbyJY239-j0WXwlttvqpgibdyhvzvkPJ5suMYj59ZktdY7ArLr0ShojK4Rh-ziDIX3_ehQ/exec",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  // fetch 後不需要得到 response，直接 return

  return "";
};

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
  const goto = new URL(location).searchParams.get("goto");

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
  sendPostRequest(user_info);

  // STEP4 Redirect to goto
  if (typeof goto === "string") location.href = new URL(goto, location).href;
})();

const sendPostRequest = async (payload) => {
  await fetch(
    "https://script.google.com/macros/s/AKfycbybVjk_UwyHE83N_rG8mBGqLIgvyGT1dOX6XUG8kW380A742J58IncE-xrg3qZyGUTJHw/exec",
    {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(payload),
    }
  );
  // fetch 後不需要得到 response，直接 return

  return "";
};

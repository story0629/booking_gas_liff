(async () => {
  // STEP1 Init LIFF

  // need to judge 3 types
  // if url pathname "tall" line liffID = aaaa
  // if url pathname "full" line liffID = bbbb
  // if url pathname "compact" line liffID = cccc

  let liffId = "2004166882-p8e0rDvx";
  if (new URL(location).pathname.includes("tall"))
    liffId = "2004166882-p8e0rDvx";
  if (new URL(location).pathname.includes("full"))
    liffId = "2004166882-GX8KoO4m";
  if (new URL(location).pathname.includes("compact"))
    liffId = "2004166882-3QWVx8qR";

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
  const response = await fetch(
    "https://script.google.com/macros/s/AKfycbw_o1awV04-WOPs2R8vUoPS_YzgKU_I708WWjjG14BStrlGaeHmNHYBlOE1JSblc7niTw/exec",
    {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(payload),
    }
  );
  // fetch 後不需要得到 response，直接 return

  return response;
};

const getFullGotoParam = () => {
  const url = new URL(window.location.href);
  const goto = url.searchParams.get("goto");
  const hashPart = url.hash;

  return decodeURIComponent(goto) + hashPart;
};

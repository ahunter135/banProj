// Start Standard Setup Template
var createError = require("http-errors");
var express = require("express");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const banano = require("./banano.js");
require("dotenv").config();
var app = express();
const dayjs = require("dayjs");
const http = require("http");
const bananojs = require("bananojs");
var cors = require("cors");
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("public/frontend/dist/banProj"));
app.use(cors());
// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});
// End Standard Setup Template

// Only process one payment at a time flag
let processingPayment = false;

// Deposit amount required to change image
const depositValue = 1;
// Time to wait to validate deposit
const timeToWait = 60;
// Image to show
let currentImage = "";

//Image to show if payment approves
let imageInHolding = "";

let interval;

const masterAddress = process.env.BANADDR;

// simple get endpoint to return the stored image
app.get("/getPhoto", async (req, res) => {
  res.send(currentImage);
});

// Route to make a deposit
app.post("/make_a_deposit", async (req, res) => {
  // get image and addressfrom POST
  imageInHolding = req.body["image"];

  // If we are currently processing a payment, refund their ban and let them know
  if (processingPayment) {
    res.send("Payment Already Processing. Try again shortly");
  } else {
    try {
      // Currently processing a payment
      processingPayment = true;

      // Create a new account and send it to them.
      let { account, seed } = await getAccountInfo();
      let timer = timeToWait;
      interval = setInterval(async () => {
        if (processingPayment) {
          timer--;
          let account_history = await banano.get_account_history(account);
          if (Array.isArray(account_history.history)) {
            let timestamp = dayjs.unix(
              account_history.history[0].local_timestamp
            );
            let now = dayjs();
            if (
              (now.diff(timestamp, "seconds") <= timeToWait &&
                account_history.history[0].type === "receive",
              account_history.history[0].confirmed)
            ) {
              // We have received a deposit within 60 seconds from the proper address
              // is it the right amount?
              if (account_history.history[0].amount_decimal >= depositValue) {
                processingPayment = false;
                paymentReceived(seed, account);
              } else {
                console.log("Wrong amount");
                // wrong amount received.
                await bananojs.sendBananoWithdrawalFromSeed(
                  seed,
                  0,
                  account_history.history[0].account,
                  account_history.history[0].amount_decimal
                );

                res.send("Wrong amount of BAN Sent. Please try again.");
              }
            }
            if (timer <= 0) {
              paymentNotReceived();
              res.send("BAN not received. Please try again");
            }
          }
        }
      }, 1000);
      res.send(account);
    } catch (error) {}
  }
});

http.createServer({}, app).listen(8020, function () {
  console.log("Running App on port 8020");
});

async function paymentReceived(seed, account) {
  // stop our check loop
  clearInterval(interval);
  currentImage = imageInHolding;
  let balance = await banano.check_bal(account);
  // send balance along
  if (balance > 0) {
    await bananojs.sendBananoWithdrawalFromSeed(
      seed,
      0,
      process.env.BANADDR,
      depositValue
    );

    let depositInterval = setInterval(async () => {
      let res = await bananojs.receiveBananoDepositsForSeed(seed, 0, account);
      console.log(res);
      if (res) {
        clearInterval(depositInterval);
      }
    }, 6000);
  }
}

async function paymentNotReceived() {
  clearInterval(interval);
  processingPayment = false;
  imageInHolding = null;
}

/*
 this creates a new account
*/
async function getAccountInfo() {
  const url = "https://kaliumapi.appditto.com/api";
  const crypto = require("crypto");
  const seed = crypto.randomBytes(32).toString("hex");
  const privateKey = await bananojs.getPrivateKey(seed, 0);
  const publicKey = await bananojs.getPublicKey(privateKey);
  const account = bananojs.getBananoAccount(publicKey);
  bananojs.setBananodeApiUrl(url);
  return { account, seed };
}

module.exports = app;


const { port, badWordsListUrl, mock3dPartySmsServerUrl } = require('./assets/config.json');
const express = require('express');
const helmet = require("helmet");
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const axiosWithLimit = rateLimit(axios.create(), { maxRPS: 10 })
const app = express();
const { v4 } = require('uuid');


app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(compression());




const BAD_WORDS_SET = new Set();




onStartUpGetBadWordsListAsSet = async () => {
  try {
    const { data: badWords } = await axios.get(badWordsListUrl);
    const splittedBadWords = badWords.split('\n');
    splittedBadWords.shift()//first element is ''
    splittedBadWords.forEach(badWord => {
      BAD_WORDS_SET.add(badWord.toLowerCase())
    });
  } catch (e) {
    console.error(`error getting bad words list from ${badWordsListUrl}. error: ${e}`)
  }
}

const badWordsFilterMiddleware = (req, res, next) => {
  const { message } = req.body;

  if (!message) {
    res.status(400).send('message is empty')
  }
  const messageAsWords = message.split(" ");
  const isContainsBadWord = messageAsWords.some((word) => BAD_WORDS_SET.has(word.toLowerCase()))

  if (isContainsBadWord) {
    res.status(400).send('message contains a forbidden word and will not be sent')
  } else {
    next()
  }
}

const sendSmsTo3PartyMock = ({ recipient, message, sender, transaction_id }) => {
  //i didnt know if the 3dparty mock hast he limit config or this server. i put it in both.
  //i dont think the limit will apply in cluster mode. i would probably use redis store or another 
  // store with the limit package 

  return axiosWithLimit.post(mock3dPartySmsServerUrl, { recipient, message, sender }).then((res) => {

    console.log(`message ${transaction_id} was successfully delivered`);
  })
    .catch((e) => {
      console.error(`an error occurred sending sms to third party service ${e}`);
      return e;
    })


}

const main = async () => {
  await onStartUpGetBadWordsListAsSet();//didnt have time for redis, or elasticsearch or mongodb
  app.post('/sms/send', badWordsFilterMiddleware, async (req, res) => {
    try {
      const { recipient, message, sender } = req.body;

      if (!recipient || !message || !sender) {
        const error = `required params for sms send missing 
      recipient: ${recipient}, sender: ${sender} message: ${message}`;
        console.error(error)
        throw new Error(error);
      }

      const transaction_id = v4();

      //wasnt sure if i was meant to wait for 3dparty response or not.
      await sendSmsTo3PartyMock({ transaction_id, recipient, message, sender })
      return res.status(200).json({ transaction_id })
    } catch (e) {
      console.error(`an error occurred while receiving sms ${JSON.stringify(e)}`)
      return res.status(400).send('an error occurred while receiving sms')
    }
  })

  app.listen(process.env.PORT || port, function () {
    console.log(` listening on port ${process.env.PORT || port}`)
  })
}



main();


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
const { connectToMongoDb, addMsgToDb, updateMsgDb, getSmsStatus } = require('./db/mongodb.js')

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
    splittedBadWords.pop()//last element is ''
    splittedBadWords.forEach(badWord => {
      BAD_WORDS_SET.add(badWord.toLowerCase())
    });
  } catch (e) {
    console.error(`error getting bad words list from ${badWordsListUrl}. error: ${e}`)
  }
}

const badWordsFilterMiddleware = (req, res, next) => {
  const { message, sender, recipient } = req.body;

  if (!message) {
    res.status(400).send('message is empty')
  }
  const messageAsWords = message.split(" ");
  const isContainsBadWord = messageAsWords.some((word) => BAD_WORDS_SET.has(word.toLowerCase()))

  if (isContainsBadWord) {
    const transaction_id = v4();
    addMsgToDb({ recipient, message, sender, transaction_id, status: 'FAILED' }, true);
    res.status(400).send('message contains a forbidden word and will not be sent')
  } else {
    next()
  }
}

const sendSmsTo3PartyMock = ({ recipient, message, sender, transaction_id }) => {
  //i didnt know if the 3dparty mock hast he limit config or this server. i put it in both.
  //i dont think the limit will apply in cluster mode. i would probably use redis store or another 
  // store with the limit package 

  return axiosWithLimit.post(mock3dPartySmsServerUrl, { recipient, message, sender })
    .then((res) => {
      updateMsgDb(transaction_id, { status: 'SENT' })
      console.log(`message ${transaction_id} was successfully delivered`);
      return
    })
    .catch((e) => {
      console.error(`an error occurred sending sms to third party service ${e}`);
      return e;
    })


}

const main = async () => {
  await connectToMongoDb();
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
      await addMsgToDb({ recipient, message, sender, transaction_id, status: 'ACCEPTED' }, false);

      //wasnt sure if i was meant to wait for 3dparty response or not.
      sendSmsTo3PartyMock({ transaction_id, recipient, message, sender })


      return res.status(200).json({ transaction_id });
    } catch (e) {
      console.error(`an error occurred while receiving sms ${JSON.stringify(e)}`);
      updateMsgDb(transaction_id, { status: 'FAILED' })
      return res.status(400).send('an error occurred while receiving sms')
    }
  })



  app.get('/sms/status', async (req, res) => {
    const { transaction_id } = req.body;

    const sms = await getSmsStatus(transaction_id);

    if (sms) {
      res.status(200).send(`sms ${transaction_id} status is ${sms.status}`);
    } else {
      res.status(400).send(`could not find sms status of ${transaction_id}`);
    }
  })

  app.listen(process.env.PORT || port, function () {
    console.log(` listening on port ${process.env.PORT || port}`)
  })
}



main();

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
let connection;
let SmsModel


const SmsMsg = new Schema({
    recipient: String,
    message: String,
    sender: String,
    transaction_id: { type: String, unique: true, required: true, required: true },
    status: {
        type: String,
        enum: ['ACCEPTED', 'SENT', 'FAILED']
    },
    date: { type: Date, default: Date.now },
    expireNonAcceptedStatusAt: {
        type: Date,
        default: null
    }
});

SmsMsg.index({ "expireNonAcceptedStatusAt": 1 }, { expireAfterSeconds: 50 * 60 * 60 }); // 50min


async function connectToMongoDb() {
    try {
        connection = await mongoose.createConnection('mongodb://localhost/db', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });

        SmsModel = connection.model('SmsMsgSchema', SmsMsg);
        setChangeMsgAcceptedToFailedInterval();
    } catch (e) {
        console.error(`error connection to db ${e}`)
    }

}

function setChangeMsgAcceptedToFailedInterval() {

    if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0") {
        setInterval(async () => {
            const res = await SmsModel.updateMany({ status: "ACCEPTED" }, { $set: { status: "FAILED", expireNonAcceptedStatusAt: new Date(Date.now() - 10 * 60 * 1000) } })
            console.log(`docs changed from accepted to failed ${JSON.stringify(res)}`)
        }, 1 * 60 * 1000)
    }
    // the code in here will only be executed on the first instance in the cluster
}


async function addMsgToDb({ recipient, message, transaction_id, sender, status }, isUseTtl) {
    try {
        const insertDoc = { recipient, message, transaction_id, sender, status };

        if (isUseTtl) {
            insertDoc.expireNonAcceptedStatusAt = new Date();
        }

        const msg = SmsModel(insertDoc);

        return msg.save();

    } catch (err) {
        console.error('save doc error', err)
    }

}

async function updateMsgDb(transaction_id, updatedData) {
    try {
        return SmsModel.findOneAndUpdate({ transaction_id }, { $set: { ...updatedData } })


    } catch (err) {
        console.error(`error updating docs ${transaction_id}\n newData ${JSON.stringify(updatedData)}`, err)
    }

}

function getSmsStatus(transaction_id) {

    return SmsModel.findOne({ transaction_id })
}




module.exports = {
    connectToMongoDb,
    addMsgToDb,
    updateMsgDb,
    getSmsStatus
}
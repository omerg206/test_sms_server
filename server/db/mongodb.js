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
    date: { type: Date, default: Date.now }
});




async function connectToMongoDb() {
    connection = await mongoose.createConnection('mongodb://localhost/db', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true
    });

    SmsModel = connection.model('SmsMsgSchema', SmsMsg);
}

async function addMsgToDb({ recipient, message, transaction_id, sender, status }) {
    try {
        const msg = SmsModel({ recipient, message, transaction_id, sender, status });

        return msg.save();

    } catch (err) {
        console.error('save doc error', err)
    }

}

async function updateMsgDb(transaction_id, updatedData) {
    try {
        return SmsModel.findOneAndUpdate({ transaction_id }, { $set: { ...updatedData } }, { upsert: true })


    } catch (err) {
        console.error(`error updating docs ${transaction_id}\n newData ${JSON.stringify(updatedData)}`, err)
    }

}




module.exports = {
    connectToMongoDb,
    addMsgToDb,
    updateMsgDb
}
var Schema = require('mongoose').Schema;

var dbHookUpdatedAt = require('./hooks').updatedAt;

var Account = new Schema({
	owner: String,
	account_number: String,
	balance: Number,
	pending_transactions: [],
	updated_at: Date,
	created_at: Date
});

Account.plugin(dbHookUpdatedAt);

module.exports = Account;
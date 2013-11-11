var mongoose = require('./dbconnection').dbConnection;
var Account = require('./schemas/account');
var Transaction = require('./schemas/transaction');


exports.Account = mongoose.model('Account', Account);
exports.Transaction = mongoose.model('Transaction', Transaction);

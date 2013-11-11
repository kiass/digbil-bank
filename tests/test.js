var Fs = require('fs');
var Bank = require('../lib/bank');
var Async = require('async');
var Models = require('./models');

var bank = new Bank({
	TransactionModel : Models.Transaction,
	AccountModel : Models.Account
});

var Account = Models.Account;
var data = JSON.parse(Fs.readFileSync(__dirname + '/data.js').toString());

Async.series([
	createAccounts,
	executeTransfers
]);

function createAccounts(callback) {

	Async.each( data.accounts, create, function(err){
		console.log(' == END createAccounts ==');
		callback(null);
	});

	function create(account, callback){

		var account = new Account({
			owner : account.owner,
			account_number : account.account_number,
			balance : account.balance,
		});

		account.save(function(err, result, rowsAffected){
			if(err){ 
				console.log(err); 
				callback(err);
			}
			if(result){ 
				//console.log(result);
				callback(null, result);
			}
		});
	}//eo create

}//eo createAccounts

function executeTransfers(callback) {

	Async.each( data.transfers, transfer, function(err){
		callback(null);
	});

	function transfer(transfer, callback){

		Async.series({
			userA: function(callback){
						Account.findOne({ 'account_number' : transfer.from }, function(err, result){
							if(err){ callback(err)  }
							if(result){ callback(null, result); }
						});
					},
			userB: function(callback){
						Account.findOne({ 'account_number' : transfer.to }, function(err, result){
							if(err){ callback(err)  }
							if(result){ callback(null, result); }
						});
					}
		},
			function(err, results) {
				bank.transfer(results.userA, results.userB, transfer.amount );

			}
		);
	}//eo transfer

}//eo executeTransfers




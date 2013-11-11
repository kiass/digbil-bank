var Async = require('async');
var Models = require('../tests/models');
/**
 * Takes care of all bank-related tasks
 * @constructor
 * @param: {object} params - an object literal that holds transaction and account model objects
 *                           e.g. { TransactionModel : object, AccountModel : object } 	
 */
var Bank = function(params){
	this.TransactionModel = params.TransactionModel;
	this.AccountModel = params.AccountModel;

	console.log('----- init Bank -----');
}

/**
 * Transfer dollar amount from one account to the other
 * @param: {object} userA - mongoose AccountModel object of the user who sends the money
 * @param: {object} userB - mongoose AccountModel object of the user who receives the money
 * @param: {number} amount - dollar amount of the transfer
 */
Bank.prototype.transfer = function(userA, userB, amount) {
	console.log('from: "' + userA.owner + '", to: "' + userB.owner + '", for amount: "' + amount + '"');
	var self = this;

	Async.waterfall([
		Async.apply(createTransaction, 'initial'),  //state = 'initial'
		Async.apply(enterState, 'pending'), 		//state = 'pending'
		applyTransactions,							//state = 'pending'
		Async.apply(enterState, 'committed'),		//state = 'committed'
		removePendingTransactions,					//state = 'committed'
		Async.apply(enterState, 'done'),			//state = 'done'
	],
		function(err, results){
			if(err) {
				console.log('[Error] Error occured during transaction! Please investigate.');
			} else {
				console.log('Transfer transaction completed!');
			}
		}
	);

	function createTransaction (state, callback){
		var transaction = new self.TransactionModel({
			from: userA.account_number,
			to: userB.account_number,
			amount: amount,
			state: 'initial'
		})

		transaction.save(function(err, result, rowsAffected){
			if(err){ 
				console.log('[ERROR] ' + err); 
				callback(err);
			}
			if(result){ 
				console.log(result);
				callback(null, { transaction: result });
			}
		});
	};//eo createTransaction

	function enterState(state, params, callback){

		var _params = params;

		params.transaction.enterState(state, function(result){
			console.log('--- updated transaction ---');
			//console.log(result);

			_params.transaction = result;
			callback(null, _params);
		});
	}

	function applyTransactions(params, callback){

		Async.parallel({
			UserA : function(callack){
				self.AccountModel.update(
					{ account_number: params.transaction.from, pending_transactions: {$ne: params.transaction._id} }, 
					{ $inc: { balance: -params.transaction.amount }, $push: { pending_transactions: params.transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log('[ERROR] ' + err); }
			          	if(rowsAffected) { console.log('[INFO] user A balance -' + params.transaction.amount); }
			          	callback(null, params);
				    }
				);
			},
			userB : function(callback){
				self.AccountModel.update(
					{ account_number: params.transaction.to, pending_transactions: {$ne: params.transaction._id} }, 
					{ $inc: { balance: params.transaction.amount }, $push: { pending_transactions: params.transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log('[ERROR] ' + err); }
			          	if(rowsAffected) { console.log('[INFO] user B balance +' + params.transaction.amount); }
			          	callback(null, params);
				    }
				);
			}
		});

	};//eo addTransactionToUsers

	function removePendingTransactions(params, callback){

		Async.parallel({
			UserA : function(callack){
				self.AccountModel.update(
					{ account_number: params.transaction.from }, 
					{ $pull: { pending_transactions: params.transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log('[ERROR] ' + err); }
			          	if(rowsAffected) { console.log('[INFO] remove pending transaction from user A .....'); }
			          	callback(null, params);
				    }	
				);
			},
			userB : function(callback){
				self.AccountModel.update(
					{ account_number: params.transaction.to }, 
					{ $pull: { pending_transactions: params.transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log('[ERROR] ' + err); }
			          	if(rowsAffected) { console.log('[INFO] remove pending transaction from user B .....'); }
			          	callback(null, params);
				    }
				);
			}
		});

	};//eo addTransactionToUsers

};//eo transfer

/**
 * Rollback transaction
 * @param: {object} transaction - mongoose TransactionModel object of the transaction to be rolled back
 */
Bank.prototype.rollback = function(transaction){
	var self = this;

	if( transaction.state === 'done' ||	transaction.state === 'committed' ) {
		console.log('[INFO] create new trx');

		Async.series({
			userA: function(callback){
						self.AccountModel.findOne({ 'account_number' : transaction.to }, function(err, result){
							if(err){ 
								console.log('[ERROR] ' + err);
								callback(err)  
							}
							if(result){ callback(null, result); }
						});
					},
			userB: function(callback){
						self.AccountModel.findOne({ 'account_number' : transaction.from }, function(err, result){
							if(err){ 
								console.log('[ERROR] ' + err);
								callback(err)  
							}
							if(result){ callback(null, result); }
						});
					}
		},
			function(err, results) {
				self.transfer(results.userA, results.userB, transaction.amount );

			}
		);
	} else {
		console.log('[INFO] canceling trx');
		Async.waterfall([
			Async.apply(enterState, 'canceling'),
			Async.apply(undoTransaction),
			Async.apply(enterState, 'canceled')
		]);
	}

	function createTransaction (state, callback){
		var transaction = new self.TransactionModel({
			from: userA.account_number,
			to: userB.account_number,
			amount: amount,
			state: 'initial'
		})

		transaction.save(function(err, result, rowsAffected){
			if(err){ 
				console.log('[ERROR] ' + err); 
				callback(err);
			}
			if(result){ 
				console.log(result);
				callback(null, { transaction: result });
			}
		});
	};//eo createTransaction

	function enterState(state, callback){
		self.TransactionModel.update(
			{ _id : transaction._id },
			{ $set: { state: state } },
			function(err, rowsAffected){
				console.log('[INFO] update transaction state to "' + state + '"');
	          	if(err) { console.log('[ERROR] ' + err); }
	          	callback(null);
			}
		);
	}


	function undoTransaction(callback){

		Async.parallel({
			UserA : function(callack){
				self.AccountModel.update(
					{ account_number: transaction.from, pending_transactions: transaction._id }, 
					{ $inc: { balance: transaction.amount }, $pull: { pending_transactions: transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log(err); }
			          	if(rowsAffected) { console.log('[INFO] user A balance +' + transaction.amount); }
			          	callback(null);
				    }
				);
			},
			userB : function(callback){
				self.AccountModel.update(
					{ account_number: transaction.to, pending_transactions: transaction._id }, 
					{ $inc: { balance: -transaction.amount }, $pull: { pending_transactions: transaction._id } },
					function(err, rowsAffected){
			          	if(err) { console.log(err); }
			          	if(rowsAffected) { console.log('[INFO] user B balance -' + transaction.amount); }
			          	callback(null);
				    }
				);
			}
		});
	}//eo revertAccounts

}//eo rollback



module.exports = Bank;

if (!module.parent) {
	var bank = new Bank({
		TransactionModel : Models.Transaction,
		AccountModel : Models.Account
	});

	Models.Transaction.findOne({}, {}, { $orderby : { 'created_at' : -1 } }, function(err, trx){
		if(err){
			console.log(err);
		}
		if(trx){
			console.log(trx);
			bank.rollback(trx);
		}
	});	

}

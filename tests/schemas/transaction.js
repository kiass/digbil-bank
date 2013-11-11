var Schema = require('mongoose').Schema;

var dbHookUpdatedAt = require('./hooks').updatedAt;

var Transaction = new Schema({
	from: String, 
	to: String, 
	amount: Number, 
	state: String,
	updated_at: Date,
	created_at: Date
});

Transaction.methods.enterState = function(state, callback){
	console.log('-----');

	//findByIdAndUpdate - new in Mongoose 3.X
	this.model('Transaction').findByIdAndUpdate(
		{ _id: this._id },
		{ $set: { state: state } },
		function(err, updatedDoc){
			console.log('[INFO] update transaction state to "' + state + '"');
          	if(err) { return err; }
          	
          	if(callback && typeof(callback) == "function"){
          		callback(updatedDoc);
          	}
		}
	);
};


Transaction.plugin(dbHookUpdatedAt);

module.exports = Transaction;

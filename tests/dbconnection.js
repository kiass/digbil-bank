var Fs = require('fs');
var Mongoose = require('mongoose');
var Config  = JSON.parse(Fs.readFileSync(__dirname + '/dbconfig.js').toString());

var uri = 'mongodb://' + 
		  Config.mongodb.host + ':' +
          Config.mongodb.port + '/' +
          Config.mongodb.database;

var options = {
	user : Config.mongodb.username,
	pass : Config.mongodb.password,
	server : {
		poolSize : Config.mongodb.poolSize? Config.mongodb.poolSize : 5
	}
}

module.exports.dbConnection = Mongoose.connect( uri, options );
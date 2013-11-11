# Bank.js #

Bank is a utility module which takes care of money transfer between customer accounts

# Getting started #

The source is available for download from [GitHub](https://github.com/Formosan/digbil-bank). Alternatively, you can install using Node Package Manager (npm):
```javascript
npm insall digbil-bank
```

To start using the bank object, do the following first
```javascript
var Bank = require('digbil-bank');
var bank = new Bank({
  AccountModel : { mongoose account model },
  TransactionModel : { mongoose transaction model }
});
```

{ mongoose account model } is created using the following Account schema
```javascript
//Account Schema

var Account = new Schema({
	owner: String,
	account_number: String,
	balance: Number,
	pending_transactions: [],
	updated_at: Date,
	created_at: Date
});
```
{ mongoose transaction model } is created using the following Transaction schema
```javascript
//Transaction Schema

var Transaction = new Schema({
	from: String, 
	to: String, 
	amount: Number, 
	state: String,
	updated_at: Date,
	created_at: Date
});
```


To make a transfer from userA to userB, do the following
```javascript
bank.transfer( {userA}, {userB}, amount);
```
where userA and userB are of Account object type (Mongoose model object) and amount is the numeric dollar amount of transfer.

# Run tests #

The source comes with test scripts that can be found in the ./tests directory. 
There are two files required to be set up befor running the test scripts, they are "data.js" and "dbconnection.js".

#### data.js ####

"data.js" defines the mock bank accounts and transfers be to tested. To define an account, add a json object to the "accounts" array (for more details, please refer to data.js)

```javascript
{ "owner" : "Joseph Yang", "account_number" : "11111111", "balance" : 200 } 
{ "owner" : "Renaud Sauvain", "account_number" : "55555555", "balance" : 200 } 
```
To define a bank transfer, add a json object to the "transfers" array
```javascript
{ "from" : "11111111", "to" : "55555555", "amount" : 10 }
```

#### dbconfig.js ####

You can configure MongoDB connection in dbconfig.js

# Safety measures #
A bank transfer involves 2 accounts (sender and receiver) to be updated. However mongoDB only ensures the atomicity on a single document In other words, a transaction involving multiple documents is not natively supported by MongoDB. One popular workaround is to employ the "2-phase commit" strategy.

# 2-phase commit #

1. When the transfer is initiated, create am entry in the Transaction (or equivalent) collection and mark its state as "initial"
e.g. 
```javascript
{ _id: ObjectId( '527f637f5b6babd204000006' ), from : '11111111', to: '55555555', amount: 10, state: "initial" }
```
2. Update the state of the transaction to "pending"
e.g.
```javascript
{ _id: ObjectId( '527f637f5b6babd204000006' ), from : '11111111', to: '55555555', amount: 10, state: "pending" }
```

3. Apply transaction to each user's document. Two operations take place in this step [1] balance adjustment and, [2] transaction added to pending_transaction array of each account.
MongoDB's atomic support on a single document ensures both operations to succeed (or fail) altogether.
e.g. 
userA
```javascript
{ _id: ObjectId( "0001" ), account_number : "11111111", owner : "Joseph Yang", balance: 190, pending_transactions: [ ObjectId( "527f637f5b6babd204000006" )]  }
```
userB
```javascript
{ _id: ObjectId( "0002" ), account_number : '55555555', owner : "Renaud Sauvain", balance: 210, pending_transactions: [ ObjectId( "527f637f5b6babd204000006" )]  }
```

4. Update the state of the transaction to "committed"
e.g.
```javascript
{ _id: ObjectId( '527f637f5b6babd204000006' ), from : '11111111', to: '55555555', amount: 10, state: "committed" }
```

5. Remove transaction from both user's pending_transaction array
e.g.
userA
```javascript
{ _id: ObjectId( "0001" ), account_number : "11111111", owner : "Joseph Yang", balance: 190, pending_transactions: []  }
```
userB
```javascript
{ _id: ObjectId( "0002" ), account_number : '55555555', owner : "Renaud Sauvain", balance: 210, pending_transactions: []  }
```

6. Update the state of the transaction to "complete"e.g.
```javascript
{ _id: ObjectId( 527f637f5b6babd204000006 ), from : "11111111", to: '55555555', amount: 10, state: "pending" }
```


# Concurrent database access #  

Concurrent database access is fullfilled by using connection pooling. The number of pooled connections can be configured using similar fashion as seen in "./tests/dbconfig.js" and "./tests/dbconnection.js".

Please note that a Mongoose connection should be shared among all models so that the number of connections is minimised per application. This allows concurrent database access by multiple servers/applications.


# RollBack #

#### After a transaction has been committed ####

When transaction's state is equal to either "committed" or "done". In this case we need to create a new transaction entry where its "from" and "to" are the "to" and "from" of the transaction we want to apply the rollback to. Please note that it is crucial to preserve the original transaction entry for enterprise-wide analytics purposes

1. When the transfer is initiated, create an entry in the Transaction (or equivalent) collection and mark its state as "initial"
e.g. 
```javascript
{ _id: ObjectId( '527f637f5b6babd204000009' ), from : '55555555', to: '11111111', amount: 10, state: "initial" }
```
2. Update the state of the transaction to "pending"
e.g.
```javascript
{ _id: ObjectId( '527f637f5b6babd204000009' ), from : '55555555', to: '11111111', amount: 10, state: "pending" }
```

3. Apply transaction to each user's document. Two operations take place in this step [1] balance adjustment and, [2] transaction added to pending_transaction array of each account.
MongoDB's atomic support on a single document ensures both operations to succeed (or fail) altogether.
e.g. 
userA
```javascript
{ _id: ObjectId( "0001" ), account_number : "11111111", owner : "Joseph Yang", balance: 200, pending_transactions: [ ObjectId( "527f637f5b6babd204000009" )]  }
```
userB
```javascript
{ _id: ObjectId( "0002" ), account_number : '55555555', owner : "Renaud Sauvain", balance: 200, pending_transactions: [ ObjectId( "527f637f5b6babd204000009" )]  }
```

4. Update the state of the transaction to "committed"
e.g.
```javascript
{ _id: ObjectId( '527f637f5b6babd204000009' ), from : '55555555', to: '11111111', amount: 10, state: "committed" }
```

5. Remove transaction from both user's pending_transaction array
e.g.
userA
```javascript
{ _id: ObjectId( "0001" ), account_number : "11111111", owner : "Joseph Yang", balance: 200, pending_transactions: []  }
```
userB
```javascript
{ _id: ObjectId( "0002" ), account_number : '55555555', owner : "Renaud Sauvain", balance: 200, pending_transactions: []  }
```

6. Update the state of the transaction to "done"e.g.
```javascript
{ _id: ObjectId( 527f637f5b6babd204000009 ), from : "55555555", to: '11111111', amount: 10, state: "done" }
```

#### Before a transaction is applied to user accounts ####
In this case, the balances of both user accounts have not been reflected as per the transaction.

1. Update the state of the transaction to "canceling"
e.g.
```javascript
{ _id: ObjectId( 527f637f5b6babd204000006 ), from : "11111111", to: '55555555', amount: 10, state: "canceling" }
```

2. Update balances and remove transactions history for both users 
userA
```javascript
{ _id: ObjectId( "0001" ), account_number="11111111", owner : "Joseph Yang", balance: 200, pending_transactions: [] }
```
userB
```javascript
{ _id: ObjectId( "0002" ), account_number='55555555', owner : "Renaud Sauvain", balance: 200, pending_transactions: [] }
```
Note: the balance of both accounts will not be affected if the transaction to be rolled back is not found in their respective pending transaction arrays.

3. Update the state of the transaction to "canceled"
e.g.
```javascript
{ _id: ObjectId( 527f637f5b6babd204000006 ), from : "11111111", to: ObjectId( "0002" ), amount: 10, state: "canceled" }
```

# System fail over #
If the system breaks down at any one point during execution, the "state" in the each transaction provides a good indication as to how the transfer should be completed. A cronjob can be set up to handle failed cases (generally on a daily basis)


- If state = "initial", execute from 2nd step onwards. (refer to "2-phase commit" section)
- If state = "pending" and the transaction is not found in users' pending_transaction array, execute from 3rd step onwards.
- if state = "pending" and the transaction is found in users' pending_transaction array, execute from 4th step onwards. 
- if state = "committed" and the transaction is found in users' pending_transaction array, execute from 
5th step onwards.
- if state = "committed" and the transaction is not found in users' pending_transaction array, execute 6th step



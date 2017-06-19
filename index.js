
var config = require('./config.json');
var  users = config.users;

var booking = require('./booking.js');
 
var args = process.argv.splice(2);
var userIndex = +(args[0] || 0);
booking(users[userIndex]);


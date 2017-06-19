var phantom = require('phantom'),
    fs = require('fs');

var config = require('./config/config.json'); 
var interval = (config.interval || 15) * 1000; 

var page, pInstance;
var login = function(user, urls){
    phantom.create([])
    .then(function(instance){  
        pInstance = instance;   
        return instance.createPage();
    })
    .then(function(sitepage){
        page = sitepage;
        page.property('onConsoleMessage', onConsoleMessage);
        page.setting('userAgent', 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36');      
        return page.open(urls.login);
    }).then(function(status){      
        if(status == "success"){
            //begin login
            page.evaluate(function(user) {
                var txtUserId = document.getElementById('txtOperid');
                var txtPassword = document.getElementById('txtPwd');
                if(txtUserId && txtPassword){
                    txtUserId.value = user.userId;
                    txtPassword.value = user.password
                    document.getElementById('btnLogin').click();
                }
            },  {userId: user.userId, password: user.password}); 
        }
    }).then(function(){
            var intervalTimer; 
        var loginCallback = function(){    
            intervalTimer && clearInterval(intervalTimer);
            intervalTimer = setInterval(function () {
                logger(user.userId + ' - checking...');   
                page.evaluate(function(params) {                     
                     var url = params.url,
                        userId = params.userId,
                        phone = params.phone,
                        willBooking = params.type == "all",
                        smsUrl = params.smsUrl,
                        bookingUrl = params.bookingUrl;
                    
                    console.log(params);
                    //message
                    var sms = function(message){
                        message["Phone"] = phone;
                        message["UserId"] = userId;
				        message["SendTime"] = new Date().toLocaleString();
                        console.log(JSON.stringify(message));
                        $.post(smsUrl,message , function(smsResult){
                            console.log("sms result: " + smsResult);
                        })                              
                    }

                    //formate datetimeï¼?"/Date(1474858800000)/" =>  2016/9/27  
                    function formatDate(dateString){
                        return new Date(eval(dateString.replace(/\//g,'') )).toLocaleDateString()
                    }
                     
                    try {
                        $.getJSON(url, function(result){
                                                    
                        var bookings = result.RList && result.RList.filter(function(item){
                            return item.RobStatus === 0;
                        })

                        if(bookings && bookings.length){
                            var highBookings = [],
                                normalBookings = [];
                                bookings.forEach(function(item){
                                    if(item.IsShowHighQualityTag){
                                        highBookings.push(item)
                                    }else{
                                        normalBookings.push(item); 
                                    }
                                });

                            //begin grab
                            if(highBookings && highBookings.length){
                                highBookings.forEach(function(item){                                        
                                    var message = {
                                        "Id": item.RequireID,
                                        "StartDate": formatDate(item.MinDepartureDate),
                                        "StartCity": item.Departure,
                                        "EndDate": formatDate(item.MaxDepartureDate),
                                        "EndCity": item.DestinationShow,
                                        "PeopleNumber": item.PeopleNumber,
                                        "DayNumber": item.DayNumber
                                    }
                                    

                                    if(!willBooking){
                                        message["Type"] = 2;
                                        sms(message);
                                        return;
                                    }
                                    $.post(bookingUrl,{
                                        "requireDetailID": item.RequireDetailID
                                    },function(bookingResult){
                                        if(typeof bookingResult === "string"){
                                            bookingResult = JSON.parse(bookingResult)
                                        }
                                                                    
                                        if(bookingResult && bookingResult.Success){
                                            
                                            //grab success   
                                            message["Type"] = 1;                                            
                                            sms(message);
                                        }
                                    })

                                });
                            }

                            if(normalBookings && normalBookings.length){
                                normalBookings.forEach(function(item){
                                    
                                    var message = {
                                        "Id": item.RequireID,
                                        "Type": 2,
                                        "StartDate": formatDate(item.MinDepartureDate),
                                        "StartCity": item.Departure,
                                        "EndDate": formatDate(item.MaxDepartureDate),
                                        "EndCity": item.DestinationShow,
                                        "PeopleNumber": item.PeopleNumber,
                                        "DayNumber": item.DayNumber
                                    }

                                    sms(message);
                                })                                    
                            }
 
                        }                                
                    })
                    } catch (error) {
                        
                    }
                }, {
                    url: urls.ajaxUrl, 
                    smsUrl: urls.smsUrl, 
                    bookingUrl: urls.bookingUrl,
                    userId: user.userId, 
                    phone: user.phone, 
                    type: user.type
                });
            }, interval);
        }
         
        setTimeout(function(){    
            page.open(urls.middle).then(function(status){
                page.evaluate(function(){
                    function getCookie(name){
                        var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
                        if(arr=document.cookie.match(reg))
                            return unescape(arr[2]);
                        else
                            return null;
                    }
                    return !!getCookie("loginCookie");
                }).then(function(loginSuccess){
                    logger(user.userId + '    login result - '+ loginSuccess);  
                    if(loginSuccess){
                        loginCallback();
                    }else{
                        login(user, urls);
                    }
                });    
            });
 
        }, 3000);

    });
};

function waiteFor(condition, callback){
    var i = 0;
    var interval = setInterval(function(){
        if(i++ > 3){
            interval && clearInterval(interval);
        }
        if(condition()){
            callback();
            interval && clearInterval(interval);
        }
    }, 2000)  
}


function onConsoleMessage(data){
    var data = JSON.parse(data); 
    var message = JSON.stringify(data, undefined, 4);   
    console.log("message", message);
}

function logger(message){
    console.log(message);
    var now = new Date();
    var fileName = `${now.getYear()}-${now.getMonth()}-${now.getDate()}`;
    fs.appendFile(fileName + '.txt', new Date().toLocaleString() + " - " + message + "\n", 'utf-8');
}

module.exports = login;

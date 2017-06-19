 
var Nightmare = require('nightmare'), 
    logger=require("./lib/logger"),
    config = require('./config/config.json');

var urls = config.urls,
    users = config.users,
    loginErrorCount=0,
    isloginOut=false,
    hasBookingUrlQueue={},
    intervalTimer,
    interval =(config.interval || 15) * 1000;
    runTimer; 

var option={
        show: true,
        center:true,
        width:1024,
        height:768,
        title:"ctrip-vbooking",
        backgroundColor:"#66CD00"
    };
var nightmare = Nightmare(option);

var login=module.exports =function (user){
    if(!user){
        return;
    } 
    
    if(user.loginCtrip){
        loginCtripCount(user,redirectUrl);
    }else{
        loginVbookingCount(user,redirectUrl);
    }
};

function redirectUrl(user){
    nightmare 
    .goto(urls.dispatchUrl)
    .wait(2000)
    .evaluate(function(){
        function getCookie(name){
            var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
            if(arr=document.cookie.match(reg))
                return unescape(arr[2]);
            else
                return null;
        }
        
        return !!getCookie("loginCookie");
    })
    .then(function(loginSuccess){
        if(!loginSuccess){
            isloginOut=true;
            nightmare.end();
            login(user);
            return;  
        }

        bookingManager(user);
        moniter(user); 
    })
}


//监控器 10分钟执行一次
function moniter(user){
    logger("开启监控器");
    intervalTimer && clearInterval(intervalTimer);
    intervalTimer = setInterval(function () {
        logger("监控器执行");
        if(runTimer){
            clearTimeout(runTimer);
        }
        bookingManager(user);
    },interval*10);
}

function bookingManager(user){
    if(isloginOut){
        nightmare.end();
        login(user);
        return;
    }

    var url=urls.grabRequireUrl+"?v="+ new Date().getTime();
    nightmare
    .goto(url)
    //.refresh()
    .evaluate(function () {
        var urls=[];

         function getCookie(name){
            var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
            if(arr=document.cookie.match(reg))
                return unescape(arr[2]);
            else
                return null;
        }

        var detailNodes= document.querySelectorAll(".order_detail .td9");
        [].forEach.call(detailNodes,function(item){
            if(item&&item.firstChild){
                urls.push(item.firstChild.href);
            }
        })

        var loginStatus= !!getCookie("loginCookie");
        return {detailUrls:urls,loginStatus:loginStatus}; 
    })
    .then(function (obj) {
        logger(obj);
             
        if(!obj.loginStatus){
            isloginOut=true;
            nightmare.end();
            login(user);
            return;
        }

        if(!obj.detailUrls||obj.detailUrls.length==0){
            runTimer&&clearTimeout(runTimer);
            runTimer=setTimeout(function(){
                bookingManager(user);
            }, interval); 
        }else{  
            redirectGtabDetail(obj.detailUrls,user);
        } 
    })
    .catch(function (error) {
        logger("bookingManager",true);
        logger(error,true);
        runTimer&&clearTimeout(runTimer);
        runTimer=setTimeout(function(){
            bookingManager(user);
        }, interval);
    }); 
}

function redirectGtabDetail(detailUrls,user){
    if(isloginOut){
        nightmare.end();
       return login(user); 
    }

    if(!detailUrls||detailUrls.length==0){
        runTimer&&clearTimeout(runTimer);
        runTimer=setTimeout(function(){
            bookingManager(user);
        }, interval);     
        return;
    }

    var url=detailUrls.shift();
    if(url==""|| hasBookingUrlQueue[url]){ 
        return redirectGtabDetail(detailUrls,user);
    }
 
    hasBookingUrlQueue[url]=1;
    user["bookingUrl"]=urls.bookingUrl;
    user["gotoUrl"]=url;

    nightmare
    .goto(url)
    .evaluate(function (user) {
        function sms(message){
            message["Phone"] = user.phone;
            message["UserId"] = user.userId;
            message["SendTime"] = new Date().toLocaleString();
            console.log(JSON.stringify(message));
            $.post(user.smsUrl,message , function(smsResult){
                console.log("sms result: " + smsResult);
            })                                                                     
        }

        function getQueryString(name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)","i");
            var r = window.location.search.substr(1).match(reg);
            if (r!=null) return (r[2]); return null;
        }

        var canGrab=$("#btnGrabOrder").length>0;
        if(!canGrab){
            return {Result:false,Url:user.gotoUrl,Message:"抢单按钮不可见，不能预订"};
        }
        // 用车 4人以上 可以预定
        var orderInfo={};
        var trs=  document.querySelectorAll(".order_tab_content table tr");
        [].forEach.call(trs,function(item){
            var nodes=item.childNodes;
            var str=[];
            [].forEach.call(nodes,function(node){
                if(node.nodeType==1){
                    str.push(node.innerHTML.split("：")[0])
                }
            });
            orderInfo[str[0]]=str[1]; 
        })

        canGrab=canGrab&&orderInfo["提供服务"]&&orderInfo["提供服务"].indexOf("用车")>=0
        if(!canGrab){
            return {Result:false,Url:user.gotoUrl,Message:"抢单需求不存在用车，不可预订"};
        }
        var excNum=orderInfo["出行人数"].match(/\d+(\.\d+)?/g);
        canGrab=canGrab&&(parseInt(excNum[0]||0)+parseInt(excNum[1]||0)>=4);
        if(!canGrab){
            return {Result:false,Url:user.gotoUrl,Message:"抢单需求人数小于4，不可预订"};
        }
 
        var message = {
            "Id": getQueryString("requireDetailId"),
            "StartDate": orderInfo["出行日期"].split("至")[0],
            "StartCity": orderInfo["出发地"],
            "EndDate": orderInfo["出行日期"].split("至")[1],
            "EndCity": orderInfo["目的地"],
            "PeopleNumber": parseInt(excNum[0]||0)+parseInt(excNum[1]||0),
            "DayNumber": orderInfo["游玩天数"]
        }
                                   
    try {
               
        var paras = {
                requireDetailId: getQueryString("requireDetailId"),
                platformUserId: getQueryString("platformUserId"),
                platformProviderId: getQueryString("platformProviderId"),
                orderType: "GrabOrder"
            };

        $.post(user.bookingUrl,paras,function(bookingResult){
            if(typeof bookingResult === "string"){
                bookingResult = JSON.parse(bookingResult)
            }
                                                                    
            if(bookingResult && bookingResult.Success){  
                message["Type"] = 1;                                            
                sms(message);
            }
        })
        return { Result:true,Url:user.gotoUrl,Message:"已经异步抢单，请查收短信"};           
    } catch (error) {
        return {Result:false,Url:user.gotoUrl,Message:error} ;      
    } 
    },user)
    .then(function (result) {
        if(result&&result.Result){
            delete  hasBookingUrlQueue[url];
        }
        logger(result,false,true);
        redirectGtabDetail(detailUrls,user); 
    })
    .catch(function (error) {
        logger("redirectGtabDetail",true);
        logger(error,true);
        redirectGtabDetail(detailUrls,user);
    }); 
}

function loginVbookingCount(user,callback){
    nightmare
    .goto(urls.loginVbooking)
    .type('#txtOperid', user.userId)
    .type('#txtPwd', user.password)
    .wait(1000)
    .click('#btnLogin')
    .wait("#ctl00_liDingzhi")
    .then(function(){
        callback(user);
    })
    .catch(function (error) { 
        logger(error,true);
        loginErrorCount++;
        if(loginErrorCount>=3){
            nightmare.end();
        }
        setTimeout(function(){
            loginVbookingCount(user,callback);
        }, 5000);
    });
    ;
}

function loginCtripCount(user,callback){
    nightmare
    .goto(urls.loginCtrip)
    .type('#txtUserName', user.userId)
    .type('#txtPwd', user.password)
    .wait(5000)
    .click('#btnSubmit')
    .wait("#ctl00_liDingzhi")
    .then(function(){
        callback(user);
    })
    .catch(function (error) { 
        logger(error,true);
        loginErrorCount++;
        if(loginErrorCount>=3){
            nightmare.end();
        }
        setTimeout(function(){
            loginCtripCount(user,callback);
        }, 5000);
    }); 
}
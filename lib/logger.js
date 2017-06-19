	var fs=require("fs");

var logger=module.exports=function (message,errorType,searchResult){
   // console.log(message);
   	searchResult=!!searchResult;
	if(!message){
   		return;
	}

	if(typeof message ==="object"){
   		message=JSON.stringify(message);
	}

	var now = new Date();
	var fileName =(errorType==true?"error-":(searchResult?"result-":""))+`${now.getYear()}-${now.getMonth()+1}-${now.getDate()}`; 
    fs.appendFile("log/"+fileName + '.txt', new Date().toLocaleString() + " - " + message + "\n", 'utf-8');
}

@echo off

echo 重起服务开始
::下面是批处理代码

Taskkill /F /IM node.exe 

pm2 start pm2.json

::暂停 3 秒时间
ping -n 3 127.0.0.1 > nul

::暂停
::pause
pause

Exit
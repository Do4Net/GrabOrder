@echo off

echo �������ʼ
::���������������

Taskkill /F /IM node.exe 

pm2 start pm2.json

::��ͣ 3 ��ʱ��
ping -n 3 127.0.0.1 > nul

::��ͣ
::pause
pause

Exit
@echo off
cd /d "D:\Timetable-Scheduler-main\backend"
"C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe" -jar target\timetable-scheduler-1.0.0.jar --spring.profiles.active=h2 1> "D:\Timetable-Scheduler-main\backend\server_dept_test.log" 2>&1

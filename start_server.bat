@echo off
cd /d "D:\Timetable-Scheduler-main\backend"
java -jar target\timetable-scheduler-1.0.0.jar --spring.profiles.active=h2 > "D:\Timetable-Scheduler-main\backend\server_run4.log" 2>&1

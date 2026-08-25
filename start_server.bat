@echo off
cd /d "D:\Timetable Scheduling\backend"
java -jar target\timetable-scheduler-1.0.0.jar --spring.profiles.active=h2 > "D:\Timetable Scheduling\server_run4.log" 2>&1

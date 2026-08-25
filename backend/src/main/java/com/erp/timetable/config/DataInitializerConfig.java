package com.erp.timetable.config;

import com.erp.timetable.module.auth.entity.Role;
import com.erp.timetable.module.auth.entity.RoleName;
import com.erp.timetable.module.auth.entity.User;
import com.erp.timetable.module.auth.repository.RoleRepository;
import com.erp.timetable.module.auth.repository.UserRepository;
import com.erp.timetable.module.availability.entity.TimeSlot;
import com.erp.timetable.module.availability.repository.TimeSlotRepository;
import com.erp.timetable.module.classroom.entity.Classroom;
import com.erp.timetable.module.classroom.repository.ClassroomRepository;
import com.erp.timetable.module.department.entity.AcademicYear;
import com.erp.timetable.module.department.entity.Department;
import com.erp.timetable.module.department.entity.Section;
import com.erp.timetable.module.department.repository.DepartmentRepository;
import com.erp.timetable.module.faculty.entity.Faculty;
import com.erp.timetable.module.faculty.repository.FacultyRepository;
import com.erp.timetable.module.subject.entity.Subject;
import com.erp.timetable.module.subject.repository.SubjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializerConfig {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TimeSlotRepository timeSlotRepository;
    private final DepartmentRepository departmentRepository;
    private final FacultyRepository facultyRepository;
    private final ClassroomRepository classroomRepository;
    private final SubjectRepository subjectRepository;

    @Bean
    public CommandLineRunner seedData() {
        return args -> {
            // ── Seed Roles ──────────────────────────────────────
            List<RoleName> roleNames = Arrays.asList(
                RoleName.ROLE_SUPER_ADMIN,
                RoleName.ROLE_HOD,
                RoleName.ROLE_FACULTY,
                RoleName.ROLE_EXAM_COORDINATOR
            );

            roleNames.forEach(name -> {
                if (roleRepository.findByName(name).isEmpty()) {
                    roleRepository.save(Role.builder()
                        .name(name)
                        .description(name.name().replace("ROLE_", "").replace("_", " "))
                        .build());
                }
            });

            // ── Seed Admin User (Super Administrator) ──────────────────
            if (userRepository.findByUsername("admin").isEmpty()) {
                Role superAdmin = roleRepository.findByName(RoleName.ROLE_SUPER_ADMIN).orElseThrow();
                User admin = User.builder()
                    .username("admin")
                    .email("admin@college.edu")
                    .fullName("Super Administrator")
                    .password(passwordEncoder.encode("Admin@1234"))
                    .isActive(true)
                    .build();
                admin.addRole(superAdmin);
                userRepository.save(admin);
                log.info("✅ Super Admin user created (admin / Admin@1234)");
            }

            // ── Seed Time Slots ──────────────────────────────────
            if (timeSlotRepository.count() == 0) {
                List<TimeSlot> slots = List.of(
                    TimeSlot.builder().slotOrder(1).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(9, 50)).isBreak(false).slotLabel("Period 1").build(),
                    TimeSlot.builder().slotOrder(2).startTime(LocalTime.of(9, 50)).endTime(LocalTime.of(10, 40)).isBreak(false).slotLabel("Period 2").build(),
                    TimeSlot.builder().slotOrder(3).startTime(LocalTime.of(10, 50)).endTime(LocalTime.of(11, 40)).isBreak(false).slotLabel("Period 3").build(),
                    TimeSlot.builder().slotOrder(4).startTime(LocalTime.of(11, 40)).endTime(LocalTime.of(12, 30)).isBreak(false).slotLabel("Period 4").build(),
                    TimeSlot.builder().slotOrder(5).startTime(LocalTime.of(12, 30)).endTime(LocalTime.of(13, 30)).isBreak(true).slotLabel("Lunch Break").build(),
                    TimeSlot.builder().slotOrder(6).startTime(LocalTime.of(13, 30)).endTime(LocalTime.of(14, 20)).isBreak(false).slotLabel("Period 5").build(),
                    TimeSlot.builder().slotOrder(7).startTime(LocalTime.of(14, 20)).endTime(LocalTime.of(15, 10)).isBreak(false).slotLabel("Period 6").build(),
                    TimeSlot.builder().slotOrder(8).startTime(LocalTime.of(15, 15)).endTime(LocalTime.of(16, 5)).isBreak(false).slotLabel("Period 7").build()
                );
                timeSlotRepository.saveAll(slots);
                log.info("✅ Seeded 8 Schedule Time Slots");
            }

            // ── Seed Sample Departments & Department-Specific Logins ───
            if (departmentRepository.count() == 0) {
                Department cse = createDepartmentWithYears("Computer Science & Engineering", "Dr. A. Sharma", "cse@college.edu", "+91 9876543210", "Block A");
                Department ece = createDepartmentWithYears("Electronics & Communication", "Dr. B. Verma", "ece@college.edu", "+91 9876543211", "Block B");
                Department me = createDepartmentWithYears("Mechanical Engineering", "Dr. C. Patel", "me@college.edu", "+91 9876543212", "Block C");
                departmentRepository.saveAll(List.of(cse, ece, me));
                log.info("✅ Seeded 3 Departments with Academic Years & Sections");

                // Seed Department Logins (HOD Accounts)
                Role hodRole = roleRepository.findByName(RoleName.ROLE_HOD).orElseThrow();

                User cseUser = User.builder().username("cse_admin").email("cse_admin@college.edu").fullName("CSE HOD Administrator").password(passwordEncoder.encode("Admin@1234")).department(cse).isActive(true).build();
                cseUser.addRole(hodRole);

                User eceUser = User.builder().username("ece_admin").email("ece_admin@college.edu").fullName("ECE HOD Administrator").password(passwordEncoder.encode("Admin@1234")).department(ece).isActive(true).build();
                eceUser.addRole(hodRole);

                User meUser = User.builder().username("me_admin").email("me_admin@college.edu").fullName("ME HOD Administrator").password(passwordEncoder.encode("Admin@1234")).department(me).isActive(true).build();
                meUser.addRole(hodRole);

                userRepository.saveAll(List.of(cseUser, eceUser, meUser));
                log.info("✅ Seeded 3 Department Logins (cse_admin, ece_admin, me_admin / Admin@1234)");

                // Seed Faculty (Primary + Shared)
                Faculty f1 = Faculty.builder().employeeId("FAC001").firstName("Rajesh").lastName("Kumar").email("rajesh@college.edu").phone("9876543210").department(cse).teachingDepartments(String.valueOf(ece.getId())).designation("Professor").specialization("Algorithms").maxDailyHours(4).maxWeeklyHours(24).status("AVAILABLE").build();
                Faculty f2 = Faculty.builder().employeeId("FAC002").firstName("Priya").lastName("Nair").email("priya@college.edu").phone("9876543211").department(cse).teachingDepartments(String.valueOf(me.getId())).designation("Associate Professor").specialization("Database Systems").maxDailyHours(4).maxWeeklyHours(20).status("AVAILABLE").build();
                Faculty f3 = Faculty.builder().employeeId("FAC003").firstName("Anil").lastName("Deshmukh").email("anil@college.edu").phone("9876543212").department(ece).teachingDepartments(String.valueOf(cse.getId())).designation("Assistant Professor").specialization("VLSI Design").maxDailyHours(4).maxWeeklyHours(18).status("AVAILABLE").build();
                facultyRepository.saveAll(List.of(f1, f2, f3));
                log.info("✅ Seeded 3 Faculty members with Shared Department permissions");

                // Seed Classrooms
                Classroom r1 = Classroom.builder().roomNumber("CS-101").roomName("CSE Lecture Hall 1").building("Block A").department(cse).roomType("LECTURE_HALL").capacity(70).floor(1).status("AVAILABLE").build();
                Classroom r2 = Classroom.builder().roomNumber("CS-LAB1").roomName("Advanced Programming Lab").building("Block A").department(cse).roomType("LAB").capacity(40).floor(1).status("AVAILABLE").build();
                Classroom r3 = Classroom.builder().roomNumber("EC-201").roomName("ECE Seminar Hall").building("Block B").department(ece).roomType("SEMINAR_ROOM").capacity(120).floor(2).status("AVAILABLE").build();
                classroomRepository.saveAll(List.of(r1, r2, r3));
                log.info("✅ Seeded 3 Classrooms");

                // Seed Subjects
                AcademicYear year1 = cse.getAcademicYears().get(0);
                Section secA = year1.getSections().get(0);
                Subject s1 = Subject.builder().subjectCode("CS201").subjectName("Data Structures & Algorithms").department(cse).academicYear(year1).section(secA).assignedFaculty(f1).semester(3).credits(4).theoryHours(3).practicalHours(0).subjectType("THEORY").isActive(true).build();
                Subject s2 = Subject.builder().subjectCode("CS202").subjectName("Database Management Systems").department(cse).academicYear(year1).section(secA).assignedFaculty(f2).semester(3).credits(4).theoryHours(3).practicalHours(0).subjectType("THEORY").isActive(true).build();
                Subject s3 = Subject.builder().subjectCode("CS205L").subjectName("DBMS Lab").department(cse).academicYear(year1).section(secA).assignedFaculty(f2).semester(3).credits(2).theoryHours(0).practicalHours(3).subjectType("LAB").isActive(true).build();
                subjectRepository.saveAll(List.of(s1, s2, s3));
                log.info("✅ Seeded 3 Subjects");
            }
        };
    }

    private Department createDepartmentWithYears(String name, String hod, String email, String phone, String building) {
        Department dept = Department.builder()
            .name(name)
            .hodName(hod)
            .contactEmail(email)
            .contactPhone(phone)
            .building(building)
            .isArchived(false)
            .build();

        for (String yearLabel : List.of("1st Year", "2nd Year", "3rd Year", "4th Year")) {
            AcademicYear year = AcademicYear.builder().yearLabel(yearLabel).isEnabled(true).build();
            year.addSection(Section.builder().name("A").studentStrength(60).status("ACTIVE").build());
            year.addSection(Section.builder().name("B").studentStrength(60).status("ACTIVE").build());
            dept.addAcademicYear(year);
        }
        return dept;
    }
}

# Digital BE Project Log Book: Complete Flow and Master Prompt

Source: APCOE&R Project Diary, Record No. ACA/D/003B, Revision 00, DoI 01/02/2025.

Contents
- Part A: Complete flow (roles, lifecycle, state machines, who does what)
- Part B: Detailed module specification (fields, rules, seed data)
- Part C: Master prompt (paste into your AI agent)
- Part D: Open assumptions to confirm
- Part E: Paper-page UI (every screen looks like the PDF page)
- Part F: Build one feature at a time (priority order with a prompt for each)

---

# PART A: COMPLETE FLOW

## A1. Roles

| Role | Who | Core powers |
|---|---|---|
| STUDENT | Max 4 per group | Fill every logbook section, confirm activity entries, upload papers and certificates, view marks read-only |
| GUIDE | **Guide and Reviewer are the same person.** One faculty member per group, assigned by the HOD. (Optional external guide for sponsored projects signs the meeting log only.) | Verifies and countersigns activity entries, signs review forms, and is the only role that can enter marks, grades, remarks and topic scores for the assigned group. Can submit and approve group marks. |
| HOD | Head of Department | Assigns one guide per group, approves groups, approves topics, approves or unlocks marks, grants PDF permission, full read access, audit log |

## A2. Permission Matrix

| Action | Student | Guide (assigned to this group) | Guide (other group) | HOD |
|---|---|---|---|---|
| Edit group info, undertaking, topic text | Yes (own group) | No | No | View |
| Confirm activity entry | Yes | No | No | View |
| Verify activity entry | No | Yes | No | View |
| Enter or edit marks, grades, remarks, topic scores | No | Yes | No | No |
| Submit marks | No | Yes | No | No |
| Approve group marks | No | Yes | No | Yes |
| Unlock approved marks (reason required) | No | No | No | HOD |
| Approve or reject topic | No | Recommend | No | Yes |
| Assign guide to group | No | No | No | Yes |
| Toggle PDF permission | No | No | No | Yes |
| Generate final PDF | Yes, only if permission AND all sections complete | Same | No | Yes (same gate) |
| View marks | Read-only | Yes | No | Yes |

All checks are enforced on the server in every action, never only in the UI.

## A3. End-to-End Lifecycle

**Phase 0: Setup (HOD)**
1. HOD logs in and creates the **guide accounts** (each guide also acts as reviewer) (staff accounts are never self-registered). **Students create their own accounts** through the public Sign Up page (see Phase 1).
2. HOD defines academic year, Semester I and II schedule dates (Group Submission, Guide Allocation, Topic Finalization Review, Synopsis, Review 1, 2, 3, Final Term exam, Poster Competition, Report Verification, Final Submission, Term-II Exam).
3. HOD reviews groups **submitted by students**, approves them, then assigns **one guide (who is also the reviewer)** to each approved group. Four students maximum per group.

**Phase 1: Group Onboarding (Student)** (June)
4a. **Sign up (student self-registration):** the student enters full name, college email, roll number, mobile and password. The role is always STUDENT and is set by the server, never by the form. The student verifies the email through a link, then logs in.
4b. **Create or join a group:** a verified student with no group either (i) creates a group and becomes its creator, then invites up to 3 classmates by email or roll number, or (ii) accepts an invite or enters a group code. A student can belong to only one group, and the 5th member is rejected.
4c. **Submit group for approval:** the creator submits the group (group status SUBMITTED). The HOD approves it and assigns the guide (Phase 0, step 3). Until then the student can fill only the cover and member details. Activity charts, topics and reviews unlock once the group is ACTIVE.
4d. Student sees the dashboard stepper with completion percent.
5. Reads Rules and Regulations and ticks acknowledgement (each member).
6. Fills cover info: department, academic year, group no, project title, area of project (guide is shown read-only).
7. Fills member details: name, TE result, roll no, exam seat no, mobile, email, contribution, photo. Max 4 members.
8. Each member accepts the Undertaking digitally (timestamped).
9. June activity chart: Group Submission, Guide Allocation, Domain Finalization, three guide meetings for topic finalization.

**Phase 2: Topic Finalization** (June to July)
10. Student submits Proposed Topic 1 (title and description).
11. The guide scores Significance, Innovativeness, Scope, Feasibility (each out of 10) and recommends Yes or No.
12. HOD approves or rejects. If approved, the topic is locked and Topic 2 stays disabled.
13. If rejected, Topic 2 unlocks and goes through the same process.

**Phase 3: Term-I Work** (July to November)
14. Monthly activity charts: each planned activity gets a date, status (Complete or Incomplete), student confirmation, then guide verification.
15. Student uploads or writes Requirement Traceability Matrix and Project Cost Estimation.
16. Reviews, in order:
    - **Review I** (Problem Statement, Motivation, Objectives, Literature Review): 10 questions
    - **Review II** (Feasibility and Scope): 12 questions
    - **Final Review / Mock Term-I Evaluation** (Design): 17 questions plus the 50-mark evaluation table
17. For each review the guide fills remark and grade per question, writes Remark and Suggestions, saves Draft, then Submits. Submitting applies the guide's sign to every question automatically. The guide or HOD approves, which locks the marks. Because one person both signs activities and gives marks, the HOD approval step is the independent check.
18. External examiner feedback (Term-I, 9 questions) is recorded.
19. Term-I submission checklist is completed (synopsis, partial report, hard copies, project work file).
20. Competition participation and paper publication entries are added with certificates and paper files.

**Phase 4: Term-II Work** (December to May-June)
21. December: Stage 1 exam prep, feedback discussion, workstation setup, design corrections.
22. January to March: programming progress reports, test case writing, report softcopy, research paper, competition and paper publication.
23. Term-II reviews:
    - **Review I**: Modeling (13 questions)
    - **Review II**: Coding and Implementation (10 questions)
    - **Final Review / Mock Term-II**: Validation and Testing (9 questions), plus Report Writing review (9 questions)
24. May to June: hardcopy printing, CD making, final implementation check, final oral exam.
25. Final Evaluation of Project (out of 100) and External Examiner Feedback Term-II.
26. Term-II submission checklist is completed.

**Phase 5: Optional Sponsored Project Track**
27. If the group is flagged sponsored: internal and external guide meeting log (Sem 1 and 2) and the sponsor feedback form (7 parameters rated High, Medium or Low, company name, seal and signature).

**Phase 6: Closure and PDF**
28. System computes completion percent per section and overall.
29. When every mandatory section is complete, the HOD sees the group in "Ready for PDF".
30. HOD toggles **Allow PDF generation** for that group (this is a deliberate manual step).
31. Student or HOD clicks Generate PDF. The server re-checks: all sections complete AND permission true. Otherwise return 403 with a clear message listing what is missing.
32. PDF is generated in logbook order with the college header on every page, saved to storage, and the generation is logged.

## A4. State Machines

**Group**
`DRAFT (student creates, invites members) -> SUBMITTED (creator submits) -> ACTIVE (HOD approves, guide assigned) -> READY_FOR_PDF (all complete) -> PDF_ALLOWED (HOD toggle) -> PDF_GENERATED`
HOD may revoke permission at any time. Revoking sets the group back to READY_FOR_PDF.

**Topic Proposal**
`DRAFT -> SUBMITTED -> SCORED (guide) -> APPROVED | REJECTED (HOD)`
Topic 2 enabled only when Topic 1 is REJECTED. If Topic 1 is APPROVED, Topic 2 stays locked.

**Activity Entry**
`PLANNED -> STUDENT_CONFIRMED (status + timestamp) -> GUIDE_VERIFIED (timestamp)`
Edits after GUIDE_VERIFIED reset it to STUDENT_CONFIRMED and require a fresh guide countersign (kept in history).

**Review Form and Marks Sheet**
`DRAFT (guide editing) -> SUBMITTED (guide) -> APPROVED (guide or HOD, locked)`
`APPROVED -> UNLOCKED (HOD only, reason mandatory) -> DRAFT`
Every transition writes to the audit log.

**Competition Eligibility**
Zero competition entries means the group is flagged "Not eligible for final exam". It clears automatically when an entry is added.

**PDF Gate**
`canGeneratePdf = pdfPermission === true AND allSectionsComplete === true`

## A5. Completion Rules (what "complete" means)

| Section | Complete when |
|---|---|
| Cover and group info | Title, area, academic year, guide present, at least 1 member with all fields and photo |
| Rules acknowledgement | Every member has acknowledged |
| Undertaking | Every member has accepted |
| Topic | One topic APPROVED |
| Activity charts | Every planned row is COMPLETE and GUIDE_VERIFIED |
| RTM and Cost Estimation | Content or file present |
| Term-I reviews (R1, R2, Final) | All APPROVED |
| Term-II reviews (R1, R2, Final, Report) | All APPROVED |
| Mock evaluation (50) and Final evaluation (100) | APPROVED for every member |
| External examiner feedback Term-I and II | Saved |
| Checklists Term-I and II | All items ticked |
| Competition | At least 1 entry |
| Paper publication | At least 1 entry |
| Sponsored sections | Complete only if group is sponsored |

## A6. Notifications

| Event | Notify |
|---|---|
| Group assigned a guide | Students, guide |
| Activity entry confirmed by student | Guide |
| Guide verified or rejected an entry | Student |
| Topic scored by guide | HOD |
| Topic approved or rejected | Students |
| Review submitted by guide | HOD |
| Marks approved or unlocked | Students, guide |
| Group ready for PDF | HOD |
| PDF permission granted or revoked | Students |

---

# PART B: DETAILED MODULE SPECIFICATION

## B1. Pages (route map)

```
/login
/signup                       student self-registration (public)
/verify-email                 email verification link target
/forgot-password and /reset-password
/student/group                create group, invite members, join by code, submit for approval
/student                      dashboard + stepper + completion %
/student/cover                cover info
/student/rules                rules and regulations + acknowledgement
/student/members              group information (max 4)
/student/undertaking
/student/schedule             read-only
/student/topics               topic 1 and topic 2
/student/activity/[month]     june ... may-june
/student/rtm                  requirement traceability matrix
/student/cost                 project cost estimation
/student/reviews              read-only reviews and marks
/student/examiner-feedback    read-only
/student/competitions
/student/papers
/student/sponsored            only when sponsored
/student/checklists
/student/notes
/student/pdf                  status gate + download

/guide                        assigned groups + pending verifications and reviews
/guide/groups/[id]/activity   verify entries
/guide/groups/[id]/topic      score topic
/guide/groups/[id]/review/[type]
/guide/groups/[id]/mock-evaluation
/guide/groups/[id]/final-evaluation
/guide/groups/[id]/examiner-feedback

/hod                          all groups dashboard
/hod/users                    create and edit users
/hod/assignments              assign guide to groups
/hod/schedule                 edit schedule dates
/hod/approvals                topics, marks, unlock
/hod/pdf-permissions          toggle per group
/hod/audit                    audit log with filters
```

## B2. Cover Page Fields
Department of ______ Engineering, BE Project Log Book A.Y. ______, Project Title (2 lines), Area of Project, Project Guide, Group No.

## B3. Project Group Information (per member, up to 4)
Name, TE Result, Roll No, Mobile No, Exam Seat No, Email ID, Contribution (2 lines), Photo.
Validation: mobile 10 digits, email format, roll and exam seat unique, photo JPG or PNG under 2 MB.

## B4. Undertaking
Text: students of B.E. ______ batch ______ assure they will follow all rules and regulations of the BE project activity assigned by Savitribai Phule Pune University for academic year ______. The project entitled ______ will be fully designed and developed by them. Any part of the hardware and software will not be purchased from outside parties for direct use. If found by the examiner, they are responsible for the consequences.
Signature table with up to 5 rows. Digital version: each member clicks Accept, stored as name plus timestamp.

## B5. Schedule (HOD editable dates)
Semester I: Group Submission, Guide Allocation List, Topic Finalization Review, Synopsis/Abstract submission, Review-1, Review-2, Review-3, Final Term 1 Exam (as per university schedule).
Semester II: Review-1, Review-2, Review-3, BE Project Poster Competition / Paper Presentation, Verification of project report by Project Guide, Final Submission of Project report and Final Review, Final Project Term-II Examination.

## B6. Topic Finalization
Per topic (1 and 2): title (4 lines), Significance/Applicability (0 to 10), Innovativeness (0 to 10), Scope (0 to 10), Feasibility (0 to 10), Approved (Yes/No).
Sign-offs in the paper form: Reviewer 1, Reviewer 2, Project Coordinator, HOD. Digital: assigned guide (reviewer), optional second faculty reviewer, optional coordinator, HOD final approval.
Rule: if Topic 1 is rejected, Topic 2 is considered with the same process. Do not fill Topic 2 if Topic 1 is selected.

## B7. Activity Chart Templates (pre-seeded, columns: Date, Activity Planned, Complete/Incomplete, Signature of student, Signature of internal/external guide)

- **June:** Group Submission; Guide Allocation; Domain Finalization; Guide Meetings for Topic Finalization (x3)
- **July:** Literature Review (review papers, create surveys for real-time application, meet stakeholders); Feasibility Study of Topic, Cost estimation, generate IDEA Matrix, generate Requirement Traceability Matrix; Project Topic Finalization Review; Synopsis Writing and Submission, Review 1 presentation preparation; Sponsorship details and work; Review-1
- **Activity page: Requirement Traceability Matrix** (free content page)
- **August:** Review 1 discussions on suggestions; Design and understand software process model for project; Draw and verify UML (Use Case, Class, Activity, Component diagrams); Draw and verify Sequence, State, ER diagram and Review 2 presentation preparation; Review-2
- **Activity page: Project Cost Estimation** (free content page)
- **September:** Generating Mathematical Model; Test Cases writing; Testing of UML Reliability; Writing paper on design phase (review paper); Cost Estimation using Estimate or Simplest mate; Report Semester 1 writing in LaTeX/Word; Review-3 (Final Review)
- **October:** Refinement of Review 3 presentation based on suggestions; Refinement of Semester 1 report based on suggestions
- **November:** Revising suggestions and completing them for final Semester 1 exam; Discussion with guide regarding presentation technique for final exam; Semester 1 report printing
- **December:** Preparation of Stage 1 examination; Till Stage 1 Examination; Stage 1 Final Presentation; Discussion with guide regarding suggestions in Stage 1 exam and external comments; Installation and setup of workstations; Review of design and corrective actions from Semester 1 feedback
- **January:** Actual programming start; Programming progress report (write necessary markers achieved) x3; Review-1
- **February:** Programming progress report (as per review discussions); Programming progress report x2; Review-2
- **March:** Test cases writing; Programming progress report; Softcopy of report and research paper on results; Project competition and paper publication; Review-3
- **May-June:** Hardcopy printing of report; CD making; Final implementation check; Final Project Oral Examination

## B8. Review Question Sets (seed these exactly; each row has Remark, Grade, Sign of Guide)

**TERM-I REVIEW I (Problem Statement, Motivation, Objectives and Literature Review), 10 questions**
1. Does the statement give clear identification about what your project will accomplish?
2. Is the statement short and concise?
3. Can a person who is not familiar with the project understand the scope of the project by reading the problem statement?
4. The project's objectives of study (what product, process, resource etc.) are being addressed?
5. Is similar type of methodology / model used for existing work?
6. Is the studied literature sufficient to decide the scope of the project?
7. Are the objectives set going to help achieve the goal of the project?
8. Does the research gap identified lead to find the motivation of the project?
9. Does your project contribute to our society by any means and lead to find motivation?
10. Are the objectives clearly and unambiguously listed?

**TERM-I REVIEW II (Feasibility and Scope), 12 questions**
1. Is the project's viewpoint understood?
2. Is the project goal statement in alignment with the sponsoring organization's business goal and mission?
3. Who is the project's end user?
4. What is the projected cost of producing a product?
5. Is the project achievable in the specified (Time, Cost, Budget)?
6. Are the requirements within the scope of the project?
7. Is the scope properly defined?
8. Does the problem statement clearly define the scope of the project?
9. Do the project requirements fit into available software and hardware?
10. Whether the milestones are stated completely and project timeline is given?
11. Whether risks like technical, operational, schedule and business risks are identified correctly or not?
12. Whether risk prioritization is done properly or not and any backup plan is there or not?

**TERM-I MOCK EVALUATION / FINAL REVIEW (Design), 17 questions**
1. Are requirements reflected in the system architecture?
2. Does the design support both project (product) and project goals?
3. Does the design address all the issues from the requirement?
4. Is effective modularity achieved and are modules functionally independent?
5. Are structural diagrams (class, object, etc.) well defined?
6. Are all class associations clearly defined and understood? (Is it clear which classes provide which services?)
7. Are the classes in the class diagram clear? (What they represent in the architecture design document?)
8. Is inheritance appropriately used?
9. Are the multiplicities in the use case diagram depicted in the class diagram?
10. Are all objects used in the sequence diagram?
11. Are the symbols used in all diagrams corresponding to UML standards?
12. Are behavioral diagrams (use case, sequence, activity, etc.) well defined and understood?
13. Does each case have clearly defined actors and input/output?
14. Does the sequence diagram match with the class diagram?
15. Is aggregation / containment (used) clearly defined and understood?
16. Whether State charts are capturing the system's dynamic behavior correctly or not?
17. Related to procedural thinking, whether DFDs and CFDs along with transaction and transformation flow are done correctly or not?

**TERM-II REVIEW I (Modeling: Model Refinement and Algorithm Development), 13 questions**
1. Which software development process model is used? (Waterfall, Incremental, RAD) How?
2. Do you clearly identify data objects, their attributes and relationships? (All constraints from SRS captured or not?)
3. Have you clearly matched the objects with respective classes and their responsibilities?
4. Have you analyzed the requirements and represented them into respective models?
5. Can you differentiate between different system states and depict them in the form of a state transition diagram?
6. Does the mathematical model clearly imply the design of the project?
7. Does the mathematical model clearly state the goal of the project?
8. Does the interface between the modules properly identified?
9. Are any functional dependencies identified and described?
10. Which architectural model does your system support?
11. Whether the Deployment diagram is in line with the selected architecture?
12. Whether all components are designed properly and represented in the component diagram?
13. Whether NP-completeness of algorithms is checked or not?

**TERM-II REVIEW II (Coding / Implementation), 10 questions** (columns: Date, Remark/Grade, Sign of Guide)
1. Does the code completely and correctly implement the design?
2. Does the code comply with the coding standard?
3. Is the code well structured, consistent in style and consistently formatted?
4. Are all functions in the design coded?
5. Does the code make use of object oriented concepts?
6. Does the code support granularity?
7. Is the language used for coding correctly chosen as per the project need?
8. If any off-the-shelf components are used, have you understood the functionalities of using it?
9. Are all comments consistent with the code?
10. Whether code optimization is done properly or not? (By using language features)

**TERM-II MOCK / FINAL REVIEW (Validation and Testing), 9 questions**
1. Have you done alpha testing?
2. Have you done beta testing?
3. Have you validated the requirements, design and code as per standard?
4. Have you performed GUI testing of the project? How?
5. Does your system comply with basic usability norms?
6. Have you tested the code using standard datasets available in your area of project?
7. Have you tested the code in a real time environment?
8. After integration of all components, whether total performance of the system is checked or not?
9. Whether the repository of all components along with versions is documented or not?

**TERM-II REPORT WRITING REVIEW, 9 questions**
1. Is the report written as per the prescribed format?
2. Is the report timely prepared?
3. Is the report properly organized, spelled and grammatically correct?
4. Is the report plagiarism free?
5. Is the report precise and written to the point?
6. Does the report contain complete results and comparative graphs?
7. Are all figures and tables properly numbered and labeled?
8. Are all figures and tables properly cited?
9. Whether references are properly cited?

Each form also has: Remark and Suggestions (long text) and Name and Sign of Reviewers (the guide, optional second faculty reviewer).

## B9. Mark Sheets

**Term-I Mock Evaluation: Final Review (total 50), per student row**
| Column | Max |
|---|---|
| Problem Statement / Motivation / Objectives / Scope / Feasibility / Requirement | 5 |
| Literature Survey | 5 |
| Requirement Analysis | 5 |
| Modeling and Designing | 10 |
| Planning and Prototyping | 5 |
| Presentation and Question-Answer | 10 |
| Partial Project Report | 10 |
| **Total** | **50** (auto-computed) |
Note: the paper form shows "Requirement Analysis (05), Modeling and Designing (10)" in one column. Split them into two fields so the total stays 50.

**Term-II Final Evaluation of Project (total 100), per student row**
| Column | Max |
|---|---|
| Modeling | 10 |
| Coding and Implementation | 40 |
| Testing | 10 |
| Understanding, Individual Involvement / Contribution in the project | 10 |
| Team Work | 10 |
| Demonstration cum Presentation | 10 |
| Documents and Report | 10 |
| **Total** | **100** (auto-computed) |

Validation: each cell cannot exceed its max, total is computed on the server, rows exist only for members of that group. "Refer Rubrics for Details": provide a rubric link or text area per column.
Committee sign: two professors (name and timestamp).

## B10. External Examiner Feedback (Term-I and Term-II, identical questions)
Project title, date. Each rated Excellent, Good or Satisfactory:
1. Apply knowledge of mathematics and engineering to identify, formulate and solve complex problems through project work
2. Ability to design a system, analyze and interpret data to meet desired needs within realistic constraints
3. Ability to innovatively think, visualize and function on multidisciplinary areas
4. Understanding of professional and ethical responsibility
5. Ability to communicate effectively in verbal and written form
6. Understanding the impact of engineering solutions in a global, economic, environmental and societal context
7. Understanding of project management and team work
8. Ability to use modern engineering tools along with knowledge of contemporary issues
9. Ability to recognize the need of engaging in life-long learning
Remarks, external signature, internal signature.

## B11. Submission Checklists

**Term-I**
1. Each group submits hard copy and soft copy of synopsis.
2. All groups complete the partial project report as per prescribed format.
3. Prepare soft copy of partial report, get it checked by the internal guide, then print hardcopy.
4. Hard copy of partial report in spiral bound form: 1 copy for department plus each group member copy.
5. Submit the Project Work file containing Term-I Project Laboratory assignments to the guide.

**Term-II**
1. Complete the project in all respect (hardware and software) in the stipulated time.
2. Prepare soft copy of project report, get it checked by internal guide, then print hardcopy.
3. Hard copy in hardbound form: 2 copies for the department plus each member copy.
4. Prepare the project CD containing: complete demo, final project report, readme for execution, PPT of final presentation, software code, paper presented/published, scan copy of certificates, scan copy of sponsorship and completion letter (if applicable), two-page synopsis in given format for the project manual.
5. Submit the Project Work file containing Term-II Project Laboratory assignments.
6. Submit hardcopy of report, CD and Project Work file as final submission.
7. Submit Xerox copies of certificates and hard copy of the paper presented.
8. Submit the 2-page synopsis checked by the Project Coordinator for the department project manual.
Note: changes in submission will be informed by notice.

## B12. Competition and Papers
**Participation in Project Competition:** Sr No, Name of Project Competition, Date, Name of College and level, Type of participation (Poster / Demo / Paper Presentation), Award / Participation, certificate upload.
**Paper Publication / Presentation:** Sr No, Title of Paper, Name of Conference, ISSN No, Vol No and issue, Page no, paper file upload.
Rule from logbook: at least one technical paper (IITs, Central Universities, UoP conferences or equivalent IEEE/ACM sponsored international conferences) and at least one project competition are required. No competition means flagged ineligible for the final exam.

## B13. Sponsored Project
**Meeting log (Semester 1 and Semester 2):** Sr No, Date, Summary of key events since last review, Summary of key events before next review, Student sign, Project Guide signature, External Guide signature.
**Sponsored Project Feedback:** rate High, Medium or Low on: 1 Ability to apply subject knowledge; 2 Ability to formulate, design and analyze the problem; 3 Ability to learn advanced technology (hardware/software tools); 4 Communication skills; 5 Ability to work in a team; 6 Professional / ethical attitude; 7 Multidisciplinary aspect. Name of sponsored company, seal and signature of reporting authority (upload scan).

## B14. Notes
Free text notes per group (many entries).

## B15. Rules and Regulations (static text, show with acknowledgement)
1. All students must enter the correct information in the log book.
2. All entries must be verified by the concerned project guide.
3. Students must report to their guide on project day as per the time table.
4. Planned activity should be completed as per the schedule only.
5. Submit soft and hard copies of Synopsis, Partial Project Report in Term-I and Final Project Report in Term-II in the prescribed format.
6. Submit Project Laboratory Assignments in Term-I and Term-II as per syllabus.
7. Submit and preferably publish at least one technical paper in conferences/workshops in IITs, Central Universities or UoP conferences or equivalent international conferences sponsored by IEEE/ACM in Term-I and Term-II.
8. Participate in at least one project competition organized by any engineering college to become eligible for the final project exam.
9. Attach all published papers and competition certificates at the end of the log book.
10. Bring the log book at the time of meeting with guide, project reviews and examination.
11. Changes, if any, must be countersigned by the concerned project guide.
12. For queries, contact your project guide or project coordinator.
13. Log book must be submitted to the Coordinator at the time of final submission.

## B16. Data Model (Prisma outline)

```
User(id, name, email, rollNo, mobile, role[STUDENT|GUIDE|HOD], passwordHash,
     emailVerifiedAt, active, createdVia[SELF_SIGNUP|HOD_CREATED])
EmailVerificationToken(id, userId, tokenHash, expiresAt, usedAt)
PasswordResetToken(id, userId, tokenHash, expiresAt, usedAt)
GroupInvite(id, groupId, invitedEmail, invitedRollNo, code, status[PENDING|ACCEPTED|DECLINED|EXPIRED],
            createdById, expiresAt)
Group(id, groupNo, academicYear, department, projectTitle, area, guideId,
      isSponsored, pdfPermission, pdfPermissionBy, pdfPermissionAt, status)
GroupMember(id, groupId, userId, name, teResult, rollNo, examSeatNo, mobile, email,
            contribution, photoUrl, rulesAckAt, undertakingAcceptedAt)
TopicProposal(id, groupId, topicNo, title, description, significance, innovativeness,
              scope, feasibility, guideRecommendation, status, approvedById, approvedAt, rejectReason)
ScheduleItem(id, term, sortOrder, description, date, note)
ActivityTemplate(id, month, sortOrder, text)
ActivityEntry(id, groupId, templateId, month, date, status, studentConfirmedAt, studentConfirmedById,
              guideVerifiedAt, guideVerifiedById, version)
ActivityEntryHistory(id, entryId, snapshot JSON, changedAt, changedById)
ContentPage(id, groupId, type[RTM|COST|NOTE], richText, fileUrl)
ReviewTemplate(id, term, reviewType, title, order)
ReviewQuestion(id, templateId, questionNo, text)
ReviewForm(id, groupId, templateId, remarkAndSuggestions, guideId, status,
           submittedAt, approvedById, approvedAt, unlockReason)
ReviewScore(id, formId, questionId, remark, grade, guideSignedAt, guideSignedById)
MarksSheet(id, groupId, memberId, kind[MOCK_T1|FINAL_T2], components JSON, total,
           status, guideId, approvedById, approvedAt, unlockReason)
ExaminerFeedback(id, groupId, term, answers JSON, remarks, externalName, signedAt)
Checklist(id, groupId, term, items JSON)
Competition(id, groupId, name, date, collegeAndLevel, type, award, certificateUrl)
PaperPublication(id, groupId, title, conference, issn, volIssue, pageNo, fileUrl)
SponsoredMeeting(id, groupId, semester, date, summaryPrev, summaryNext,
                 studentSignedAt, guideSignedAt, externalGuideSignedAt)
SponsorFeedback(id, groupId, company, ratings JSON, sealUrl, signedAt)
PdfExport(id, groupId, generatedById, generatedAt, fileUrl)
Notification(id, userId, type, message, readAt)
AuditLog(id, userId, action, entity, entityId, before JSON, after JSON, timestamp)
```

---

# PART C: MASTER PROMPT

See AGENTS.md ("MASTER PROMPT (Part C)") — kept there so the agent always follows it.

---

# PART D: ASSUMPTIONS TO CONFIRM

1. **Guide and reviewer are the same person.** One faculty member per group verifies activities and gives marks. Because of this, the HOD approval step is the independent check on marks.
2. **One guide per group.** The paper topic form has two reviewer signatures, so this prompt treats a second faculty reviewer as optional.
3. **E-signature is a confirmation click** (name and timestamp), not an uploaded signature image. The sponsor seal is the one exception and is uploaded.
4. **Who clicks Generate PDF:** the student or the HOD, once permission is granted.
5. **Mock Term-I columns:** requirement analysis (5) and modeling and designing (10) are split into two fields so the total stays 50.
6. **Project Coordinator:** the paper form has a coordinator sign. Add it as an optional fifth role, or let the HOD cover it.
8. **Student sign-up is open, staff sign-up is not.** Students self-register; guides and the HOD are created by the HOD. Confirm whether sign-up should be limited to your college email domain, which I recommend so outsiders cannot register.
9. **Group formation:** one student creates the group and invites the others, and the HOD approves it. If you prefer each student to sign up and the HOD to form groups, that is a small change.
7. **Month names:** activity charts follow the paper logbook (no April tab, May-June combined). Change if your calendar differs.

---

# PART E: PAPER-PAGE UI (screens that look exactly like the PDF pages)

The goal: every screen is an **A4 sheet** that looks like the printed logbook page, with the same college header, fonts, borders and blank lines. Students fill the page in place. The same sheet components are used for the on-screen UI and the PDF export, so what the user sees is what gets printed.

## E1. Core Idea

- One React component per logbook page, called a **Sheet**. Example: `CoverSheet`, `RulesSheet`, `MembersSheet`, `ActivityChartSheet`.
- Each Sheet renders inside a shared `<PaperPage>` wrapper (white A4 sheet, fixed size, drop shadow, centered on a grey desk background).
- The PDF route renders the **same Sheets** with `?print=1`, so there is no second template to maintain.
- Fields are drawn as the original blanks: an underline that turns into an input when editable, and into plain printed text when read-only or locked.

## E2. The PaperPage Wrapper

| Property | Value |
|---|---|
| Size | A4: 210 mm x 297 mm (794 x 1123 px at 96 dpi) |
| Inner margins | About 15 mm sides, 12 mm top and bottom |
| Background | White sheet on a light grey page background, soft shadow |
| Print CSS | `@page { size: A4; margin: 0 }`, `break-after: page`, `print-color-adjust: exact` |
| On small screens | Scale the sheet to fit the width with CSS `transform: scale()`, with pinch-zoom and horizontal pan. Never reflow the layout. |
| Overflow | If a section is longer than one sheet (activity rows, many notes), continue on a "Page 2 of 2" sheet with the header repeated. |
| Page number | Small page number at the bottom centre (screen and PDF) |

## E3. Repeated College Header (top of every sheet)

Reproduce the table exactly:

```
+---------+-----------------------------------------------+---------+
|         |  Akhil Bharatiya Maratha Shikshan Parishad's   |         |
|  LOGO   |  Anantrao Pawar College of Engineering &       |  LOGO   |
| (college)|  Research                                     | (APCOE&R|
|         +-------------------------+---------------------+  founder)|
|         | Record No.: ACA/D/003B  | DoI: 01/02/2025      |         |
|         | Revision: 00            |                     |         |
+---------+-------------------------+---------------------+---------+
|            Project Diary  (full-width light grey bar, bold, centred)|
+--------------------------------------------------------------------+
```

- Thin black borders, 1 px.
- Title text bold, dark grey, serif; "Record No.:", "Revision:" and "DoI:" labels bold, values regular.
- Left logo in a narrow cell, right portrait logo in a narrow cell, both spanning both rows.
- The "Project Diary" bar is a full-width row with a light grey fill (#d9d9d9) and bold centred text.
- Store logos as static assets in `/public/logos/` (the user provides the two image files).

## E4. Typography and Visual Style (match the printed pages)

| Element | Style |
|---|---|
| Body text, labels, table cells | Serif, Times New Roman (fallback `Liberation Serif`, `serif`), 11 to 12 pt |
| Section titles ("Activity Chart: June", "Project Group Information") | Sans-serif bold, Arial (fallback `Liberation Sans`), about 16 pt, centred |
| Table headers | Serif bold |
| Tables | Thin black 1 px borders, no rounded corners, no zebra stripes, same column widths as the original |
| Blank lines "_______" | 1 px bottom border, inline input with transparent background, no input box border |
| Checkbox items | Simple square boxes drawn in black |
| Colour | Black ink on white. The only colours are on the cover page and the grey bars. |
| Fonts | Self-host via `next/font` so screen and PDF match. No shadcn-style cards inside a sheet. |

Keep shadcn/ui only **outside** the sheets (login, dashboards, toasts, dialogs, side navigation).

## E5. Page-by-Page Sheet List (same order as the PDF)

1. **Cover:** "Department of ______ Engineering", red bold "BE PROJECT LOG BOOK A.Y. ______" in a soft green-grey gradient banner, college building photo (static asset), teal rounded box with Project Title (2 lines), Area of Project, Project Guide, and a grey-green rounded box with Group No.
2. **Rules and Regulations:** boxed list of the 13 rules, plus an "I have read and understood" tick for each member (the digital addition, printed as a small line under the box).
3. **Project Group Information, Members 1 and 2:** Name, TE Result, photo box ("Affix your photo here", grey gradient square, becomes an upload area showing the photo), Roll No, Mobile No, Exam Seat No, Email ID, Contribution (2 lines).
4. **Members 3 and 4:** same layout.
5. **Undertaking by Students:** paragraph with blanks, project title lines, signature table (5 rows, Name and Signature columns). Signature cell shows "Accepted <date time>".
6. **B.E. Project Schedule, Semester I and II:** two tables (Sr. No, Description, Dates). HOD edits the date cells. "Any changes in schedule will be informed from time to time by notice." in bold italic.
7. **Finalization of Project Topic, Topic 1:** 4 blank lines, parameters table (Significance/Applicability, Innovativeness, Scope, Feasibility each out of 10, Approved Yes/No), Name and Signature of Reviewer 1, Reviewer 2, Project Coordinator, Head of Department, italic footnote about Topic 2.
8. **Topic 2:** same layout.
9. **Activity Chart: June** (and each other month): table with Date, Activity Planned, Complete/Incomplete, Signature of student, Signature of internal/external guide. Pre-seeded planned text. Tall rows as in the original.
10. **Activity Chart: July, then RTM page, August, Project Cost Estimation pages, September, October + November on one sheet, December, January, February, March + May-June on one sheet.** Combine months on one sheet exactly where the PDF does.
11. **Activity: Requirement Traceability Matrix** and **Activity: Project Cost Estimation:** blank sheets with the title only. Students type rich text, or drop an image or file that fills the sheet. Add more sheets as needed.
12. **BE Project (Term-I) Review I, Review II, Mock Final Review (Design):** intro text, question table (Sr. No, Question, Remark, Grade, Sign of Guide), Remark and Suggestions box, Name and Sign of Reviewers 1 and 2 (the guide, plus the optional second faculty reviewer).
13. **BE Project Mock (Term-I) Evaluation: Final Review table (out of 50):** per-student rows, rubric column headers exactly as printed, "Refer Rubrics for Details", Name and Signature of Evaluation Committee (two professors).
14. **Term-I Submission Check List:** boxed numbered list, each with a tick box.
15. **External Examiner Feedback (Term-I):** Project Title, Date, Q1 to Q9 with Excellent / Good / Satisfactory tick cells, Remarks, Signature (External) and (Internal).
16. **Participation in Project Competition and Paper Publication / Presentation:** both tables on one sheet, note "(Attach photocopy of paper & certificate/s)", with upload buttons beside each row.
17. **BE Project (Term-II) Review I (Modeling), Review II (Coding, with Date column), Mock Final (Validation and Testing, with Date column), Report Writing.**
18. **Final Evaluation of Project (out of 100) table**, **External Examiner Feedback (Term-II)**, **Term-II Submission Check List** (with the CD contents sub-list).
19. **Sponsored Project:** the internal/external guide meeting tables for Semester 1 and Semester 2 on one sheet, then the Sponsored Project Feedback sheet (High / Medium / Low), company name, seal and signature.
20. **Competition and Paper tables (Term-II)** and the final **NOTES** sheet with ruled lines.

Pages that have only the header in the original (blank continuation pages) are not rendered unless content flows onto them.

## E6. Behaviour Inside a Sheet

| State | What the user sees |
|---|---|
| Editable | Underlines become inputs on hover and focus (light blue underline). Tab moves field to field. Autosave per field with a small "Saved" tick outside the sheet. |
| Read-only | Plain printed text, no input styling. Used for other roles and for locked data. |
| Locked (approved marks, verified entries) | Printed text plus a small lock icon outside the sheet margin. |
| Signature cell | Student or guide clicks "Sign". The cell then shows the name and timestamp in a small italic script-style serif. This is the e-signature. |
| Marks cells | Look like blank table cells. Only the assigned guide sees them as editable. Everyone else sees printed values. |
| Missing required | Subtle red dotted underline on the blank, summarised in the side panel. |
| Disabled sheet (for example Topic 2 while Topic 1 is open) | Sheet shown with a light grey "Not available" overlay and the reason. |
| Group not yet ACTIVE | Later sheets are visible but locked, with the message "Available after the HOD approves your group." |

## E7. Navigation Around the Paper

- **Left panel:** thumbnail list of all sheets in logbook order, each with a completion dot (empty, half, full), the same as a PDF viewer's page strip.
- **Top bar:** page number "Page 9 of 40", previous and next, zoom (fit width, 100%, 125%), jump-to-section dropdown, "Save status", and the PDF button.
- **Right panel (collapsible):** checklist of missing items for the current sheet, comments, and audit trail for the sheet.
- **Keyboard:** Page Up and Page Down to move between sheets.
- Logged-in role decides what appears: students see their own group, the guide sees assigned groups with a group switcher, the HOD sees all groups with a group switcher and a read-only sheet view.

## E8. PDF Equivalence Rules

1. The PDF export loads `/print/[groupId]` which renders **all Sheets in order** with `print=1` (no inputs, no side panels, no shadows).
2. Puppeteer settings: `format: "A4"`, `printBackground: true`, `preferCSSPageSize: true`, margins 0, wait for fonts and images.
3. Every Sheet has `break-inside: avoid` on table rows and `break-after: page` on the sheet.
4. A visual regression test (Playwright screenshot of each Sheet on screen versus print) must pass, to keep the screen and PDF identical.
5. Photos, uploaded certificates and papers are listed on the sheet where they belong. Uploaded papers and certificates are appended at the end of the PDF, as Rule 9 of the logbook requires.

## E9. Prompt Block

See AGENTS.md ("PAPER-PAGE UI REQUIREMENT").

## E10. What You Need to Provide

- The two logo images (college crest and the portrait logo) as PNG or SVG.
- The college building photo from the cover page.
- Confirmation of the original fonts if they are not Times New Roman and Arial.
- Optional: the original Word or DOCX of the logbook, which gives exact column widths and spacing.

---

# PART F: BUILD ONE FEATURE AT A TIME (priority order with a prompt for each)

## F0. How to Use This Part

1. Paste the **Master Prompt (Part C)** and the **Paper-Page UI block (E9)** into your AI agent once, at the start of the session. Put them in `AGENTS.md` so the agent keeps them.
2. Then paste **one feature prompt below**, in order. Do not start the next one until "Done when" is true and the code is committed.
3. After each feature, run the app, test with demo users, commit, and start the next feature in a fresh chat if the context gets long.
4. Roles are STUDENT, GUIDE (also the reviewer) and HOD.

## F1. Priority Table

| Priority | Feature | Why this order | Depends on |
|---|---|---|---|
| P0 | **F1** Project setup, schema, paper-page shell | Everything else sits on it | none |
| P0 | **F2** Auth: student sign-up, login, roles, permissions, audit | Nothing works without users and roles | F1 |
| P0 | **F3** HOD: create guides, approve groups, assign guide | Needed before groups can go active | F2 |
| P1 | **F4** Group creation, invites, submit for approval | Starts the student flow | F2, F3 |
| P1 | **F5** Cover sheet and Group Information sheets | First real logbook pages | F1, F4 |
| P1 | **F6** Rules and Undertaking sheets | Simple, needed for completion | F5 |
| P1 | **F7** Schedule sheet | Small, HOD-edited | F3 |
| P1 | **F8** Topic Finalization (2 sheets) | First guide scoring and HOD approval | F5 |
| P2 | **F9** Activity charts (all months) | Largest student workload, two-step sign | F5 |
| P2 | **F10** Term-I Reviews and marks workflow | Core business rules | F8 |
| P2 | **F11** Mock Evaluation (50) and Examiner Feedback Term-I | Uses the marks workflow | F10 |
| P3 | **F12** Competitions, papers, checklists, RTM, cost, notes | Independent records | F5 |
| P3 | **F13** Term-II Reviews, Final Evaluation (100), Examiner Feedback Term-II | Reuses F10 and F11 | F11 |
| P3 | **F14** Sponsored project sheets | Optional, only sponsored groups | F5 |
| P4 | **F15** Completion engine and dashboards | Needs all sections to exist | F5 to F14 |
| P4 | **F16** PDF export with HOD permission gate | Needs everything and the dashboards | F15 |
| P4 | **F17** Notifications, tests, polish, deployment | Final layer | all |

**Minimum demo (shows the idea fastest):** F1 to F8, then F10. That gives sign-up, group approval, cover, members, topic scoring and the marks workflow.

## F2. Feature Prompts

### F1: Project setup, schema and paper-page shell
```
FEATURE F1 ONLY. Do not build any other feature.
Scaffold Next.js 14 (App Router, TypeScript strict), Tailwind, shadcn/ui, Prisma
+ PostgreSQL, ESLint/Prettier. Create the full Prisma schema from the data model in
Part B16 (roles STUDENT, GUIDE, HOD) and run the first migration.
Build the paper-page foundation from Part E:
- <PaperPage> A4 wrapper, <CollegeHeader> (logo placeholders, title, Record No.
  ACA/D/003B, Revision 00, DoI 01/02/2025, grey "Project Diary" bar)
- Fonts: serif body, sans-serif bold titles, loaded via next/font
- Primitives: <Field> (underline input that prints as text when read-only),
  <SignCell> ("Sign" button, then "Signed by <name> on <timestamp>"),
  <MarksCell>, <PaperTable>, <TickBox>
- Viewer shell: left thumbnail list, top bar (page x of y, prev/next, zoom), scale
  to fit on mobile
- A demo page /demo/paper showing one sample sheet and its print view (?print=1)
Done when: /demo/paper looks like a printed logbook page on screen and in
Print Preview, and the migration runs.
```

### F2: Auth, student sign-up, roles, permissions, audit
(see spec text — FEATURE F2 ONLY ... Done when: all three roles can log in and land on their own empty dashboard.)

### F3: HOD admin: guides, group approval, assignment
Done when: the HOD can approve a group and assign a guide, and the audit log shows it.

### F4: Group creation, invites, submit for approval (student)
Tests: 5th member rejected, student cannot join two groups, non-creator cannot submit.
Done when: four student accounts can form a group and see the HOD approve it.

### F5–F17
See the full feature prompts in the original document (kept in the conversation/AGENTS.md).

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canViewGroup, requireUser } from "@/lib/permissions";
import { homeForRole } from "@/lib/roles";
import { ACTIVITY_MONTHS, type ActivityMonth } from "@/lib/constants";
import { getSchedule } from "@/lib/services/schedule";
import { getTopicSheet } from "@/lib/services/topic";
import { getMonthChart } from "@/lib/services/activity-chart";
import { getChecklist, getContentPage, listCompetitions, listNotes, listPapers } from "@/lib/services/records";
import { getReviewSheet } from "@/lib/services/review";
import { getMockSheet } from "@/lib/services/mock";
import { getFinalSheet } from "@/lib/services/final";
import { getExaminerSheet } from "@/lib/services/examiner";
import { getSponsoredSheet } from "@/lib/services/sponsored";
import { CoverSheetScreen } from "@/components/student/cover-sheet";
import { RulesSheetScreen } from "@/components/student/rules-sheet";
import { MembersSheetScreen, type MemberRow } from "@/components/student/members-sheet";
import { UndertakingSheetScreen } from "@/components/student/undertaking-sheet";
import { ScheduleSheetScreen } from "@/components/schedule/schedule-sheet";
import { TopicSheetScreen } from "@/components/topics/topic-sheet";
import { ActivityChartScreen } from "@/components/activity/activity-chart-sheet";
import { ContentSheet } from "@/components/records/content-sheet";
import { ReviewSheetScreen } from "@/components/reviews/review-sheet";
import { EvalSheetScreen } from "@/components/evaluation/eval-sheet";
import { FINAL_T2_COMPONENTS, FINAL_T2_TOTAL, MOCK_T1_COMPONENTS, MOCK_T1_TOTAL } from "@/lib/constants";
import {
  approveMockSheetsAction,
  saveMockSheetsAction,
  submitMockSheetsAction,
  unlockMockSheetsAction,
} from "@/lib/actions/mock";
import {
  approveFinalSheetsAction,
  saveFinalSheetsAction,
  submitFinalSheetsAction,
  unlockFinalSheetsAction,
} from "@/lib/actions/final";
import { ExaminerSheetScreen } from "@/components/examiner/examiner-sheet";
import { ChecklistSheet } from "@/components/records/checklist-sheet";
import { CompetitionSheet } from "@/components/records/competition-sheet";
import { PaperSheet } from "@/components/records/paper-sheet";
import { MeetingSheet } from "@/components/sponsored/meeting-sheet";
import { FeedbackSheet } from "@/components/sponsored/feedback-sheet";
import { NotesSheet } from "@/components/records/notes-sheet";

export const metadata = { title: "Project Diary print — Digital BE Log Book" };

const REVIEW_ORDER = [
  "REVIEW_I",
  "REVIEW_II",
  "FINAL_DESIGN",
  "REVIEW_I_MODELING",
  "REVIEW_II_CODING",
  "FINAL_VALIDATION",
  "REPORT_WRITING",
];

/**
 * The whole logbook in order on one print document (F16). Every section reuses
 * the SAME Sheet components as the screens (print mode, read-only) — there is
 * no separate PDF template. Puppeteer prints this route to A4.
 */
export default async function PrintGroupPage({ params }: { params: { groupId: string } }) {
  const user = await requireUser();

  const group = await prisma.group.findUnique({
    where: { id: params.groupId },
    include: {
      guide: { select: { name: true } },
      members: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!group) notFound();
  if (!canViewGroup(user, { guideId: group.guideId, members: group.members })) {
    redirect(homeForRole(user.role));
  }

  const [
    terms,
    topics,
    monthCharts,
    rtm,
    cost,
    reviews,
    mock,
    finall,
    examinerI,
    examinerII,
    checklistI,
    checklistII,
    competitions,
    papers,
    notes,
    sponsored,
  ] = await Promise.all([
    getSchedule(),
    getTopicSheet(group.id),
    Promise.all(
      (ACTIVITY_MONTHS as readonly ActivityMonth[]).map((month) => getMonthChart(group.id, month)),
    ),
    getContentPage(group.id, "RTM"),
    getContentPage(group.id, "COST"),
    Promise.all(REVIEW_ORDER.map((reviewType) => getReviewSheet(group.id, reviewType))),
    getMockSheet(group.id),
    getFinalSheet(group.id),
    getExaminerSheet(group.id, "TERM_I"),
    getExaminerSheet(group.id, "TERM_II"),
    getChecklist(group.id, "TERM_I"),
    getChecklist(group.id, "TERM_II"),
    listCompetitions(group.id),
    listPapers(group.id),
    listNotes(group.id),
    group.isSponsored ? getSponsoredSheet(group.id) : Promise.resolve(null),
  ]);

  const guideName = group.guide?.name ?? "";

  const slots: MemberRow[] = [0, 1, 2, 3].map((i) => {
    const member = group.members[i];
    if (!member) {
      return {
        id: `slot-${i}`,
        placeholder: true,
        name: "",
        teResult: "",
        rollNo: "",
        examSeatNo: "",
        mobile: "",
        email: "",
        contribution: "",
        photoUrl: "",
      };
    }
    return {
      id: member.id,
      placeholder: false,
      name: member.name ?? "",
      teResult: member.teResult ?? "",
      rollNo: member.rollNo ?? "",
      examSeatNo: member.examSeatNo ?? "",
      mobile: member.mobile ?? "",
      email: member.email ?? "",
      contribution: member.contribution ?? "",
      photoUrl: member.photoUrl ?? "",
    };
  });

  return (
    <div className="paper-desk">
      <CoverSheetScreen
        initial={{
          department: group.department ?? "",
          academicYear: group.academicYear ?? "",
          projectTitle: group.projectTitle ?? "",
          area: group.area ?? "",
          groupNo: group.groupNo ?? "",
        }}
        guideName={guideName}
        editable={false}
        print
      />
      <RulesSheetScreen
        members={group.members.map((member) => ({
          id: member.id,
          name: member.name,
          acknowledgedAt: member.rulesAckAt ? member.rulesAckAt.toISOString() : null,
        }))}
        editable={false}
        print
      />
      <MembersSheetScreen initial={slots} editable={false} print />
      <UndertakingSheetScreen
        department={group.department ?? "Computer"}
        batch={group.academicYear ?? ""}
        academicYear={group.academicYear ?? ""}
        projectTitle={group.projectTitle ?? ""}
        members={group.members.map((member) => ({
          id: member.id,
          name: member.name,
          acceptedAt: member.undertakingAcceptedAt ? member.undertakingAcceptedAt.toISOString() : null,
        }))}
        editable={false}
        print
      />
      <ScheduleSheetScreen terms={terms} editable={false} print />
      <TopicSheetScreen
        groupId={group.id}
        groupNo={group.groupNo}
        guideName={topics.guideName}
        topics={topics.topics}
        mode="student"
        editable={false}
        print
        printHref=""
      />
      {monthCharts.map((chart) => (
        <ActivityChartScreen
          key={chart.month}
          groupId={group.id}
          groupNo={group.groupNo}
          guideName={topics.guideName}
          month={chart.month}
          entries={chart.entries}
          mode="student"
          editable={false}
          print
          printHref=""
        />
      ))}
      <ContentSheet
        pageType="RTM"
        title="Requirement Traceability Matrix"
        richText={rtm.richText ?? ""}
        fileUrl={rtm.fileUrl}
        editable={false}
        print
        printHref=""
      />
      <ContentSheet
        pageType="COST"
        title="Project Cost Estimation"
        richText={cost.richText ?? ""}
        fileUrl={cost.fileUrl}
        editable={false}
        print
        printHref=""
      />
      {reviews.map((review) => (
        <ReviewSheetScreen
          key={review.template.reviewType}
          groupId={group.id}
          groupNo={group.groupNo}
          guideName={topics.guideName}
          reviewType={review.template.reviewType}
          title={review.template.title}
          formStatus={review.form.status}
          remarkAndSuggestions={review.form.remarkAndSuggestions}
          submittedByName={review.form.submittedByName}
          submittedAt={review.form.submittedAt}
          approvedByName={review.form.approvedByName}
          approvedAt={review.form.approvedAt}
          unlockReason={review.form.unlockReason}
          scores={review.scores}
          hasDateColumn={review.template.hasDateColumn}
          mode="student"
          editable={false}
          print
          printHref=""
        />
      ))}
      <EvalSheetScreen
        groupId={group.id}
        groupNo={group.groupNo}
        title="Mock Evaluation Term-I (Final Review)"
        subtitle="Total 50 · Refer Rubrics for Details"
        components={MOCK_T1_COMPONENTS}
        totalMax={MOCK_T1_TOTAL}
        rows={mock.rows}
        submittedByName={mock.submittedSign.name}
        submittedAt={mock.submittedSign.at}
        actions={{
          save: saveMockSheetsAction,
          submit: submitMockSheetsAction,
          approve: approveMockSheetsAction,
          unlock: unlockMockSheetsAction,
        }}
        mode="student"
        editable={false}
        print
        printHref=""
      />
      <EvalSheetScreen
        groupId={group.id}
        groupNo={group.groupNo}
        title="Final Evaluation of Project (Term-II)"
        subtitle="Total 100"
        components={FINAL_T2_COMPONENTS}
        totalMax={FINAL_T2_TOTAL}
        rows={finall.rows}
        submittedByName={finall.submittedSign.name}
        submittedAt={finall.submittedSign.at}
        actions={{
          save: saveFinalSheetsAction,
          submit: submitFinalSheetsAction,
          approve: approveFinalSheetsAction,
          unlock: unlockFinalSheetsAction,
        }}
        mode="student"
        editable={false}
        print
        printHref=""
      />
      <ExaminerSheetScreen
        groupId={group.id}
        groupNo={group.groupNo}
        term="TERM_I"
        termLabel="Term-I"
        projectTitle={examinerI.projectTitle}
        date={examinerI.date}
        answers={examinerI.answers}
        remarks={examinerI.remarks}
        externalName={examinerI.externalName}
        internalName={examinerI.internalName}
        signedAt={examinerI.signedAt}
        mode="student"
        editable={false}
        print
        printHref=""
      />
      <ExaminerSheetScreen
        groupId={group.id}
        groupNo={group.groupNo}
        term="TERM_II"
        termLabel="Term-II"
        projectTitle={examinerII.projectTitle}
        date={examinerII.date}
        answers={examinerII.answers}
        remarks={examinerII.remarks}
        externalName={examinerII.externalName}
        internalName={examinerII.internalName}
        signedAt={examinerII.signedAt}
        mode="student"
        editable={false}
        print
        printHref=""
      />
      <ChecklistSheet
        term="TERM_I"
        title="Submission Checklist Term-I"
        items={checklistI.items}
        editable={false}
        print
        printHref=""
      />
      <ChecklistSheet
        term="TERM_II"
        title="Submission Checklist Term-II"
        items={checklistII.items}
        editable={false}
        print
        printHref=""
      />
      <CompetitionSheet entries={competitions} editable={false} print printHref="" />
      <PaperSheet entries={papers} editable={false} print printHref="" />
      {sponsored
        ? sponsored.semesters.map((semester) => (
            <MeetingSheet
              key={semester.semester}
              semester={semester.semester}
              title={semester.title}
              rows={semester.rows}
              mode="student"
              editable={false}
              print
              printHref=""
            />
          ))
        : null}
      {sponsored ? (
        <FeedbackSheet
          company={sponsored.feedback.company}
          ratings={sponsored.feedback.ratings}
          sealUrl={sponsored.feedback.sealUrl}
          signedAt={sponsored.feedback.signedAt}
          mode="student"
          editable={false}
          print
          printHref=""
        />
      ) : null}
      <NotesSheet
        notes={notes.map((note) => ({ id: note.id, text: note.richText ?? "" }))}
        editable={false}
        print
        printHref=""
      />
    </div>
  );
}

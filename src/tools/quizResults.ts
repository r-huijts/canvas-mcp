import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CanvasClient } from "../canvasClient.js";
import { DataAnonymizer } from "../anonymizer.js";

/** Canvas question/answer text is HTML; flatten it so results stay readable. */
function stripHtml(html: any, maxLength = 300): string {
  if (typeof html !== 'string') return '';
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** Minimal RFC 4180 parser — quiz reports arrive as CSV and we have no csv dep. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Drop a trailing blank line
  return rows.filter(r => r.length > 1 || (r[0] ?? '').trim() !== '');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function registerQuizResultTools(server: McpServer, canvas: CanvasClient) {
  // Tool: list-quiz-submissions
  server.tool(
    "list-quiz-submissions",
    "List every student's quiz attempt with score, timing and state. Start here when analysing a quiz; use get-quiz-submission-answers for per-question detail.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      anonymous: z.boolean().default(true).describe("Whether to replace student identity with a stable pseudonym (default: true for privacy)"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, anonymous = true }: { courseId: string; quizId: string; anonymous?: boolean }) => {
      try {
        const envelope = await canvas.fetchAllPagesEnvelope(
          `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
          { per_page: 100 }
        );
        const raw = envelope.quiz_submissions ?? [];
        const submissions = (anonymous ? DataAnonymizer.anonymizeQuizSubmissions(raw) : raw).map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          ...(s.student ? { student: s.student } : {}),
          attempt: s.attempt,
          workflow_state: s.workflow_state,
          score: s.score,
          kept_score: s.kept_score,
          score_before_regrade: s.score_before_regrade,
          fudge_points: s.fudge_points,
          started_at: s.started_at,
          finished_at: s.finished_at,
          time_spent: s.time_spent,
          extra_attempts: s.extra_attempts,
          extra_time: s.extra_time,
          overdue_and_needs_submission: s.overdue_and_needs_submission,
        }));

        const graded = submissions.filter((s: any) => typeof s.kept_score === 'number');
        const scores = graded.map((s: any) => s.kept_score as number);
        const summary = scores.length
          ? {
              submissions: submissions.length,
              graded: scores.length,
              average: Number((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2)),
              high: Math.max(...scores),
              low: Math.min(...scores),
            }
          : { submissions: submissions.length, graded: 0 };

        return {
          content: [{ type: "text", text: JSON.stringify({ summary, submissions }) }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz submissions: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz submissions: Unknown error');
      }
    }
  );

  // Tool: get-quiz-statistics
  server.tool(
    "get-quiz-statistics",
    "Get aggregate item analysis for a quiz: per-question response distribution across answer choices, difficulty index, and point-biserial correlation per distractor. Aggregate only — no per-student data.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      allVersions: z.boolean().default(false).describe("Include all attempts rather than only the most recent one per student"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, allVersions = false }: { courseId: string; quizId: string; allVersions?: boolean }) => {
      try {
        const stats = await canvas.getEnvelope<any>(
          `/api/v1/courses/${courseId}/quizzes/${quizId}/statistics`,
          'quiz_statistics',
          { all_versions: allVersions }
        );
        if (stats.length === 0) {
          return { content: [{ type: "text", text: "No statistics available for this quiz (it may have no submissions yet)." }] };
        }
        const s = stats[0];
        const sub = s.submission_statistics ?? {};

        const questions = (s.question_statistics ?? []).map((q: any) => {
          const biserialByAnswer = new Map<any, any>();
          for (const pb of q.point_biserials ?? []) biserialByAnswer.set(pb.answer_id, pb);
          return {
            id: q.id,
            question_type: q.question_type,
            question_text: stripHtml(q.question_text),
            points_possible: q.points_possible,
            responses: q.responses,
            difficulty_index: q.difficulty_index,
            alpha: q.alpha,
            ...(q.top_student_count !== undefined ? {
              brackets: {
                top: q.top_student_count,
                middle: q.middle_student_count,
                bottom: q.bottom_student_count,
              }
            } : {}),
            answers: (q.answers ?? []).map((a: any) => {
              const pb = biserialByAnswer.get(a.id);
              return {
                id: a.id,
                text: stripHtml(a.text, 150),
                correct: a.correct,
                responses: a.responses,
                ...(pb ? { point_biserial: pb.point_biserial } : {}),
              };
            }),
            // Essay/file-upload questions report these instead of answer buckets
            ...(q.full_credit !== undefined ? { full_credit: q.full_credit } : {}),
            ...(q.point_distribution ? { point_distribution: q.point_distribution } : {}),
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              quiz_id: s.quiz_id,
              generated_at: s.generated_at,
              includes_all_versions: s.includes_all_versions,
              multiple_attempts_exist: s.multiple_attempts_exist,
              submission_statistics: {
                unique_count: sub.unique_count,
                score_average: sub.score_average,
                score_high: sub.score_high,
                score_low: sub.score_low,
                score_stdev: sub.score_stdev,
                correct_count_average: sub.correct_count_average,
                incorrect_count_average: sub.incorrect_count_average,
                duration_average: sub.duration_average,
                scores: sub.scores,
              },
              question_statistics: questions,
            })
          }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz statistics: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz statistics: Unknown error');
      }
    }
  );

  // Tool: get-quiz-submission-answers
  server.tool(
    "get-quiz-submission-answers",
    "Get one student's actual answer to every question in a quiz, joined against the question text and the correct answer. Use list-quiz-submissions first to find user IDs.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      userId: z.string().describe("The ID of the student/user"),
      attempt: z.number().optional().describe("Which attempt to read (default: the most recent)"),
      anonymous: z.boolean().default(true).describe("Whether to replace student identity with a stable pseudonym (default: true for privacy)"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, userId, attempt, anonymous = true }: {
      courseId: string; quizId: string; userId: string; attempt?: number; anonymous?: boolean;
    }) => {
      try {
        const quiz = await canvas.get(`/api/v1/courses/${courseId}/quizzes/${quizId}`) as any;
        if (!quiz.assignment_id) {
          throw new Error(`Quiz ${quizId} has no backing assignment (practice quizzes and ungraded surveys expose no per-question answers through this route).`);
        }

        const submission = await canvas.get(
          `/api/v1/courses/${courseId}/assignments/${quiz.assignment_id}/submissions/${userId}`,
          { include: ['submission_history'] }
        ) as any;

        const history: any[] = Array.isArray(submission.submission_history) ? submission.submission_history : [];
        const candidates = history.filter(h => Array.isArray(h.submission_data));
        if (candidates.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No recorded answers for user ${userId} on quiz ${quizId} (workflow_state: ${submission.workflow_state}). The student may not have submitted an attempt.`
            }]
          };
        }
        const chosen = attempt !== undefined
          ? candidates.find(h => h.attempt === attempt)
          : candidates[candidates.length - 1];
        if (!chosen) {
          throw new Error(`Attempt ${attempt} not found. Available attempts: ${candidates.map(c => c.attempt).join(', ')}`);
        }

        const quizSubmissionId = chosen.id;
        const quizSubmissionAttempt = chosen.attempt;
        if (quizSubmissionId === undefined || quizSubmissionId === null ||
            quizSubmissionAttempt === undefined || quizSubmissionAttempt === null) {
          throw new Error('The selected attempt is missing its quiz submission ID or attempt number, so its questions cannot be loaded safely.');
        }

        const questions: any[] = await canvas.fetchAllPages(
          `/api/v1/courses/${courseId}/quizzes/${quizId}/questions`,
          {
            per_page: 100,
            quiz_submission_id: quizSubmissionId,
            quiz_submission_attempt: quizSubmissionAttempt,
          }
        );
        const questionById = new Map<any, any>(questions.map(q => [q.id, q]));

        const answers = (chosen.submission_data ?? []).map((d: any) => {
          const q = questionById.get(d.question_id);
          const options: any[] = q?.answers ?? [];
          const chosenOption = d.answer_id !== undefined && d.answer_id !== null
            ? options.find((a: any) => a.id === d.answer_id || String(a.id) === String(d.answer_id))
            : undefined;
          const correctOptions = options.filter((a: any) => (a.weight ?? 0) > 0);
          // Multi-answer / fill-in-multiple-blanks record answer_<id> keys rather
          // than a single answer_id, so pass those through untouched.
          const extraKeys = Object.keys(d).filter(k => /^answer_/.test(k) && k !== 'answer_id');
          return {
            question_id: d.question_id,
            question_name: q?.question_name,
            question_type: q?.question_type,
            question_text: stripHtml(q?.question_text),
            points_possible: q?.points_possible,
            points_earned: d.points,
            correct: d.correct,
            given_answer_id: d.answer_id ?? null,
            given_answer: chosenOption ? stripHtml(chosenOption.text, 200) : (d.text ? stripHtml(d.text, 500) : null),
            ...(extraKeys.length ? { given_answer_parts: Object.fromEntries(extraKeys.map(k => [k, d[k]])) } : {}),
            correct_answers: correctOptions.map((a: any) => stripHtml(a.text, 200)),
            ...(d.more_comments ? { grader_comment: d.more_comments } : {}),
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              student: anonymous ? DataAnonymizer.pseudonymFor(userId) : submission.user?.name ?? null,
              user_id: userId,
              quiz_id: quizId,
              attempt: chosen.attempt,
              available_attempts: candidates.map(c => c.attempt),
              submitted_at: chosen.submitted_at,
              score: chosen.score,
              points_possible: quiz.points_possible,
              answers,
            })
          }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz submission answers: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz submission answers: Unknown error');
      }
    }
  );

  // Tool: get-quiz-report
  server.tool(
    "get-quiz-report",
    "Generate (or reuse) a Canvas quiz report and return its parsed contents. 'student_analysis' gives the whole-class student x question answer matrix; 'item_analysis' gives per-question difficulty and discrimination. Generation is asynchronous and this tool polls until it finishes.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      reportType: z.enum(["student_analysis", "item_analysis"]).default("student_analysis").describe("Which report to produce"),
      allVersions: z.boolean().default(false).describe("Include every attempt rather than only the most recent one per student"),
      format: z.enum(["summary", "full"]).default("summary").describe("'summary' aggregates per question and per student; 'full' returns every cell (can be large)"),
      regenerate: z.boolean().default(false).describe("Force a fresh report instead of reusing an existing one"),
      anonymous: z.boolean().default(true).describe("Whether to replace student identity with a stable pseudonym (default: true for privacy)"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, reportType = "student_analysis", allVersions = false, format = "summary", regenerate = false, anonymous = true }: {
      courseId: string; quizId: string; reportType?: string; allVersions?: boolean; format?: string; regenerate?: boolean; anonymous?: boolean;
    }) => {
      const base = `/api/v1/courses/${courseId}/quizzes/${quizId}/reports`;
      try {
        const matches = (r: any) => r.report_type === reportType && !!r.includes_all_versions === allVersions;

        let report: any;
        if (!regenerate) {
          const existing = await canvas.get(base, { includes_all_versions: allVersions, 'include[]': 'file' }) as any[];
          report = (Array.isArray(existing) ? existing : []).find(matches);
        }

        if (!report || regenerate || !report.file) {
          try {
            report = await canvas.post(base, {
              quiz_report: { report_type: reportType, includes_all_versions: allVersions },
              include: ['file', 'progress'],
            });
          } catch (error: any) {
            // Canvas rejects a duplicate in-flight report; fall back to the existing one.
            const existing = await canvas.get(base, { includes_all_versions: allVersions, 'include[]': 'file' }) as any[];
            report = (Array.isArray(existing) ? existing : []).find(matches);
            if (!report) throw error;
          }
        }

        // Poll until the file materialises (Canvas generates reports out of band).
        const deadline = Date.now() + 90_000;
        while (!report?.file?.url && Date.now() < deadline) {
          await sleep(3000);
          report = await canvas.get(`${base}/${report.id}`, { 'include[]': 'file' });
        }
        if (!report?.file?.url) {
          return {
            content: [{
              type: "text",
              text: `Report ${report?.id} (${reportType}) is still generating after 90s. Call get-quiz-report again shortly to pick up the finished file.`
            }]
          };
        }

        const csv = await canvas.downloadText(report.file.url);
        const rows = parseCsv(csv);
        if (rows.length < 2) {
          return { content: [{ type: "text", text: `Report ${reportType} generated but contains no data rows (the quiz may have no submissions).` }] };
        }

        const header = rows[0];
        const body = rows.slice(1);
        const meta = { report_id: report.id, report_type: reportType, includes_all_versions: report.includes_all_versions, generated_at: report.created_at, rows: body.length };

        // Identity columns in student_analysis; blanked or pseudonymised when anonymous.
        const idIndex = header.findIndex(h => h.trim().toLowerCase() === 'id');
        const nameIndex = header.findIndex(h => h.trim().toLowerCase() === 'name');
        const redactIndexes = header.reduce<number[]>((acc, h, i) => {
          if (/^(sis[ _]?id|sis[ _]?login[ _]?id|login[ _]?id|section|section[ _]?id|section[ _]?sis[ _]?id)$/i.test(h.trim())) acc.push(i);
          return acc;
        }, []);

        const cleaned = body.map(r => {
          const row = [...r];
          if (anonymous) {
            if (nameIndex >= 0) row[nameIndex] = idIndex >= 0 ? DataAnonymizer.pseudonymFor(r[idIndex]) : 'Student';
            for (const i of redactIndexes) row[i] = '';
          }
          return row;
        });

        if (reportType === 'item_analysis' || format === 'full') {
          const objects = cleaned.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
          return { content: [{ type: "text", text: JSON.stringify({ ...meta, columns: header, rows: objects }) }] };
        }

        // student_analysis summary: per-question point stats plus per-student totals.
        // Question columns are "<id>: <text>" followed by an unnamed points column.
        const questionCols: { label: string; pointsIndex: number }[] = [];
        for (let i = 0; i < header.length; i++) {
          if (/^\d+:/.test(header[i].trim()) && header[i + 1] !== undefined && header[i + 1].trim() === '') {
            questionCols.push({ label: header[i].trim(), pointsIndex: i + 1 });
          }
        }

        const questionStats = questionCols.map(({ label, pointsIndex }) => {
          const points = cleaned
            .map(r => Number(r[pointsIndex]))
            .filter(n => Number.isFinite(n));
          const max = points.length ? Math.max(...points) : 0;
          const fullCredit = points.filter(p => p === max && max > 0).length;
          return {
            question: label.length > 160 ? `${label.slice(0, 160)}…` : label,
            responses: points.length,
            mean_points: points.length ? Number((points.reduce((a, b) => a + b, 0) / points.length).toFixed(2)) : null,
            max_points_observed: max,
            full_credit_count: fullCredit,
            full_credit_rate: points.length ? Number((fullCredit / points.length).toFixed(2)) : null,
          };
        });

        const scoreIndex = header.findIndex(h => h.trim().toLowerCase() === 'score');
        const students = cleaned.map(r => ({
          student: nameIndex >= 0 ? r[nameIndex] : null,
          user_id: idIndex >= 0 ? r[idIndex] : null,
          score: scoreIndex >= 0 ? Number(r[scoreIndex]) : null,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...meta,
              note: "format='summary'; call again with format='full' for the complete answer matrix.",
              question_statistics: questionStats,
              students,
            })
          }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to get quiz report: ${error.message}`);
        }
        throw new Error('Failed to get quiz report: Unknown error');
      }
    }
  );

  // Tool: get-quiz-submission-events
  server.tool(
    "get-quiz-submission-events",
    "Get the event trail for one quiz attempt: how answers changed over time, and when the student left or returned to the quiz page. Use the submission id from list-quiz-submissions.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      submissionId: z.string().describe("The ID of the quiz submission (not the user ID)"),
      attempt: z.number().optional().describe("Which attempt to read (default: the most recent)"),
    },
    { readOnlyHint: true },
    async ({ courseId, quizId, submissionId, attempt }: { courseId: string; quizId: string; submissionId: string; attempt?: number }) => {
      try {
        const params: any = { per_page: 100 };
        if (attempt !== undefined) params.attempt = attempt;
        const envelope = await canvas.fetchAllPagesEnvelope(
          `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}/events`,
          params
        );
        const events = envelope.quiz_submission_events ?? [];

        const counts: Record<string, number> = {};
        for (const e of events) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;

        const timeline = events.map((e: any) => {
          if (e.event_type === 'question_answered') {
            return {
              at: e.created_at,
              event: e.event_type,
              answers: (e.event_data ?? []).map((d: any) => ({ question_id: d.quiz_question_id, answer: d.answer })),
            };
          }
          return { at: e.created_at, event: e.event_type, ...(e.event_data ? { data: e.event_data } : {}) };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              submission_id: submissionId,
              attempt: attempt ?? 'latest',
              event_counts: counts,
              page_left_count: counts['page_blurred'] ?? 0,
              timeline,
            })
          }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch quiz submission events: ${error.message}`);
        }
        throw new Error('Failed to fetch quiz submission events: Unknown error');
      }
    }
  );

  // Tool: update-quiz-submission-score
  server.tool(
    "update-quiz-submission-score",
    "Regrade a quiz attempt: override the score on individual questions and/or apply fudge points to the total.",
    {
      courseId: z.string().describe("The ID of the course"),
      quizId: z.string().describe("The ID of the quiz"),
      submissionId: z.string().describe("The ID of the quiz submission (not the user ID)"),
      attempt: z.number().describe("Which attempt to regrade"),
      fudgePoints: z.number().optional().describe("Points to add to (or subtract from) the total score"),
      questions: z.record(z.object({
        score: z.number().optional(),
        comment: z.string().optional(),
      })).optional().describe("Per-question overrides keyed by question ID, e.g. { \"1234\": { \"score\": 2, \"comment\": \"Accepted alternative phrasing\" } }"),
    },
    { idempotentHint: true },
    async ({ courseId, quizId, submissionId, attempt, fudgePoints, questions }: {
      courseId: string; quizId: string; submissionId: string; attempt: number; fudgePoints?: number; questions?: Record<string, { score?: number; comment?: string }>;
    }) => {
      if (fudgePoints === undefined && !questions) {
        throw new Error('Provide fudgePoints, questions, or both — nothing to update.');
      }
      try {
        const entry: any = { attempt };
        if (fudgePoints !== undefined) entry.fudge_points = fudgePoints;
        if (questions) entry.questions = questions;

        const result = await canvas.put(
          `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${submissionId}`,
          { quiz_submissions: [entry] }
        ) as any;
        const updated = result?.quiz_submissions?.[0] ?? result;

        return {
          content: [{
            type: "text",
            text: `Quiz submission ${submissionId} regraded (attempt ${attempt}): score ${updated?.score}, kept_score ${updated?.kept_score}, fudge_points ${updated?.fudge_points}.`
          }]
        };
      } catch (error: any) {
        if (error instanceof Error) {
          throw new Error(`Failed to update quiz submission score: ${error.message}`);
        }
        throw new Error('Failed to update quiz submission score: Unknown error');
      }
    }
  );
}

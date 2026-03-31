// ============================================================
// Gmail-OrchestratorAI  —  Google Apps Script + Claude API
// ============================================================
// 1) fetchAndClassify()  → pulls inbox, sends to Claude, writes to Sheet
// 2) executeApproved()   → reads approved rows and runs Gmail actions
// 3) onOpen()            → adds a custom menu to the Sheet
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
const CONFIG = {
  CLAUDE_API_KEY: PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY'),
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  SHEET_NAME: 'Email Triage',
  MAX_EMAILS: 50,
  MAX_BODY_CHARS: 800,
};

// ── MENU ────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📬 Gmail Orchestrator')
    .addItem('1 · Fetch & Classify Inbox', 'fetchAndClassify')
    .addSeparator()
    .addItem('2 · Execute Approved Actions', 'executeApproved')
    .addToUi();
}

// ── STEP 1: FETCH & CLASSIFY ────────────────────────────────
function fetchAndClassify() {
  const ui = SpreadsheetApp.getUi();
  const threads = GmailApp.getInboxThreads(0, CONFIG.MAX_EMAILS);
  if (threads.length === 0) {
    ui.alert('Inbox is empty — nothing to process.');
    return;
  }

  const emailBatch = threads.map(thread => {
    const msg = thread.getMessages()[thread.getMessageCount() - 1];
    return {
      message_id: msg.getId(),
      thread_id: thread.getId(),
      from: msg.getFrom(),
      to: msg.getTo(),
      date: msg.getDate().toISOString(),
      subject: thread.getFirstMessageSubject() || '(no subject)',
      snippet: thread.getMessages().length > 1
        ? thread.getMessages().map(m => m.getPlainBody().substring(0, 200)).join('\n---\n')
        : '',
      body: msg.getPlainBody().substring(0, CONFIG.MAX_BODY_CHARS),
      labels: thread.getLabels().map(l => l.getName()).join(', '),
      is_unread: thread.isUnread(),
      message_count: thread.getMessageCount(),
    };
  });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = '--- START OF EMAIL BATCH ---\n\n' +
    emailBatch.map((e, i) => formatEmailForPrompt(e, i + 1)).join('\n\n') +
    '\n\n--- END OF EMAIL BATCH ---';

  ui.alert(`Processing ${emailBatch.length} emails with Claude…\nThis may take 15-30 seconds.`);
  const classifications = callClaude(systemPrompt, userPrompt);

  if (!classifications) {
    ui.alert('Error: Claude did not return valid results. Check Logs (View → Logs).');
    return;
  }

  writeResultsToSheet(classifications, emailBatch);
  ui.alert(`Done! ${classifications.length} emails classified.\nReview the sheet, check the "Approve" boxes, then run "Execute Approved Actions".`);
}

// ── STEP 2: EXECUTE APPROVED ────────────────────────────────
function executeApproved() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    ui.alert('No "Email Triage" sheet found. Run Fetch & Classify first.');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const COL = {
    APPROVE:    headers.indexOf('✅ Approve'),
    MESSAGE_ID: headers.indexOf('Message ID'),
    THREAD_ID:  headers.indexOf('Thread ID'),
    ACTION:     headers.indexOf('Action'),
    STATUS:     headers.indexOf('Status'),
  };

  let executed = 0, skipped = 0, errors = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[COL.APPROVE] !== true || row[COL.STATUS] === 'Done') { skipped++; continue; }

    try {
      executeAction(row[COL.THREAD_ID], row[COL.MESSAGE_ID], row[COL.ACTION]);
      sheet.getRange(r + 1, COL.STATUS + 1).setValue('Done').setBackground('#d9ead3');
      executed++;
    } catch (err) {
      sheet.getRange(r + 1, COL.STATUS + 1).setValue('Error: ' + err.message).setBackground('#f4cccc');
      errors++;
      Logger.log('Error on row ' + (r + 1) + ': ' + err.message);
    }
  }

  ui.alert(`Execution complete.\n\n✅ Executed: ${executed}\n⏭️ Skipped: ${skipped}\n❌ Errors: ${errors}`);
}

// ── GMAIL ACTIONS ───────────────────────────────────────────
function executeAction(threadId, messageId, action) {
  const thread = GmailApp.getThreadById(threadId);
  if (!thread) throw new Error('Thread not found: ' + threadId);

  switch (action) {
    case 'LABEL_URGENT':
      let urgentLabel = GmailApp.getUserLabelByName('🔴 Urgent');
      if (!urgentLabel) urgentLabel = GmailApp.createLabel('🔴 Urgent');
      thread.addLabel(urgentLabel);
      if (thread.isInInbox()) thread.markUnread();
      break;
    case 'CREATE_TASK':
      let taskLabel = GmailApp.getUserLabelByName('📋 Action Required');
      if (!taskLabel) taskLabel = GmailApp.createLabel('📋 Action Required');
      thread.addLabel(taskLabel);
      thread.markImportant();
      break;
    case 'SUMMARIZE_AND_ARCHIVE':
      let summaryLabel = GmailApp.getUserLabelByName('📝 Summarized');
      if (!summaryLabel) summaryLabel = GmailApp.createLabel('📝 Summarized');
      thread.addLabel(summaryLabel);
      thread.moveToArchive();
      break;
    case 'ARCHIVE':
      thread.moveToArchive();
      break;
    case 'DELETE':
      thread.moveToTrash();
      break;
    default:
      throw new Error('Unknown action: ' + action);
  }
}

// ── CLAUDE API ──────────────────────────────────────────────
function callClaude(systemPrompt, userPrompt) {
  const apiKey = CONFIG.CLAUDE_API_KEY;
  if (!apiKey) {
    Logger.log('ERROR: CLAUDE_API_KEY not set. Go to Project Settings → Script Properties.');
    return null;
  }

  const payload = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status !== 200) {
    Logger.log('Claude API error (' + status + '): ' + body);
    return null;
  }

  const parsed = JSON.parse(body);
  const text = parsed.content[0].text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    Logger.log('Could not find JSON array in Claude response:\n' + text);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    Logger.log('JSON parse error: ' + e.message + '\nRaw text:\n' + text);
    return null;
  }
}

// ── PROMPT BUILDER ──────────────────────────────────────────
function buildSystemPrompt() {
  return `You are "Gmail-OrchestratorAI", an expert system for cleaning and organizing large email backlogs. Your goal is to process a batch of emails and return a structured JSON plan.

For each email, perform this analysis:
1. Summarize: Briefly state the core message or purpose in one sentence.
2. Identify Action: Determine the single most appropriate action from the list below.
3. Extract Details: Provide a clear, concise detail for the action.

Action Rules:
- LABEL_URGENT: Personally addressed, time-sensitive, or from a critical sender. action_detail = why it's urgent.
- CREATE_TASK: Contains a clear actionable request. action_detail = the task phrased as a command.
- SUMMARIZE_AND_ARCHIVE: Longer threads or info-dense emails, no immediate task needed. action_detail = 2-3 sentence summary.
- ARCHIVE: Informational, keep for records, no action needed (receipts, confirmations, non-critical updates).
- DELETE: Low-value or irrelevant. Default for generic app notifications (likes, doc updates, logins) unless it's a critical security or billing alert.

Output Format:
Return ONLY a valid JSON array. Each object must have:
- message_id: The unique identifier provided for the email.
- subject: The subject line.
- suggested_action: One of the five action commands.
- action_detail: The task, summary, or reason.

Do not include any text outside the JSON array.`;
}

function formatEmailForPrompt(email, index) {
  let block = `=== EMAIL #${index} ===
message_id: ${email.message_id}
From: ${email.from}
To: ${email.to}
Date: ${email.date}
Subject: ${email.subject}
Unread: ${email.is_unread}
Messages in thread: ${email.message_count}
Labels: ${email.labels || 'none'}`;

  if (email.snippet && email.message_count > 1) {
    block += `\nThread snippet:\n${email.snippet}`;
  }

  block += `\nBody:\n${email.body}`;
  return block;
}

// ── SHEET WRITER ────────────────────────────────────────────
function writeResultsToSheet(classifications, emailBatch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  const headers = [
    '✅ Approve', 'Action', 'Subject', 'From', 'Detail',
    'Date', 'Unread', 'Message ID', 'Thread ID', 'Status'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a73e8');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  const emailMap = {};
  emailBatch.forEach(e => { emailMap[e.message_id] = e; });

  const rows = classifications.map(c => {
    const meta = emailMap[c.message_id] || {};
    return [
      false, c.suggested_action, c.subject, meta.from || '',
      c.action_detail, meta.date || '', meta.is_unread || false,
      c.message_id, meta.thread_id || '', ''
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).insertCheckboxes();

    for (let r = 0; r < rows.length; r++) {
      const actionCell = sheet.getRange(r + 2, 2);
      switch (rows[r][1]) {
        case 'LABEL_URGENT':          actionCell.setBackground('#ea4335').setFontColor('#fff'); break;
        case 'CREATE_TASK':           actionCell.setBackground('#fbbc04').setFontColor('#000'); break;
        case 'SUMMARIZE_AND_ARCHIVE': actionCell.setBackground('#34a853').setFontColor('#fff'); break;
        case 'ARCHIVE':               actionCell.setBackground('#e8eaed').setFontColor('#444'); break;
        case 'DELETE':                actionCell.setBackground('#9e9e9e').setFontColor('#fff'); break;
      }
    }
  }

  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 400);
  sheet.hideColumns(8, 2);
}

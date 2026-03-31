# Gmail-OrchestratorAI Setup Guide

This Google Apps Script reads your Gmail inbox, sends emails to the Claude API for classification, then writes results to a Google Sheet where you can approve/reject actions before they execute.

## Setup Steps

### Step 1 — Create a new Google Sheet
1. Navigate to [sheets.new](https://sheets.new) to create a blank Google Sheet
2. Click the "Untitled spreadsheet" title and rename it to **Gmail Orchestrator**

### Step 2 — Open the Apps Script editor
1. Click **Extensions** → **Apps Script**
2. A new tab opens with the Apps Script editor

### Step 3 — Paste the script code
1. In the Apps Script editor, select all existing code (`Ctrl+A`) and delete it
2. Copy the entire contents of `Code.gs` from this directory and paste it into the editor
3. Press `Ctrl+S` to save. If prompted, name the project **Gmail Orchestrator**

### Step 4 — Add your Claude API key
1. In the Apps Script editor, click the **⚙️ Project Settings** gear icon in the left sidebar
2. Scroll to **Script Properties** and click **Add script property**
3. Set **Property name**: `CLAUDE_API_KEY`
4. Set **Property value**: your Anthropic API key
5. Click **Save script properties**

### Step 5 — Authorize Gmail + Sheets permissions
1. Go back to the code editor (click the `<>` icon in the left sidebar)
2. In the function dropdown at the top, select `fetchAndClassify`
3. Click the **Run** button (▶️)
4. A permissions dialog will appear — click **Review permissions**
5. Select your Google account
6. If you see "Google hasn't verified this app", click **Advanced** → **Go to Gmail Orchestrator (unsafe)**
7. Click **Allow** to grant Gmail + Sheets permissions
8. Dismiss the alert dialog that appears

### Step 6 — Verify the custom menu
1. Switch back to the Google Sheet tab
2. Reload the page (`F5`)
3. You should see a **📬 Gmail Orchestrator** menu in the top menu bar

### Step 7 — First run
1. Click **📬 Gmail Orchestrator** → **1 · Fetch & Classify Inbox**
2. Click **OK** on the processing alert
3. Wait 15-30 seconds for Claude to classify emails
4. Click **OK** on the completion alert
5. Review the **Email Triage** sheet tab with color-coded rows

## Usage
1. Run **Fetch & Classify Inbox** to process your inbox
2. Review the classified emails in the sheet
3. Check the **✅ Approve** boxes for actions you want to execute
4. Run **Execute Approved Actions** to apply the approved actions

## Actions
| Action | Description |
|--------|-------------|
| `LABEL_URGENT` | Labels thread 🔴 Urgent, marks unread |
| `CREATE_TASK` | Labels thread 📋 Action Required, marks important |
| `SUMMARIZE_AND_ARCHIVE` | Labels thread 📝 Summarized, archives |
| `ARCHIVE` | Moves thread to archive |
| `DELETE` | Moves thread to trash |

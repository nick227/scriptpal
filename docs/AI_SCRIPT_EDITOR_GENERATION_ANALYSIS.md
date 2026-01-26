# AI Script Editor Generation Analysis

## Scope
This write-up covers how AI-generated content is routed into the script editor, how it is formatted, and why dialog text can end up as action text. It focuses on the current append and edit/write paths, the data formats each path uses, and the margin for error created by AI output constraints.

## End-to-End Flow (AI → Editor)
- The chat controller detects append-page prompts and returns plain text content to the client with the `APPEND_SCRIPT` intent. The response includes `response.content` containing the AI text block. 
- The client receives the intent, and `ScriptOperationsHandler` routes it to the script orchestrator.
- The script orchestrator splits the AI block into lines and assigns a format for each line using heuristics, then appends the lines into the editor document.
- The editor stores the updated lines in JSON format (`version: 2`) and renders them into DOM lines with format classes.

Key path references:
```
190:255:server/controllers/chatController.js
if (scriptId && isAppendPageRequest(req.body.prompt)) {
  // ...
  return res.status(200).json({
    success: true,
    intent: APPEND_SCRIPT_INTENT,
    // ...
    response: {
      content: appendResult.responseText,
      metadata: {
        generationMode: APPEND_PAGE_INTENT
      }
    }
  });
}
```
```
81:110:public/js/widgets/chat/core/ScriptOperationsHandler.js
async _handleScriptAppend (data) {
  const orchestrator = this.getScriptOrchestrator && this.getScriptOrchestrator();
  // ...
  const content = data.response && data.response.content;
  if (content && orchestrator) {
    const appendSuccess = await orchestrator.handleScriptAppend({
      content,
      isFromAppend: true
    });
  }
}
```
```
142:221:public/js/managers/ScriptOrchestrator.js
async handleScriptAppend (data) {
  const lines = String(data.content).split(/\r?\n/);
  const lineItems = lines.map((line) => ({
    content: line,
    format: this.determineContentFormat(line)
  }));
  const result = await editorContent.appendLines(lineItems);
}
```
```
912:953:public/js/widgets/editor/EditorContent.js
async appendLines (lines = []) {
  for (const line of lines) {
    const content = typeof line?.content === 'string' ? line.content : '';
    const format = typeof line?.format === 'string' ? line.format : 'action';
    lastLine = this.document.insertLineAt(this.document.lines.length, {
      format,
      content
    });
  }
  await this.domHandler.renderDocument(this.document, { source: 'append' });
}
```

## Formatting Sources and Parsing Behavior
There are two AI output shapes that reach the editor:

1. **Command-based edits (WRITE/EDIT)**
   - The AI returns commands with tags like `<dialog>...</dialog>` via the function call schema.
   - The editor parses the tags. If the value is not tagged, it defaults to `action`.

```
21:90:server/controllers/langchain/chains/edit/WriteScript.js
const completionParams = {
  messages,
  functions: [WriteScriptMessages.getFunctionSchema()],
  function_call: { name: 'write_script' }
};
// ...
const editCommands = JSON.parse(functionCallArgs);
const commands = Array.isArray(editCommands.commands) ? editCommands.commands : [];
```
```
18:100:server/controllers/langchain/chains/edit/WriteScriptMessages.js
value: {
  type: 'string',
  description: 'The new content for ADD operations (must include script tags)'
}
```
```
397:470:public/js/widgets/editor/EditorContent.js
const parseValue = (value) => {
  if (typeof value !== 'string') {
    return { format: 'action', content: '' };
  }
  const match = value.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
  if (!match) {
    return { format: 'action', content: value };
  }
  return {
    format: match[1].toLowerCase(),
    content: match[2]
  };
};
```

2. **Append-page content (plain text)**
   - The AI is explicitly told to return plain text lines with no markup.
   - Formatting is inferred by heuristics on each line.

```
8:68:server/controllers/langchain/chains/edit/AppendPageChain.js
const SYSTEM_INSTRUCTION = `You are a screenplay continuation engine. Continue from the current script and output ONLY new screenplay lines. Return exactly 20-22 lines. Plain text only. Do not include markdown, HTML/XML tags, numbering, or commentary.`;
```
```
193:221:public/js/managers/ScriptOrchestrator.js
determineContentFormat (content) {
  if (trimmedContent.match(/^(INT\.|EXT\.|INTERIOR|EXTERIOR)/i)) {
    return 'header';
  }
  if (trimmedContent.match(/^[A-Z][A-Z\s]+$/)) {
    return 'speaker';
  }
  if (trimmedContent.match(/^["'].*["']$/) || trimmedContent.match(/^[a-z]/)) {
    return 'dialog';
  }
  if (trimmedContent.match(/^\(.*\)$/)) {
    return 'directions';
  }
  return 'action';
}
```

## Why Dialog Is Sometimes Formatted as Action
Dialog lines are only classified as `dialog` if they are either:
- fully quoted (`"..."` or `'...'`), or
- start with a lowercase letter.

Most screenplay dialog lines start with an uppercase letter and are not quoted. That means they do **not** match the dialog heuristic and default to `action`. This is the most direct cause of "dialog text formatted as action text" in the append flow.

The risk is amplified because the append-page chain explicitly forces **plain text only** output with no tags. That removes any deterministic markup the formatter could trust, leaving only heuristics.

## Margin for Error and Where It Enters
The formatting margin for error appears in three places:

1. **AI output constraints**
   - Append-page responses must be plain text with no tags.  
   - Write/edit responses must include tags. Any missing or malformed tags default to `action` parsing.

2. **Heuristic-based classification**
   - Append flow uses simple regex rules to infer format.
   - Dialog is under-detected because common dialog shapes (capitalized, unquoted) are treated as `action`.
   - Speaker detection only matches all-caps lines; mixed-case speaker names fall through.

3. **Fallback formatting defaults**
   - Untagged or invalid lines default to `action` in multiple parsing paths (editor command parsing and content parsing).

This creates a predictable margin for error:
- **High risk**: plain-text output with no tags and no strict format markers.
- **Moderate risk**: tagged output where the AI occasionally omits or mislabels tags.
- **Low risk**: correct tags and valid command structures, because the editor respects the tag format.

## Translation Into Editor Data Model
Once lines are appended, the editor stores them as a JSON document with format metadata. This locks in whatever format the heuristic selected.

```
252:268:public/js/widgets/editor/model/ScriptDocument.js
toStorageString () {
  const payload = {
    version: 2,
    lines: this.lines.map(line => ({
      id: line.id,
      format: line.format,
      content: line.content
    }))
  };
  return JSON.stringify(payload);
}
```

## Summary (Root Cause)
Dialog formatting issues are caused by the append-page pipeline:
- The AI returns **plain text only**.
- The frontend format detector **requires quotes or lowercase** to classify dialog.
- Standard screenplay dialog lines usually start with uppercase and are unquoted.
- The editor defaults unclassified lines to `action`.

This is why dialog lines frequently show up as action after AI append.

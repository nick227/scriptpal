# ScriptPal Chat Migration Guide

## Overview

This guide covers the current chat stack: `ChatIntegration` + `ChatManager` + `ModernChatWidget`.
Legacy `ChatWidget` usage has been removed.

## Migration Steps

### 1) Use modern styles

`main.css` already imports:

```css
@import 'components/chat-modern.css';
```

### 2) Use modern chat integration

```javascript
import { ChatIntegration } from './widgets/chat/ChatIntegration.js';

const chatIntegration = new ChatIntegration(api, stateManager, eventManager);
await chatIntegration.initialize();
```

### 3) UI intent events

The modern widget emits semantic intent events for UI actions:

```javascript
EventManager.EVENTS.CHAT.REQUEST_SEND
EventManager.EVENTS.CHAT.REQUEST_CLEAR
EventManager.EVENTS.CHAT.REQUEST_HISTORY
EventManager.EVENTS.CHAT.REQUEST_EXPORT
EventManager.EVENTS.CHAT.INPUT_ENHANCEMENT_REQUESTED
```

`ChatIntegration` wires send/clear/history to `ChatManager`.

## Notes

- The modern widget builds the chat DOM inside `.chatbot-container`.
- The message renderer is selected by `data-renderer="modern"`.
- Feature hooks (emoji/file/voice/export/history/settings/minimize/close) emit intent events and can be wired later.

## Demo

```
http://localhost:5555/chat-demo.html
```

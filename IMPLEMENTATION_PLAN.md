# PREECODE IMPLEMENTATION PLAN
## Features 1 & 2: Project Review + Learning Memory System

**Document Date**: 2026-06-04  
**Status**: Planning Phase Complete - Ready for Implementation Review

---

## EXECUTIVE SUMMARY

This document outlines the implementation strategy for two new features in Preecode:

1. **Feature 1: Project-Wide Code Review** - Extend existing code review to support reviewing entire projects, multiple files, and workspaces
2. **Feature 2: Learning Memory System** (Optional) - User-controlled system to track development errors and suggest solutions

Both features are designed to:
- Reuse existing AI infrastructure (OpenRouter backend)
- Maintain backward compatibility (no breaking changes)
- Preserve all existing functionality (question review unchanged)
- Be production-ready with minimal scope

---

## PART 1: PROJECT-WIDE CODE REVIEW

### 1.1 Current State Analysis

**Existing Code Review Functionality**:
- Location: VS Code extension (`aiActionService.ts`)
- Trigger: `/preecode: Review Code` command or button click
- Scope: Single file or selected code block
- AI: Local analysis via Gemini (OpenRouter: openai/gpt-oss-120b)
- Backend: Optional - `/api/ai/review` endpoint exists but not used by extension
- Storage: Not persisted to backend (local only)

**Constraints**:
- Extension captures only selected/current file diagnostics
- No folder/multi-file selection capability
- No recursive file traversal
- Backend review endpoint only used for problem solution review

### 1.2 Requirements Mapping

| Requirement | Implementation | New Files | Modified Files |
|-------------|-----------------|-----------|-----------------|
| Select entire project folder | Command + file picker | None | extension.ts, package.json |
| Select specific files | Multi-select dialog | None | extension.ts, commands |
| Select multiple files | File tree traversal | projectReviewService.ts | aiActionService.ts |
| Review currently open workspace | Workspace API integration | None | extension.ts |
| Analyze: code quality, bugs, security, performance, architecture, code smells, maintainability, scalability, best practices | Enhanced AI prompt | None | aiService.js, projectReviewService.ts |
| Return: summary, problems, severity, fixes, code examples | Structured response format | projectReviewModels.ts | aiService.js |
| Preserve existing question-solution review | Separate code path | None | aiActionService.ts |
| Reuse AI infrastructure | Use same OpenRouter service | None | New endpoint in backend |
| Scale to large projects | Batch processing, file chunking | projectReviewService.ts | apiService.ts |
| Add clear UI entry points | New commands, webview panel | projectReviewPanel.ts | controlCenterView.ts |

### 1.3 Architecture Design

#### 1.3.1 Backend Changes

**New API Endpoint**: `POST /api/ai/project-review`

```javascript
// Request
{
  userId: string,           // Optional: for persistence
  files: [                  // Array of file objects
    {
      path: string,         // File path
      content: string,      // File content (max 50KB per file)
      language: string      // e.g., "javascript", "python"
    }
  ],
  projectInfo: {
    name: string,          // Project name
    frameworks: string[],  // Detected frameworks (React, Express, etc.)
    languages: string[],   // Languages used
    totalFiles: number     // Total file count
  },
  analysisLevel: "quick" | "deep" // quick = 2 files, deep = full project
}

// Response
{
  projectSummary: {
    overallScore: number,           // 1-100
    riskLevel: "low" | "medium" | "high",
    mainFindings: string[]          // 3-5 key issues
  },
  findings: [
    {
      category: "bugs" | "security" | "performance" | "architecture" | "quality" | "maintainability",
      severity: "critical" | "high" | "medium" | "low",
      title: string,
      description: string,
      affectedFiles: string[],      // File paths
      location: { file: string, line?: number, column?: number },
      suggestedFix: string,
      improvedCode?: string,
      rationale: string
    }
  ],
  bestPractices: {
    observed: string[],             // What's working well
    recommendations: string[],      // What could be improved
    frameworkSpecific: string[]     // Framework-specific suggestions
  },
  performanceInsights: {
    potentialBottlenecks: string[],
    optimization: string
  },
  generatedAt: timestamp
}
```

**Service Layer Enhancement** (`/preecode-backend/services/aiService.js`):

- Add new function: `reviewProject(files, projectInfo, analysisLevel)`
- Use enhanced prompt template for comprehensive analysis
- Handle file batching for large projects (max 5 files per prompt, resume-based)
- Response formatting as above

**Considerations**:
- File size limits: max 50KB per file (prevents token overflow)
- Project complexity: smart sampling for large projects
- Caching: Optional Redis cache for identical project analysis
- Rate limiting: Already handled by existing retry logic

#### 1.3.2 Database Changes

**New Schema** (Optional - only if persistence enabled):

```javascript
// ProjectReview.js
{
  userId: ObjectId,
  projectName: string,
  projectPath: string,        // Full path or hash
  filesReviewed: number,
  analysisLevel: string,
  findings: [{
    category: string,
    severity: string,
    title: string,
    // ... full finding object
  }],
  projectSummary: object,
  createdAt: Date,
  expiresAt: Date (30 days)   // Auto-cleanup
}
```

**Decision**: Store reviews for 30 days → allows user to review history but doesn't bloat database.

#### 1.3.3 Extension Changes

**New Files**:

1. **`src/services/projectReviewService.ts`**
   - Functions:
     - `selectProjectFolder()` - Uses VS Code file picker
     - `selectMultipleFiles()` - File tree selection dialog
     - `getWorkspaceFiles()` - Recursively traverse workspace
     - `filterFilesForReview()` - Smart file filtering (ignore node_modules, .git, etc.)
     - `prepareFilesBatch()` - Split large projects into batches
     - `detectProjectInfo()` - Identify frameworks, languages from files

2. **`src/models/projectReviewModels.ts`**
   - Type definitions for ProjectReviewRequest, ProjectReviewResponse, Finding

3. **`src/panels/projectReviewPanel.ts`**
   - New webview panel for displaying project review results
   - Similar to `aiActionPanel.ts` but with:
     - Summary section
     - Filterable findings (by category/severity)
     - File browser for affected files
     - Expandable finding details with code snippets

**Modified Files**:

1. **`src/extension.ts`**
   - Add new command: `preecode.reviewProject`
   - Register new panel view: `preecode.projectReviewPanel`

2. **`package.json`**
   - New command: "Preecode: Review Project"
   - New view: "Project Review Results"
   - Keybinding: (optional - e.g., Ctrl+Shift+Alt+R)

3. **`src/services/apiService.ts`**
   - Add method: `sendProjectReviewRequest(files, projectInfo, analysisLevel)`
   - Handles streaming for large responses

4. **`src/views/controlCenterView.ts`**
   - Add "Review Project" button to main control center

5. **`src/state/types.ts`**
   - Add ProjectReview state type

#### 1.3.4 UI/UX Flow

**User Journey**:
```
1. User opens VS Code with project
2. Opens Preecode control center
3. Clicks "Review Project" button
4. Dialog appears:
   - Option A: "Review Current Workspace"
   - Option B: "Select Project Folder"
   - Option C: "Select Specific Files"
5. If Option B/C: File picker opens
6. User selects files/folder
7. Analysis level choice: "Quick (2 files)" or "Deep (all files)"
8. Extension detects project info (frameworks, languages)
9. Sends batch requests to backend
10. Results displayed in project review panel:
    - Project summary with risk level
    - Filterable findings by category/severity
    - Specific file locations
    - Suggested fixes with code examples
    - Best practices & recommendations
11. User can:
    - Pin review for future reference
    - Export review as markdown/JSON
    - Re-run specific category analysis
```

### 1.4 Implementation Phases

#### Phase 1A: Backend (2-3 days)
1. Create new `aiService.reviewProject()` function
2. Add `POST /api/ai/project-review` endpoint
3. Test with sample projects (5-10 files)
4. Verify response formatting

#### Phase 1B: Extension - Basic (2-3 days)
1. Create `projectReviewService.ts` with file selection logic
2. Create `projectReviewPanel.ts` webview
3. Add command and register in extension.ts
4. Implement simple file picker flow

#### Phase 1C: Extension - Advanced (2-3 days)
1. Add intelligent file filtering
2. Implement project info detection
3. Add batch processing for large projects
4. Create filtereable UI with categories/severity

#### Phase 1D: Testing & Polish (1-2 days)
1. Test with various project sizes (10-1000 files)
2. Test with different tech stacks
3. Performance optimization
4. Error handling

**Total Effort**: ~1-2 weeks implementation

### 1.5 File Changes Summary

| File | Type | Purpose |
|------|------|---------|
| `/preecode-backend/services/aiService.js` | Modify | Add `reviewProject()` function |
| `/preecode-backend/routes/aiRoutes.js` | Modify | Add POST `/api/ai/project-review` route |
| `/preecode-backend/controllers/aiController.js` | Modify | Add controller for project review |
| `/preecode-backend/models/ProjectReview.js` | Create | New schema for review persistence (optional) |
| `/preecode-extension/src/services/projectReviewService.ts` | Create | Project selection and file handling |
| `/preecode-extension/src/models/projectReviewModels.ts` | Create | TypeScript types for project review |
| `/preecode-extension/src/panels/projectReviewPanel.ts` | Create | Webview for displaying results |
| `/preecode-extension/src/extension.ts` | Modify | Register new command |
| `/preecode-extension/package.json` | Modify | Add new command and view |
| `/preecode-extension/src/services/apiService.ts` | Modify | Add `sendProjectReviewRequest()` |
| `/preecode-extension/src/views/controlCenterView.ts` | Modify | Add "Review Project" button |
| `/preecode-extension/src/state/types.ts` | Modify | Add ProjectReviewState type |

**Backward Compatibility**: ✅ No breaking changes. Existing code review remains unchanged.

---

## PART 2: OPTIONAL LEARNING MEMORY SYSTEM

### 2.1 Current State Analysis

**Current Architecture**:
- No error tracking beyond VS Code diagnostics
- No persistent error history
- No pattern detection
- No suggestion history

**Why Add This**:
- Users encounter similar errors repeatedly
- Suggestions aren't tracked (user doesn't know what worked)
- Patterns emerge but aren't visible
- Knowledge from previous sessions is lost

### 2.2 Requirements Mapping

| Requirement | Implementation | New Files | Modified Files |
|-------------|-----------------|-----------|-----------------|
| Track errors/messages/stack traces | Capture from diagnostics | errorTrackingService.ts | extension.ts |
| Track project info (type, language, framework) | Auto-detect from workspace | errorTrackingService.ts | projectDetectionService.ts |
| Track user actions (attempts, fixes) | Event-based logging | actionsTrackingService.ts | commands, services |
| Track solutions (successful vs failed) | Action outcome tracking | solutionTrackingService.ts | aiActionService.ts |
| Track time to solve | Timer from problem start to resolution | timerService.ts | (existing) |
| Detect similarities | ML-based error matching | similarityEngine.ts | learningMemoryService.ts |
| Notify user of similar issues | Proactive suggestions | Extension UI | memoryPanel.ts |
| Settings: enable/disable/delete/export/import | Extension settings | memorySettingsService.ts | package.json, settings.ts |
| User owns data (privacy) | LocalStorage + DB with userId | Database model | apiService.ts |
| Optional & disabled by default | Feature flag in settings | None | extension.ts |

### 2.3 Architecture Design

#### 2.3.1 Data Model

**New MongoDB Schema** (`/preecode-backend/models/LearningMemory.js`):

```javascript
{
  userId: ObjectId,              // User who owns this memory
  memoryType: "error" | "success" | "pattern",
  
  // Error Information
  errorId: string,               // Hash of error signature
  errorMessage: string,          // Full error message
  stackTrace: string,            // Stack trace (if available)
  errorCategory: string,         // "syntax", "runtime", "logic", "type", etc.
  
  // Context
  projectInfo: {
    projectName: string,
    projectType: string,         // "web", "mobile", "cli", "lib", etc.
    frameworks: string[],
    language: string
  },
  
  // File & Location
  fileName: string,
  fileLanguage: string,
  lineNumber: number,
  context: string,               // Surrounding code (10 lines)
  
  // Solution Information
  solutions: [{
    approach: string,            // Description of fix approach
    code: string,               // Fix code example
    userApplied: boolean,       // Did user apply this fix?
    outcome: "success" | "partial" | "failed",
    timeToFix: number,          // Milliseconds
    attemptNumber: number,      // Which attempt (1st, 2nd, etc.)
    sourceType: "ai" | "user" | "docs",  // Where fix came from
    notes: string              // User's notes on fix
  }],
  
  // Pattern Tracking
  occurrences: number,           // How many times this error occurred
  lastOccurrence: Date,
  firstOccurrence: Date,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date,              // 6-month retention policy
  tags: string[]                // User-added tags
}
```

**Helper Schema** (`/preecode-backend/models/LearningPattern.js`):

```javascript
{
  userId: ObjectId,
  pattern: "recurring_error" | "common_mistake" | "skill_gap",
  description: string,
  affectedAreas: string[],      // ["React state", "TypeScript types", etc.]
  frequency: number,            // Occurrences in last 30 days
  recommendations: string[],    // AI suggestions for improvement
  resources: string[],          // Learning resource links
  createdAt: Date
}
```

#### 2.3.2 Backend Changes

**New Routes** (`/preecode-backend/routes/memoryRoutes.js`):

```
POST   /api/memory/track-error      - Log error occurrence
POST   /api/memory/track-solution   - Log fix/solution applied
GET    /api/memory/similar-errors   - Find similar past errors
GET    /api/memory/history          - Get full error history
GET    /api/memory/patterns         - Get identified patterns
POST   /api/memory/export           - Export all memory data
POST   /api/memory/delete           - Delete all memory data
POST   /api/memory/settings         - Update memory settings
```

**New Controller** (`/preecode-backend/controllers/memoryController.js`):

- `trackError()` - Save error info
- `trackSolution()` - Update error with solution outcome
- `findSimilarErrors()` - Query for similar errors
- `getMemoryHistory()` - Return paginated error history
- `analyzePatterns()` - Identify recurring patterns
- `exportMemory()` - Generate export file
- `deleteMemory()` - Clear all data

**New Service** (`/preecode-backend/services/memoryService.js`):

- `detectErrorSimilarity()` - Compare error signatures
- `generateErrorHash()` - Create unique error identifier
- `classifyError()` - Categorize error type
- `suggestApproach()` - AI-based fix suggestions
- `identifyPatterns()` - Statistical pattern detection

#### 2.3.3 Extension Changes

**New Files**:

1. **`src/services/errorTrackingService.ts`**
   - Monitor VS Code diagnostics
   - Track compilation errors, runtime errors, warnings
   - Capture stack traces
   - Extract error context

2. **`src/services/projectDetectionService.ts`**
   - Detect project type (web, mobile, cli, lib)
   - Identify frameworks (React, Express, Django, etc.)
   - Determine primary language
   - Extract project metadata

3. **`src/services/actionTrackingService.ts`**
   - Track user actions (debug, fix, explain, apply)
   - Log action timestamp and context
   - Track action outcomes

4. **`src/services/similarityEngine.ts`**
   - Match current error against history
   - Calculate similarity score
   - Rank similar errors by relevance

5. **`src/services/learningMemoryService.ts`**
   - Main orchestration service
   - Coordinates error tracking, tracking, pattern detection
   - Manages settings (enabled/disabled)
   - Handles export/import

6. **`src/models/memoryModels.ts`**
   - TypeScript types for memory data structures

7. **`src/panels/memoryViewerPanel.ts`**
   - Webview for viewing error history
   - Search & filter capabilities
   - Shows similar errors with solutions

8. **`src/panels/memorySettingsPanel.ts`**
   - Settings UI for enable/disable/delete/export/import

**Modified Files**:

1. **`package.json`**
   - New settings:
     - `preecode.learning.enabled` (default: false)
     - `preecode.learning.autoNotify` (default: true)
     - `preecode.learning.retentionDays` (default: 180)
   - New commands:
     - "Preecode: View Learning Memory"
     - "Preecode: Clear Learning Memory"
     - "Preecode: Export Memory"
     - "Preecode: Enable Learning Memory"

2. **`src/extension.ts`**
   - Initialize `learningMemoryService` if enabled
   - Register error tracking listener
   - Register new commands

3. **`src/state/types.ts`**
   - Add MemoryState type

4. **`src/services/apiService.ts`**
   - Add methods for memory endpoints:
     - `trackError()`
     - `trackSolution()`
     - `findSimilarErrors()`
     - `getMemoryHistory()`
     - `exportMemory()`

5. **`src/views/controlCenterView.ts`**
   - Add "Learning Memory" section (collapsed by default)
   - Show current memory size
   - Links to view/manage memory

#### 2.3.4 Feature Behavior

**Tracking Process**:
1. Error occurs in editor → Captured in diagnostics
2. Extension's `errorTrackingService` detects error
3. If memory enabled → Calls `learningMemoryService.trackError()`
4. Service computes error hash and similarity score
5. If similarity > threshold → Notifies user:
   ```
   "Similar error detected!
    You faced a comparable issue 14 days ago.
    Previous fix: Used useCallback hook
    Success rate: 100%
    View history?"
   ```
6. User clicks "View" → Opens memory viewer panel
7. User attempts fix → Outcome tracked via `trackSolution()`

**Pattern Detection**:
- Runs weekly (configurable)
- Analyzes last 30 days of errors
- Identifies top 5 recurring patterns
- Notifies user: "You tend to forget useEffect dependencies"
- Links to learning resources

**Privacy & Control**:
- Settings panel shows what's tracked:
  - Error messages ✓
  - Stack traces ✓
  - File names ✓
  - Project info ✓
  - NOT: Source code
  - NOT: User identity
  - NOT: System info
- User can:
  - Enable/disable globally
  - Clear all data instantly
  - Export as JSON
  - Import previous data
  - View retention policy (180 days)

#### 2.3.5 Database Retention Policy

- Auto-delete records after 180 days
- MongoDB TTL index on `expiresAt` field
- User can manually delete anytime
- Export before deletion to preserve locally

### 2.4 Implementation Phases

#### Phase 2A: Backend (2-3 days)
1. Create LearningMemory & LearningPattern schemas
2. Add memory routes and controller
3. Implement similarity detection algorithm
4. Test pattern identification

#### Phase 2B: Extension - Tracking (2-3 days)
1. Create error tracking service
2. Create project detection service
3. Create learning memory orchestration service
4. Integrate with error diagnostics

#### Phase 2C: Extension - UI (2 days)
1. Create memory viewer panel
2. Create settings panel
3. Add control center integration
4. Implement similarity notifications

#### Phase 2D: Testing & Polish (1-2 days)
1. Test error tracking accuracy
2. Test pattern detection
3. Test export/import functionality
4. Performance testing with large history

**Total Effort**: ~1-2 weeks implementation

### 2.5 File Changes Summary

| File | Type | Purpose |
|------|------|---------|
| `/preecode-backend/models/LearningMemory.js` | Create | Error memory schema |
| `/preecode-backend/models/LearningPattern.js` | Create | Pattern schema |
| `/preecode-backend/routes/memoryRoutes.js` | Create | Memory API endpoints |
| `/preecode-backend/controllers/memoryController.js` | Create | Memory business logic |
| `/preecode-backend/services/memoryService.js` | Create | Memory service layer |
| `/preecode-extension/src/services/errorTrackingService.ts` | Create | Error capturing |
| `/preecode-extension/src/services/projectDetectionService.ts` | Create | Project info detection |
| `/preecode-extension/src/services/actionTrackingService.ts` | Create | Action logging |
| `/preecode-extension/src/services/similarityEngine.ts` | Create | Similarity matching |
| `/preecode-extension/src/services/learningMemoryService.ts` | Create | Memory orchestration |
| `/preecode-extension/src/models/memoryModels.ts` | Create | TypeScript types |
| `/preecode-extension/src/panels/memoryViewerPanel.ts` | Create | Memory viewer UI |
| `/preecode-extension/src/panels/memorySettingsPanel.ts` | Create | Settings UI |
| `/preecode-extension/package.json` | Modify | Add settings & commands |
| `/preecode-extension/src/extension.ts` | Modify | Initialize memory service |
| `/preecode-extension/src/state/types.ts` | Modify | Add MemoryState |
| `/preecode-extension/src/services/apiService.ts` | Modify | Add memory endpoints |
| `/preecode-extension/src/views/controlCenterView.ts` | Modify | Add memory section |

**Backward Compatibility**: ✅ Completely optional. Disabled by default. No impact on existing features.

---

## PART 3: IMPLEMENTATION SEQUENCING

### 3.1 Recommended Order

**Priority 1: Feature 1 (Project Review)** - 1-2 weeks
- Reason: More immediately valuable, less complex, good foundation
- Builds on existing code review infrastructure
- Clear user value

**Priority 2: Feature 2 (Learning Memory)** - 1-2 weeks  
- Reason: Complex, but optional so doesn't block Feature 1
- Can be developed independently
- More exploratory/innovative

### 3.2 Critical Dependencies

**Feature 1 Dependencies**:
- OpenRouter API access (already configured)
- No new database models required
- Can work entirely local if needed

**Feature 2 Dependencies**:
- MongoDB connection (already available)
- No external APIs required
- Completely self-contained

### 3.3 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Large project analysis timeouts | Implement file batching, progressive UI updates |
| Token limits on AI API | Cap files per request, implement smart sampling |
| Memory database growth | Implement TTL index, user controls retention |
| Privacy concerns | Clear opt-in, local storage option, audit logging |
| Performance impact | Feature flags, lazy loading, background workers |
| Existing code breaks | Comprehensive testing, feature branch, rollback ready |

---

## PART 4: TESTING STRATEGY

### 4.1 Feature 1: Project Review Testing

**Unit Tests**:
- File filtering logic
- Project detection accuracy
- Batch processing logic
- Response formatting

**Integration Tests**:
- Full project → API → Response cycle
- With various project sizes (10, 100, 1000 files)
- With different tech stacks (Node, React, Python, Go, etc.)
- Error handling and timeout scenarios

**Manual Testing**:
- Real projects (3-5 different types)
- UI responsiveness with large result sets
- Code suggestion applicability
- Performance benchmarks

### 4.2 Feature 2: Learning Memory Testing

**Unit Tests**:
- Error hash uniqueness
- Similarity scoring accuracy
- Pattern detection logic
- Export/import data integrity

**Integration Tests**:
- Error tracking end-to-end
- Solution tracking and outcome recording
- Pattern identification accuracy
- Database retention policy

**Manual Testing**:
- Deliberately reproduce errors
- Verify notifications accuracy
- Test export/import workflow
- Verify privacy settings work

### 4.3 Regression Testing

- Verify existing code review still works unchanged
- Verify existing practice/submission tracking unchanged
- Verify authentication still works
- Verify dashboard stats still accurate

---

## PART 5: DEPLOYMENT STRATEGY

### 5.1 Phase 1: Backend Deployment
1. Deploy `/api/ai/project-review` endpoint
2. Test with staging environment
3. Monitor performance and error rates
4. Enable feature flag (disabled by default)

### 5.2 Phase 2: Extension Release
1. Bump extension version
2. Release to VS Code Marketplace
3. Auto-update available to users
4. Monitor telemetry/error rates

### 5.3 Phase 3: Frontend (Optional)
1. Add project review link to dashboard
2. Display saved reviews if persisted
3. Link to extension for actual review

### 5.4 Rollback Plan
- Feature flags for both features
- Can disable without code changes
- Database migrations are backward-compatible
- No destructive changes

---

## PART 6: SECURITY CONSIDERATIONS

### 6.1 Project Review Security

**Input Validation**:
- File size limits (max 50KB per file)
- Total project size limits (max 500KB analyzed)
- Filename validation (no path traversal)
- Content sanitization before AI analysis

**Data Privacy**:
- Reviews not stored by default (local only)
- Optional persistence requires explicit opt-in
- Reviews expire after 30 days if stored
- No sensitive data (passwords, keys) should be analyzed

**API Security**:
- JWT authentication required
- Rate limiting on review endpoint
- Timeout protection (45 seconds)
- Error message sanitization

### 6.2 Learning Memory Security

**Data Protection**:
- Encrypted transmission (HTTPS)
- User owns all data (userId field)
- No sharing between users
- Full deletion capability

**Privacy by Design**:
- Opt-in only (disabled by default)
- Transparent data collection
- User controls retention (default 180 days)
- Export/import for data portability

**Access Control**:
- JWT authentication required
- Users can only access own memory
- Admin access logging (if applicable)

---

## PART 7: SCALABILITY CONSIDERATIONS

### 7.1 Project Review Scalability

**Current Limitations**:
- OpenRouter API: 45-second timeout
- File processing: Sequential analysis

**Scalability Strategy**:
- Implement file batching (analyze in groups)
- Progressive UI: Show results as they arrive
- Optional caching: Store common patterns
- Sampling for very large projects: Analyze 5% representative files
- Queue system: Use Bull/RabbitMQ for async processing (future)

### 7.2 Learning Memory Scalability

**Database Considerations**:
- Compound index on (userId, errorId, createdAt)
- TTL index for auto-cleanup
- Sharding by userId for multi-tenant deployments
- Archive old data to separate collection

**Performance Optimization**:
- Cache recent errors in memory (LRU cache)
- Background job for pattern analysis (not real-time)
- Batch similarity matching (not per-error)
- Consider MongoDB Atlas Search for fuzzy matching

---

## PART 8: MONITORING & ANALYTICS

### 8.1 Feature 1 Metrics

- Reviews triggered (count)
- Average project size analyzed
- Analysis time distribution
- Finding categories distribution
- User feedback on results

### 8.2 Feature 2 Metrics

- Feature enabled rate (%)
- Errors tracked (count)
- Pattern detection accuracy
- User notification click rate
- Memory export/delete frequency

---

## PART 9: DOCUMENTATION REQUIREMENTS

After implementation, create:

1. **User Documentation**:
   - Project Review feature guide
   - Learning Memory user manual
   - Privacy policy updates

2. **API Documentation**:
   - New endpoints and schemas
   - Rate limits and quotas
   - Example requests/responses

3. **Developer Documentation**:
   - Architecture diagrams
   - Service interaction flows
   - Extension contribution guide

---

## PART 10: SUMMARY OF CHANGES

### Files to Create: 18
- Backend: 4 new files
- Extension: 8 new files
- Models/Types: 3 new files

### Files to Modify: 12
- Backend: 3 files
- Extension: 9 files

### Database Schemas: 2 new (LearningMemory, LearningPattern)

### API Endpoints: 8 new (memory endpoints)

### Extension Commands: 5 new

### Estimated Timeline: 2-4 weeks

### Backward Compatibility: ✅ 100% - No breaking changes

---

## APPROVAL CHECKLIST

- [ ] Architecture approved by team
- [ ] API contract approved
- [ ] Database schema approved
- [ ] UI/UX flows approved
- [ ] Security review completed
- [ ] Performance benchmarks acceptable
- [ ] Testing strategy approved
- [ ] Ready to begin Phase 1 (Backend)

---

**Next Step**: Proceed to Feature 1 Backend implementation or request modifications to this plan.

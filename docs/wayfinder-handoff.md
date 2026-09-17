# WAYFINDER HANDOFF DOCUMENT

Current State Summary

Based on my review of the GitHub repository and wayfinder tickets, here's what has been accomplished:

✅ Completed Work

Map Issue Created:

- Issue #9: "Wayfinder map: OAuth 2.0 auth server for Micro-Auth-NestJS"
- Contains RFC 6749 OAuth 2.0 authorization server destination
- Lists 7 front decisions (prerequisites) for the effort

Ticket Structure Created:

- Research Tickets (AFK, parallel execution):
  - #10: RFC 6749 endpoints and grant type requirements
  - #11: OAuth 2.0 client registration and consent patterns
  - #12: Consent UX and unregistered service warning patterns
- Task Tickets (HITL - decision blocking):
  - #13: Authorization code storage and PKCE mechanism
  - #14: Client entity design and migration
  - #15: Token endpoint client authentication strategy
  - #16: Scope model and access token claims mapping
  - #17: Remember Me and session expiry policy
  - #18: Unregistered service warning page behavior
- Prototype Ticket (HITL):
  - #19: Consent screen UX and flow

Labels Created:

- wayfinder:map (issue #9)
- wayfinder:research (tickets #10, #11, #12)
- wayfinder:task (tickets #13-18)
- wayfinder:prototype (ticket #19)
- wayfinder:grilling (not used in this session)

🏗️ Existing System Foundation

Current Architecture (based on codebase review):

- Session-based JWT revocation (ADR-0001 foundation)
- User registration/login with refresh token rotation
- Session management endpoints (/auth/sessions)
- Response envelope pattern (EnvelopeModule)
- TypeORM with PostgreSQL
- NestJS with Express adapter

Key Components Already Implemented:

- src/auth/auth.controller.ts - registration, login, refresh, validate
- src/auth/sessions/ - session management
- src/common/transform/response/ - envelope interceptor
- src/auth/token.service.ts - JWT access/refresh token handling

📋 Work Through the Map - NEXT STEPS

Current Status: Frontier Pending

The wayfinder map (#9) shows all front decisions still pending, which means:

1. Map needs resolution - The map issue itself hasn't been resolved by wayfinder
2. Research tickets need claims - Parallel research needs human-in-the-loop decisions
3. Tasks need resolution - All task tickets are open and need decisions
4. Prototype needs resolution - UX prototype needs human review

Next Agent Recommended Actions

Step 1: Load the Map
/gh issue view 9 --comments

Step 2: Choose and Claim a Frontier Ticket
Pick from this order (prerequisites block later ones):

1. Research #10 - RFC 6749 endpoints and grant types
   - Claim: gh issue edit 10 --add-assignee @me
   - Call: /mattpocock-skills:research with prompt about RFC 6749 requirements
2. Research #11 - Client registration and consent patterns
3. Research #12 - Consent UX and warning patterns

Step 3: After Research, Choose Tasks
After research findings, choose from:

1. Task #13 - Authorization code storage decision
2. Task #14 - Client entity design (blocks auth endpoints)
3. Task #15 - Token endpoint authentication strategy
4. Task #16 - Scope model design
5. Task #17 - Remember Me policy
6. Task #18 - Unregistered service warning
7. Prototype #19 - Consent screen UX

🔧 Suggested Skills for Next Agent

Required Skills:

1. /mattpocock-skills:grilling - Use when loading the map to understand the frontier
2. /mattpocock-skills:domain-modeling - When discussing scope models and consent UX
3. /mattpocock-skills:research - For the three research tickets (this resolves them)
4. /mattpocock-skills:prototype - For the consent UX prototype ticket
5. /mattpocock-skills:codebase-design - For mapping out client entity and storage decisions

When in Plan Mode:

- Use /EnterPlanMode for complex architectural decisions
- Use /ExitPlanMode after finalizing your approach

📝 Key Decision Points for the Next Agent

Critical Path Dependencies:

1. Research #10 unlocks Task #13
2. Research #11 unlocks Task #14
3. Research #12 unlocks Tasks #17 and #18
4. Prototype #19 informs Task #16 (scope/model alignment)

Architecture Questions to Answer:

- Which grant types from RFC 6749 are required?
- How should client authentication work (secret vs PKCE)?
- What's the scope model design?
- How does Remember Me interact with session expiry?
- What does the unregistered service warning look like?

🚦 Priority Recommendation

Phase 1 (Research): Claim and resolve the three research tickets in order
Phase 2 (Design): Make the architectural decisions for Task tickets
Phase 3 (Prototype): Create the consent UX prototype
Phase 4 (Implementation): Hand off to implementation for actual code changes

📍 Current Frontier

First in line: Research ticket #10 "RFC 6749 endpoints and grant type requirements"

This ticket will determine which OAuth 2.0 grant types (Authorization Code PKCE, Client Credentials, Refresh Token)
are required, and what endpoints are needed for RFC 6749 compliance. This knowledge blocks all other tickets.

📞 For Further Context

Map URL: https://github.com/SharmaAayush/Micro-Auth-NestJS/issues/9
All Wayfinder Tickets: https://github.com/SharmaAayush/Micro-Auth-NestJS/issues?q=is%3Aissue+label%3Awayfinder

Architecture Notes:

- Existing session/JWT infrastructure provides strong foundation
- The challenge is extending to full OAuth 2.0 with client registration
- Current HBS/views system supports server-side rendering for consent/admin pages
- Database already supports User and Session entities

This handoff document captures the current state. The next agent should load the map and begin claiming frontier
tickets to make progress toward the RFC 6749 OAuth 2.0 authorization server destination.

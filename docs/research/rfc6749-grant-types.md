# RFC 6749 Grant Types and Required Endpoints

This research note provides the primary-source analysis for Wayfinder ticket #10,
“Research: RFC 6749 endpoints and grant type requirements,” and forms the basis for the
decision posted on that issue and recorded on the map issue #9.

## 1. Four normative grant types (RFC 6749, §1.1)

RFC 6749 defines **four** grant types:

| Grant type | Section | Endpoint used |
|------------|---------|---------------|
| Authorization Code | §4.1 | Authorization endpoint + Token endpoint |
| Implicit | §4.2 | Authorization endpoint only |
| Resource Owner Password Credentials | §4.3 | Token endpoint only |
| Client Credentials | §4.4 | Token endpoint only |

Source: https://www.rfc-editor.org/rfc/rfc6749.txt §1.1

## 2. Authorization endpoint (§3.1) — required for which grants

- The **authorization endpoint** (`/authorize`) is used by exactly two grant types:

  1. **Authorization Code** (`response_type="code"`)
  2. **Implicit** (`response_type="token"`)

- All other grant types (`resource owner password credentials`, `client credentials`)
  **do not use** the authorization endpoint; they interact directly with the token endpoint.
- Required request parameters per §3.1: `response_type`, `client_id`, `redirect_uri`,
  `scope`, `state`. The `redirect_uri` must be an **exact match** to a registered URI
  (§3.1.2.2, §7.3).

Source: https://www.rfc-editor.org/rfc/rfc6749.txt §3.1

## 3. Token endpoint (§3.2) — required for which grants

- The **token endpoint** (`/token`) is used by three grant types:

  1. **Authorization Code**
  2. **Resource Owner Password Credentials**
  3. **Client Credentials**

- Implicit grant does **not** use the token endpoint; it receives tokens from the
  authorization endpoint directly.

- Clients authenticate at the token endpoint. Confidential clients use
  `client_secret_basic` or `client_secret_post` (§3.2.1). Public clients that
  cannot maintain a secret use **PKCE** (§3.2.2) per RFC 7636.

Source: https://www.rfc-editor.org/rfc/rfc6749.txt §3.2

## 4. Refresh token grant (§6) — optional issuance, required protocol

- RFC 6749 §6 defines the **refresh token grant**: a client exchanges a refresh token
  for a new access token at the **token endpoint** (`grant_type=refresh_token`).

- Issuing a refresh token is **optional at the authorization server's discretion**
  (§1 abstract). If issued, the refresh token grant protocol is normative.

- RFC 6749 §5.1: the token response includes an optional `refresh_token` field.

Source: https://www.rfc-editor.org/rfc/rfc6749.txt §5.1, §6

## 5. PKCE (RFC 7636) — public‑client mitigation

- **PKCE** (Proof Key for Code Exchange) is an extension of the authorization code flow
  that mitigates authorization code interception.

- Recommended for **public clients** (native, SPA) that cannot securely store a client
  secret. §3.2.2 of RFC 6749 references PKCE; the actual protocol is RFC 7636.

- Without PKCE, public clients are vulnerable to code injection attacks; with PKCE,
  the server binds the authorization request to the token request via a secret
  (`code_verifier`, `code_challenge`).

Source: https://www.rfc-editor.org/rfc/rfc7636.txt

## 6. Revocation and Introspection — separate RFCs

- RFC 6749 **does not define** a revocation or introspection endpoint.
- **RFC 7662** defines the *token introspection endpoint*.
- **RFC 7009** defines the *token revocation endpoint*.

These are out‑of‑scope for RFC 6749 compliance per se but are commonly deployed
alongside an OAuth 2.0 authorization server.

Source: https://www.rfc-editor.org/rfc/rfc7662.txt, https://www.rfc-editor.org/rfc/rfc7009.txt

## 7. Implicit grant deprecation (OAuth 2.1 / browser changes)

- The implicit grant is deprecated in OAuth 2.1 and flagged by major browser vendors
  for third‑party cookie restrictions.

- Not a core requirement of RFC 6749 but retained for legacy compatibility.

Source: https://www.rfc-editor.org/rfc/rfc6749.txt §10.12

## 8. Minimum viable grant/endpoint set for this NestJS service

Given the existing session/JWT refresh architecture and server‑rendered consent
possibility, the following subset is sufficient for RFC 6749‑compliant OAuth 2.0
operation:

| Minimum grant(s) | Required endpoint(s) | Reason |
|------------------|----------------------|--------|
| **Authorization Code** (mandatory) | Authorization endpoint + Token endpoint | Core grant; existing PKCE support via RFC 7636 |
| **Refresh Token** (optional but already in use) | Token endpoint with `grant_type=refresh_token` | Existing token rotation infrastructure (§6) |
| **Client Credentials** (if needed for first‑party services) | Token endpoint only | §4.4; not required for user‑focused service |

Optional (not required for RFC 6749 compliance but common):

- Implicit grant – deprecated; can be omitted.
- Resource Owner Password Credentials – discouraged; omit.
- Revocation / Introspection endpoints – separate RFCs; add only if required by clients.

## 9. Terminology/domain‑model checks

- Existing `CONTEXT.md` and `src/auth/AGENTS.md` use **Session‑bound JWT** (jti) for
  revocation; this maps cleanly to the refresh‑token grant flow.
- No existing client model or client‑registration UI exists; this decision does not
  preclude later adding a client‑registration module (see map ticket #14).

## 10. Sources

- [RFC 6749 – The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.txt)
- [RFC 7636 – Proof Key for Code Exchange (PKCE) for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc7636.txt)
- [RFC 7662 – OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662.txt)
- [RFC 7009 – OAuth 2.0 Token Revocation](https://www.rfc-editor.org/rfc/rfc7009.txt)
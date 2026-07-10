# Web — Manager module

Owns: Approval Queue, Claim Review, Approve / Reject / Return with remarks.
Full spec: [docs/workstreams/02-manager.md](../../../../../docs/workstreams/02-manager.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

Both pages are fully implemented against `apps/api/src/modules/manager`.
`ClaimReview.tsx`'s three-button decision pattern (Approve/Return/Reject,
remarks required client-side and server-side) is the template Accounts'
verification screen follows too.

Still open in this module:
- Attachments list is filenames only — add a real download/preview link
  once `Attachment.fileUrl` points at real storage (see employee module
  TODO).
- No pagination on the Approval Queue — fine at hackathon scale, revisit if
  claim volume grows.
